import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { OpenAiProvider, RuleOnlyProvider } from "./llm.provider";

/** Máy chủ giả theo định dạng Chat Completions — kiểm tra request gửi đi và cách đọc kết quả */
let server: Server;
let baseURL: string;
const requests: Record<string, any>[] = [];
let nextReply: Record<string, any> = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      requests.push({ path: req.url, auth: req.headers.authorization, ...JSON.parse(body) });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "m", usage: { total_tokens: 321 }, ...nextReply }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const signal = new AbortController().signal;
const categories: Category[] = [
  { id: "c-food", userId: null, name: "Ăn uống", type: "expense", icon: "Utensils", color: "#2563EB" },
  { id: "c-salary", userId: null, name: "Lương", type: "income", icon: "Briefcase", color: "#15803D" },
];
const reply = (message: Record<string, unknown>) => ({ choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", ...message } }] });

describe("OpenAiProvider", () => {
  it("extract: structured output theo JSON schema strict, đọc kết quả và số token", async () => {
    const p = new OpenAiProvider("sk-test", "gpt-test", baseURL);
    nextReply = reply({ content: JSON.stringify({ so_tien: 45000, loai: "expense", ngay: "2026-10-12", mo_ta: "Phở" }) });
    const r = await p.extract("ăn phở 45k", { today: "2026-10-12" }, signal);
    expect(r).toEqual({ value: { so_tien: 45000, loai: "expense", ngay: "2026-10-12", mo_ta: "Phở" }, tokens: 321 });
    const req = requests.at(-1)!;
    expect(req.path).toBe("/v1/chat/completions");
    expect(req.auth).toBe("Bearer sk-test");
    expect(req.model).toBe("gpt-test");
    expect(req.response_format.type).toBe("json_schema");
    expect(req.response_format.json_schema.strict).toBe(true);
    expect(req.messages[0].content).toMatch(/Hôm nay là 2026-10-12/);
  });

  it("classify: gộp nhiều dòng trong một request; bỏ danh mục bịa ra hoặc sai loại thu/chi", async () => {
    const p = new OpenAiProvider("sk-test", "gpt-test", baseURL);
    nextReply = reply({
      content: JSON.stringify({
        ket_qua: [
          { stt: 1, category_id: "c-food", do_tin_cay: 0.9 },
          { stt: 2, category_id: "c-bia", do_tin_cay: 0.99 },
          { stt: 3, category_id: "c-salary", do_tin_cay: 0.8 },
        ],
      }),
    });
    const r = await p.classify(
      [{ description: "BUN CHA", type: "expense" }, { description: "ABC" }, { description: "XYZ", type: "expense" }],
      categories,
      signal,
    );
    expect(r.value).toEqual([
      { categoryId: "c-food", confidence: 0.9 },
      { categoryId: null, confidence: 0.45 },
      { categoryId: null, confidence: 0.45 },
    ]);
    expect(requests.at(-1)!.messages[1].content).toMatch(/Phân loại 3 giao dịch/);
  });

  it("chooseTool: gửi 6 công cụ function calling; đọc tên + tham số công cụ LLM chọn", async () => {
    const p = new OpenAiProvider("sk-test", "gpt-test", baseURL);
    nextReply = reply({
      content: null,
      tool_calls: [{ id: "call_1", type: "function", function: { name: "tong_thu_chi_thang", arguments: '{"thang":"2026-09"}' } }],
    });
    const r = await p.chooseTool("Tháng 9 thu chi thế nào?", { today: "2026-10-12", categories }, signal);
    expect(r.value.call).toEqual({ name: "tong_thu_chi_thang", args: { thang: "2026-09" } });
    const req = requests.at(-1)!;
    expect(req.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual([
      "tong_theo_danh_muc",
      "so_sanh_hai_thang",
      "tong_thu_chi_thang",
      "chi_theo_danh_muc",
      "top_khoan_chi",
      "tinh_trang_ngan_sach",
    ]);

    nextReply = reply({ content: "NGOAI_PHAM_VI" });
    expect((await p.chooseTool("Thời tiết mai thế nào?", { today: "2026-10-12", categories }, signal)).value.call).toBeNull();
  });
});

describe("RuleOnlyProvider (dự phòng khi không có khoá API)", () => {
  it("trích xuất bằng bộ parser luật; đoán danh mục theo từ khoá gợi ý với độ tin cậy thấp", async () => {
    const p = new RuleOnlyProvider();
    expect((await p.extract("hôm qua ăn phở 45k", { today: "2026-10-12" })).value).toEqual({
      so_tien: 45000,
      loai: "expense",
      ngay: "2026-10-11",
      mo_ta: "Ăn phở",
    });
    const r = await p.classify([{ description: "WINMART+ 112 LE LOI", type: "expense" }, { description: "ABC" }], categories);
    expect(r.value).toEqual([
      { categoryId: "c-food", confidence: 0.62 },
      { categoryId: null, confidence: 0.45 },
    ]);
    expect(r.tokens).toBe(0);
  });
});
