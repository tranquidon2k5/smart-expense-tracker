/**
 * Đánh giá AI cho báo cáo (PRD §11.1): phân loại (chỉ luật / chỉ LLM / hybrid: accuracy, F1 từng
 * danh mục), trích xuất câu ghi nhanh, chọn công cụ của chatbot. Ghi tổng token để ước chi phí.
 *
 *   npm run eval:ai                      # chỉ luật (không cần khoá API)
 *   OPENAI_API_KEY=sk-... npm run eval:ai # thêm cột LLM và hybrid
 *   EVAL_OUT=../docs/eval-ai.md npm run eval:ai  # ghi kết quả ra file Markdown
 *   EVAL_DRY=1 npm run eval:ai           # chỉ đếm số lần sẽ gọi LLM (ước tính token), không gọi thật
 *
 * Đo trên hai bộ: bộ gốc (eval-data.ts, đã dùng để chỉnh luật) và bộ giữ riêng (eval-holdout.ts,
 * chỉ để đo — kết quả trên bộ này mới phản ánh khả năng tổng quát).
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { isOutOfScope, planQuestion } from "@shared/assistant-engine";
import { classifyByRules, parseQuickEntryText } from "@shared/quick-entry";
import type { Category, ChatToolCall, TransactionType } from "@shared/types";
import * as mock from "../../src/services/mock/db";
import { OpenAiProvider, RuleOnlyProvider, type LlmProvider } from "../src/ai/llm.provider";
import { CHAT_SET, CLASSIFY_SET, EVAL_TODAY, EXTRACT_SET } from "./eval-data";
import { HOLDOUT_CHAT_SET, HOLDOUT_CLASSIFY_SET } from "./eval-holdout";

const categories: Category[] = mock.categories.filter((c) => c.userId === null);
const name = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "(không đoán)";
const key = process.env.OPENAI_API_KEY;
const llm: LlmProvider | null = key ? new OpenAiProvider(key, process.env.OPENAI_MODEL ?? "gpt-4.1-mini", process.env.OPENAI_BASE_URL) : null;
const DRY = !!process.env.EVAL_DRY;
let tokens = 0;
const planned = { classify: 0, extract: 0, chat: 0 };
const signal = () => AbortSignal.timeout(20_000);

type Method = "rules" | "llm" | "hybrid";
type ClassifySet = { description: string; type: TransactionType; categoryId: string }[];
type ChatSet = { question: string; expected: { name: string; args: Record<string, string | number | null> } | null }[];

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const label: Record<Method, string> = { rules: "Chỉ luật", llm: "Chỉ LLM", hybrid: "Hybrid" };

// ───────────── Phân loại ─────────────

async function predict(method: Method, set: ClassifySet): Promise<(string | null)[]> {
  const byRules = set.map((t) => classifyByRules(t.description, { categories, userRules: [] }, { type: t.type }).category?.id ?? null);
  if (method === "rules") {
    // "Chỉ luật" dùng thêm từ khoá gợi ý (bộ dự phòng khi không có LLM)
    const guesses = (await new RuleOnlyProvider().classify(set, categories)).value;
    return byRules.map((id, i) => id ?? guesses[i].categoryId);
  }
  const ask = method === "llm" ? set.map((_, i) => i) : byRules.flatMap((id, i) => (id ? [] : [i]));
  const out: (string | null)[] = method === "llm" ? set.map(() => null) : [...byRules];
  for (let s = 0; s < ask.length; s += 25) {
    const idx = ask.slice(s, s + 25);
    planned.classify += 1;
    if (DRY) continue;
    const r = await llm!.classify(idx.map((i) => set[i]), categories, signal());
    tokens += r.tokens;
    r.value.forEach((g, k) => (out[idx[k]] = g.categoryId));
  }
  return out;
}

function scores(pred: (string | null)[], set: ClassifySet) {
  const truth = set.map((t) => t.categoryId);
  const accuracy = truth.filter((t, i) => pred[i] === t).length / truth.length;
  const perCategory = categories.map((c) => {
    const tp = truth.filter((t, i) => t === c.id && pred[i] === c.id).length;
    const fp = truth.filter((t, i) => t !== c.id && pred[i] === c.id).length;
    const fn = truth.filter((t, i) => t === c.id && pred[i] !== c.id).length;
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return { id: c.id, support: tp + fn, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0 };
  });
  const present = perCategory.filter((c) => c.support > 0);
  return { accuracy, macroF1: present.reduce((s, c) => s + c.f1, 0) / present.length, perCategory };
}

async function classifySection(title: string, set: ClassifySet, methods: Method[], lines: string[]) {
  const preds = new Map<Method, (string | null)[]>();
  for (const m of methods) preds.set(m, await predict(m, set));
  const results = new Map([...preds].map(([m, p]) => [m, scores(p, set)] as const));
  const f1 = (m: Method, id: string) => results.get(m)!.perCategory.find((x) => x.id === id)!;

  lines.push(
    `## ${title} — phân loại (${set.length} giao dịch)`,
    "",
    `| Danh mục | Số mẫu | ${methods.map((m) => `F1 ${label[m]}`).join(" | ")} |`,
    `|---|---:|${methods.map(() => "---:").join("|")}|`,
  );
  for (const c of categories) {
    const support = f1("rules", c.id).support;
    if (support) lines.push(`| ${c.name} | ${support} | ${methods.map((m) => pct(f1(m, c.id).f1)).join(" | ")} |`);
  }
  lines.push(`| **Accuracy** | | ${methods.map((m) => `**${pct(results.get(m)!.accuracy)}**`).join(" | ")} |`);
  lines.push(`| **Macro F1** | | ${methods.map((m) => `**${pct(results.get(m)!.macroF1)}**`).join(" | ")} |`, "");
  for (const m of methods) {
    const wrong = preds.get(m)!.flatMap((p, i) => (p === set[i].categoryId ? [] : [`- “${set[i].description}”: đúng ${name(set[i].categoryId)}, đoán ${name(p)}`]));
    if (wrong.length) lines.push(`<details><summary>${label[m]}: sai ${wrong.length}</summary>`, "", ...wrong, "", "</details>", "");
  }
}

// ───────────── Trích xuất ─────────────

async function extractSection(lines: string[]) {
  const extractors: [string, (text: string) => Promise<{ amount: number | null; type: string; date: string }>][] = [
    ["Bộ parser luật", async (t) => parseQuickEntryText(t, EVAL_TODAY)],
  ];
  if (llm) {
    extractors.push([
      "LLM",
      async (t) => {
        planned.extract += 1;
        if (DRY) return { amount: null, type: "", date: "" };
        const r = await llm.extract(t, { today: EVAL_TODAY }, signal());
        tokens += r.tokens;
        return { amount: r.value.so_tien, type: r.value.loai, date: r.value.ngay };
      },
    ]);
  }
  lines.push(`## Bộ gốc — trích xuất (${EXTRACT_SET.length} câu)`, "", "| Cách | Số tiền | Loại thu/chi | Ngày | Đúng cả 3 |", "|---|---:|---:|---:|---:|");
  for (const [method, run] of extractors) {
    let amount = 0, type = 0, date = 0, all = 0;
    for (const e of EXTRACT_SET) {
      const r = await run(e.text);
      const ok = [r.amount === e.amount, r.type === e.type, r.date === e.date];
      amount += +ok[0];
      type += +ok[1];
      date += +ok[2];
      all += +ok.every(Boolean);
    }
    const n = EXTRACT_SET.length;
    lines.push(`| ${method} | ${pct(amount / n)} | ${pct(type / n)} | ${pct(date / n)} | ${pct(all / n)} |`);
  }
  lines.push("");
}

// ───────────── Chatbot: đúng công cụ + tham số (số liệu do công cụ tính nên đúng công cụ = đúng số liệu) ─────────────

const same = (a: ChatToolCall | null, b: ChatSet[number]["expected"]) =>
  (!a && !b) || (!!a && !!b && a.name === b.name && JSON.stringify(Object.entries(a.args).sort()) === JSON.stringify(Object.entries(b.args).sort()));

async function chatSection(title: string, set: ChatSet, lines: string[]) {
  const choosers: [string, (q: string) => Promise<ChatToolCall | null>][] = [
    [
      "Luật (planQuestion)",
      async (q) => {
        const p = planQuestion(q, { today: EVAL_TODAY, categories });
        return "call" in p ? p.call : null;
      },
    ],
  ];
  if (llm) {
    choosers.push([
      "LLM function calling",
      async (q) => {
        if (isOutOfScope(q)) return null;
        planned.chat += 1;
        if (DRY) return null;
        const r = await llm.chooseTool(q, { today: EVAL_TODAY, categories }, signal());
        tokens += r.tokens;
        return r.value.call;
      },
    ]);
  }
  lines.push(`## ${title} — chatbot (${set.length} câu hỏi)`, "", "| Cách | Đúng công cụ + tham số | Từ chối đúng | Thời gian TB |", "|---|---:|---:|---:|");
  const misses: string[] = [];
  const shouldRefuse = set.filter((c) => !c.expected).length;
  for (const [method, choose] of choosers) {
    let ok = 0, refusedOk = 0, ms = 0;
    for (const c of set) {
      const t0 = performance.now();
      const call = await choose(c.question);
      ms += performance.now() - t0;
      if (same(call, c.expected)) {
        ok += 1;
        if (!c.expected) refusedOk += 1;
      } else misses.push(`- [${method}] “${c.question}” → ${call ? `${call.name}(${JSON.stringify(call.args)})` : "từ chối"}`);
    }
    lines.push(`| ${method} | ${pct(ok / set.length)} | ${refusedOk}/${shouldRefuse} | ${(ms / set.length).toFixed(0)} ms |`);
  }
  lines.push("");
  if (misses.length) lines.push("Câu sai:", "", ...misses, "");
}

async function main() {
  const lines: string[] = [`# Kết quả đánh giá AI — ${new Date().toISOString().slice(0, 10)}`, ""];
  const methods: Method[] = llm ? ["rules", "llm", "hybrid"] : ["rules"];
  if (!llm) lines.push("> Chưa đặt OPENAI_API_KEY nên chỉ chạy cách “chỉ luật”. Đặt khoá để có cột LLM và hybrid.", "");

  await classifySection("Bộ gốc", CLASSIFY_SET, methods, lines);
  await extractSection(lines);
  await chatSection("Bộ gốc", CHAT_SET, lines);
  await classifySection("Bộ giữ riêng (chỉ để đo)", HOLDOUT_CLASSIFY_SET, methods, lines);
  await chatSection("Bộ giữ riêng (chỉ để đo)", HOLDOUT_CHAT_SET, lines);

  if (DRY) {
    console.log(`Dự kiến gọi LLM: ${planned.classify} lần phân loại (≤ 25 dòng/lần), ${planned.extract} lần trích xuất, ${planned.chat} lần chọn công cụ.`);
    return;
  }
  lines.push(`Tổng token đã dùng cho lần chạy này: ${tokens.toLocaleString("vi-VN")}.`);
  const report = lines.join("\n");
  console.log(report);
  if (process.env.EVAL_OUT) writeFileSync(process.env.EVAL_OUT, report);
}

void main();
