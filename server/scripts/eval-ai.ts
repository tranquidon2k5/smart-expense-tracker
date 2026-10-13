/**
 * Đánh giá AI cho báo cáo (PRD §11.1): phân loại (chỉ luật / chỉ LLM / hybrid: accuracy, F1 từng
 * danh mục), trích xuất câu ghi nhanh, chọn công cụ của chatbot. Ghi tổng token để ước chi phí.
 *
 *   npm run eval:ai                      # chỉ luật (không cần khoá API)
 *   OPENAI_API_KEY=sk-... npm run eval:ai # thêm cột LLM và hybrid
 *   EVAL_OUT=../docs/eval-ai.md npm run eval:ai  # ghi kết quả ra file Markdown
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { isOutOfScope, planQuestion } from "@shared/assistant-engine";
import { classifyByRules, parseQuickEntryText } from "@shared/quick-entry";
import type { Category, ChatToolCall } from "@shared/types";
import * as mock from "../../src/services/mock/db";
import { OpenAiProvider, RuleOnlyProvider, type LlmProvider } from "../src/ai/llm.provider";
import { CHAT_SET, CLASSIFY_SET, EVAL_TODAY, EXTRACT_SET } from "./eval-data";

const categories: Category[] = mock.categories.filter((c) => c.userId === null);
const name = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "(không đoán)";
const key = process.env.OPENAI_API_KEY;
const llm: LlmProvider | null = key ? new OpenAiProvider(key, process.env.OPENAI_MODEL ?? "gpt-4.1-mini", process.env.OPENAI_BASE_URL) : null;
let tokens = 0;
const signal = () => AbortSignal.timeout(20_000);

type Method = "rules" | "llm" | "hybrid";

async function predict(method: Method): Promise<(string | null)[]> {
  const byRules = CLASSIFY_SET.map((t) => classifyByRules(t.description, { categories, userRules: [] }, { type: t.type }).category?.id ?? null);
  if (method === "rules") {
    // "Chỉ luật" dùng thêm từ khoá gợi ý (bộ dự phòng khi không có LLM)
    const guesses = (await new RuleOnlyProvider().classify(CLASSIFY_SET, categories)).value;
    return byRules.map((id, i) => id ?? guesses[i].categoryId);
  }
  const ask = method === "llm" ? CLASSIFY_SET.map((_, i) => i) : byRules.flatMap((id, i) => (id ? [] : [i]));
  const out: (string | null)[] = method === "llm" ? CLASSIFY_SET.map(() => null) : [...byRules];
  for (let s = 0; s < ask.length; s += 25) {
    const idx = ask.slice(s, s + 25);
    const r = await llm!.classify(idx.map((i) => CLASSIFY_SET[i]), categories, signal());
    tokens += r.tokens;
    r.value.forEach((g, k) => (out[idx[k]] = g.categoryId));
  }
  return out;
}

function scores(pred: (string | null)[]) {
  const truth = CLASSIFY_SET.map((t) => t.categoryId);
  const accuracy = truth.filter((t, i) => pred[i] === t).length / truth.length;
  const perCategory = categories.map((c) => {
    const tp = truth.filter((t, i) => t === c.id && pred[i] === c.id).length;
    const fp = truth.filter((t, i) => t !== c.id && pred[i] === c.id).length;
    const fn = truth.filter((t, i) => t === c.id && pred[i] !== c.id).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return { id: c.id, support: tp + fn, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
  });
  const macroF1 = perCategory.reduce((s, c) => s + c.f1, 0) / perCategory.length;
  return { accuracy, macroF1, perCategory };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

async function main() {
  const lines: string[] = [`# Kết quả đánh giá AI — ${new Date().toISOString().slice(0, 10)}`, ""];
  const methods: Method[] = llm ? ["rules", "llm", "hybrid"] : ["rules"];
  if (!llm) lines.push("> Chưa đặt OPENAI_API_KEY nên chỉ chạy cách “chỉ luật”. Đặt khoá để có cột LLM và hybrid.", "");

  // 1. Phân loại
  const results = new Map<Method, ReturnType<typeof scores>>();
  for (const m of methods) results.set(m, scores(await predict(m)));
  const label: Record<Method, string> = { rules: "Chỉ luật", llm: "Chỉ LLM", hybrid: "Hybrid" };
  lines.push(`## Phân loại (${CLASSIFY_SET.length} giao dịch)`, "", `| Danh mục | Số mẫu | ${methods.map((m) => `F1 ${label[m]}`).join(" | ")} |`, `|---|---:|${methods.map(() => "---:").join("|")}|`);
  for (const c of categories) {
    const r = results.get("rules")!.perCategory.find((x) => x.id === c.id)!;
    lines.push(`| ${c.name} | ${r.support} | ${methods.map((m) => pct(results.get(m)!.perCategory.find((x) => x.id === c.id)!.f1)).join(" | ")} |`);
  }
  lines.push(`| **Accuracy** | | ${methods.map((m) => `**${pct(results.get(m)!.accuracy)}**`).join(" | ")} |`);
  lines.push(`| **Macro F1** | | ${methods.map((m) => `**${pct(results.get(m)!.macroF1)}**`).join(" | ")} |`, "");

  // 2. Trích xuất
  const extractors: [string, (text: string) => Promise<{ amount: number | null; type: string; date: string }>][] = [
    ["Bộ parser luật", async (t) => parseQuickEntryText(t, EVAL_TODAY)],
  ];
  if (llm) {
    extractors.push([
      "LLM",
      async (t) => {
        const r = await llm.extract(t, { today: EVAL_TODAY }, signal());
        tokens += r.tokens;
        return { amount: r.value.so_tien, type: r.value.loai, date: r.value.ngay };
      },
    ]);
  }
  lines.push(`## Trích xuất (${EXTRACT_SET.length} câu)`, "", "| Cách | Số tiền | Loại thu/chi | Ngày | Đúng cả 3 |", "|---|---:|---:|---:|---:|");
  for (const [label2, run] of extractors) {
    let a = 0, ty = 0, d = 0, all = 0;
    for (const e of EXTRACT_SET) {
      const r = await run(e.text);
      const ok = [r.amount === e.amount, r.type === e.type, r.date === e.date];
      a += +ok[0]; ty += +ok[1]; d += +ok[2]; all += +ok.every(Boolean);
    }
    const n = EXTRACT_SET.length;
    lines.push(`| ${label2} | ${pct(a / n)} | ${pct(ty / n)} | ${pct(d / n)} | ${pct(all / n)} |`);
  }
  lines.push("");

  // 3. Chatbot: chọn đúng công cụ + tham số (số liệu do công cụ tính nên đúng công cụ = đúng số liệu)
  const same = (a: ChatToolCall | null, b: (typeof CHAT_SET)[number]["expected"]) =>
    (!a && !b) || (!!a && !!b && a.name === b.name && JSON.stringify(Object.entries(a.args).sort()) === JSON.stringify(Object.entries(b.args).sort()));
  const choosers: [string, (q: string) => Promise<ChatToolCall | null>][] = [
    ["Luật (planQuestion)", async (q) => {
      const p = planQuestion(q, { today: EVAL_TODAY, categories });
      return "call" in p ? p.call : null;
    }],
  ];
  if (llm) {
    choosers.push(["LLM function calling", async (q) => {
      if (isOutOfScope(q)) return null;
      const r = await llm.chooseTool(q, { today: EVAL_TODAY, categories }, signal());
      tokens += r.tokens;
      return r.value.call;
    }]);
  }
  lines.push(`## Chatbot (${CHAT_SET.length} câu hỏi)`, "", "| Cách | Đúng công cụ + tham số | Từ chối đúng | Thời gian TB |", "|---|---:|---:|---:|");
  const misses: string[] = [];
  for (const [label3, choose] of choosers) {
    let ok = 0, refusedOk = 0, ms = 0;
    for (const c of CHAT_SET) {
      const t0 = performance.now();
      const call = await choose(c.question);
      ms += performance.now() - t0;
      if (same(call, c.expected)) {
        ok += 1;
        if (!c.expected) refusedOk += 1;
      } else misses.push(`- [${label3}] “${c.question}” → ${call ? `${call.name}(${JSON.stringify(call.args)})` : "từ chối"}`);
    }
    const refuse = CHAT_SET.filter((c) => !c.expected).length;
    lines.push(`| ${label3} | ${pct(ok / CHAT_SET.length)} | ${refusedOk}/${refuse} | ${(ms / CHAT_SET.length).toFixed(0)} ms |`);
  }
  lines.push("");
  if (misses.length) lines.push("Câu sai:", "", ...misses, "");

  const wrong = (await predict("rules")).flatMap((p, i) => (p === CLASSIFY_SET[i].categoryId ? [] : [`- “${CLASSIFY_SET[i].description}”: đúng ${name(CLASSIFY_SET[i].categoryId)}, luật đoán ${name(p)}`]));
  lines.push(`## Phân loại sai của cách “chỉ luật” (${wrong.length})`, "", ...wrong.slice(0, 40), "");
  lines.push(`Tổng token đã dùng cho lần chạy này: ${tokens.toLocaleString("vi-VN")}.`);

  const report = lines.join("\n");
  console.log(report);
  if (process.env.EVAL_OUT) writeFileSync(process.env.EVAL_OUT, report);
}

void main();
