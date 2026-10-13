/**
 * Giai đoạn 5: ghi nhanh có LLM, phân loại hybrid, chatbot function calling.
 * LlmProvider được thay bằng bản giả để test chạy ổn định, không gọi API thật.
 */
import type TestAgent from "supertest/lib/agent";
import { answerQuestion, planQuestion } from "@shared/assistant-engine";
import { guessMapping } from "@shared/csv-import";
import type { Category, ChatToolCall } from "@shared/types";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { ClassifyGuess, ClassifyItem, ExtractedEntry, LlmProvider, LlmResult, ToolChoice } from "../src/ai/llm.provider";
import { ChatService } from "../src/chat/chat.service";
import { toBudget, toCategory, toTransaction } from "../src/common/mappers";
import { LAN_EMAIL, TODAY, celebrations, createTestApp, sampleCsv, totalXp, type TestContext } from "./helpers";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** LLM giả: mặc định cư xử như bộ luật, từng test đổi hành vi khi cần */
class FakeLlm implements LlmProvider {
  readonly name = "openai" as const;
  calls: { method: string; payload: unknown }[] = [];
  extractImpl: (text: string) => Promise<ExtractedEntry> = async () => {
    throw new Error("chưa cấu hình");
  };
  classifyImpl: (items: ClassifyItem[], categories: Category[]) => ClassifyGuess[] = (items) => items.map(() => ({ categoryId: null, confidence: 0.3 }));
  toolImpl: (question: string, ctx: { today: string; categories: Category[] }) => Promise<ChatToolCall | null> = async (q, ctx) => {
    const p = planQuestion(q, ctx);
    return "call" in p ? p.call : null;
  };

  reset() {
    this.calls = [];
    this.extractImpl = async () => {
      throw new Error("chưa cấu hình");
    };
    this.classifyImpl = (items) => items.map(() => ({ categoryId: null, confidence: 0.3 }));
    this.toolImpl = async (q, ctx) => {
      const p = planQuestion(q, ctx);
      return "call" in p ? p.call : null;
    };
  }

  async extract(text: string): Promise<LlmResult<ExtractedEntry>> {
    this.calls.push({ method: "extract", payload: text });
    return { value: await this.extractImpl(text), tokens: 120 };
  }
  async classify(items: ClassifyItem[], categories: Category[]): Promise<LlmResult<ClassifyGuess[]>> {
    this.calls.push({ method: "classify", payload: { items, categories } });
    return { value: this.classifyImpl(items, categories), tokens: 200 };
  }
  async chooseTool(question: string, ctx: { today: string; categories: Category[] }): Promise<LlmResult<ToolChoice>> {
    this.calls.push({ method: "chooseTool", payload: question });
    return { value: { call: await this.toolImpl(question, ctx) }, tokens: 90 };
  }
}

const llm = new FakeLlm();
let t: TestContext;
let lan: TestAgent;
beforeAll(async () => {
  t = await createTestApp({ provider: llm });
});
beforeEach(async () => {
  await t.reset();
  llm.reset();
  lan = await t.as(LAN_EMAIL);
});
afterAll(() => t.close());

describe("Ghi nhanh (F07)", () => {
  it("LLM trích xuất có cấu trúc; luật phân loại khớp → ghi thẳng; ai_logs ghi token và độ trễ", async () => {
    llm.extractImpl = async () => ({ so_tien: 45_000, loai: "expense", ngay: "2026-10-11", mo_ta: "Phở bò tái" });
    const preview = (await lan.post("/api/ai/quick-entry/parse").send({ text: "hôm qua ăn phở bò tái 45 nghìn" }).expect(200)).body;
    expect(preview).toMatchObject({ amount: 45_000, type: "expense", date: "2026-10-11", description: "Phở bò tái", categoryId: "c-food", walletId: "w-cash" });
    expect(preview.confidence).toBeGreaterThanOrEqual(0.95);
    const log = await t.prisma.aiLog.findFirstOrThrow({ where: { userId: "u-lan", feature: "extract" } });
    expect(log).toMatchObject({ success: true, tokens: 120 });

    const saved = (await lan.post("/api/ai/quick-entry").send(preview).expect(201)).body;
    expect(saved.transaction).toMatchObject({ source: "nlp", status: "confirmed", amount: 45_000 });
  });

  it("LLM quá 600ms → dùng kết quả bộ parser luật, độ tin cậy thấp để người dùng xem lại", async () => {
    llm.extractImpl = async () => {
      await sleep(2000);
      return { so_tien: 1, loai: "income", ngay: TODAY, mo_ta: "sai" };
    };
    const started = Date.now();
    const preview = (await lan.post("/api/ai/quick-entry/parse").send({ text: "ăn phở 45k" }).expect(200)).body;
    expect(Date.now() - started).toBeLessThan(1800);
    expect(preview).toMatchObject({ amount: 45_000, type: "expense", date: TODAY, categoryId: "c-food" });
    expect(preview.confidence).toBeLessThan(0.7);
    const log = await t.prisma.aiLog.findFirstOrThrow({ where: { feature: "extract" } });
    expect(log.success).toBe(false);
  });

  it("luật không khớp → LLM đoán danh mục; < 0,7 vào hàng chờ duyệt, ≥ 0,7 ghi thẳng", async () => {
    llm.extractImpl = async () => ({ so_tien: 120_000, loai: "expense", ngay: TODAY, mo_ta: "Thanh toán VNPAY cửa hàng XYZ" });
    llm.classifyImpl = (items) => items.map(() => ({ categoryId: "c-shop", confidence: 0.82 }));
    const sure = (await lan.post("/api/ai/quick-entry/parse").send({ text: "vnpay cua hang xyz 120k" }).expect(200)).body;
    expect(sure).toMatchObject({ categoryId: "c-shop", confidence: 0.82 });
    expect((await lan.post("/api/ai/quick-entry").send(sure).expect(201)).body.transaction.status).toBe("confirmed");

    llm.classifyImpl = (items) => items.map(() => ({ categoryId: "c-shop", confidence: 0.55 }));
    const unsure = (await lan.post("/api/ai/quick-entry/parse").send({ text: "vnpay cua hang xyz 120k" }).expect(200)).body;
    expect((await lan.post("/api/ai/quick-entry").send(unsure).expect(201)).body.transaction.status).toBe("pending");
  });

  it("LLM trả danh mục không có trong danh sách hoặc sai loại → bỏ qua", async () => {
    llm.extractImpl = async () => ({ so_tien: 50_000, loai: "expense", ngay: TODAY, mo_ta: "Abc" });
    llm.classifyImpl = (items) => items.map(() => ({ categoryId: "c-khong-co", confidence: 0.99 }));
    const p = (await lan.post("/api/ai/quick-entry/parse").send({ text: "abc 50k" }).expect(200)).body;
    expect(p.categoryId).toBe("c-other");
    expect(p.confidence).toBeLessThan(0.7);
  });

  it("quyền riêng tư: không gửi họ tên hay email người dùng cho LLM", async () => {
    llm.extractImpl = async () => ({ so_tien: 30_000, loai: "expense", ngay: TODAY, mo_ta: "Cà phê" });
    await lan.post("/api/ai/quick-entry/parse").send({ text: "cà phê 30k với bạn" }).expect(200);
    await lan.post("/api/chat/ask").send({ question: "Tháng này tiêu ăn uống bao nhiêu?" }).expect(201);
    const sent = JSON.stringify(llm.calls);
    expect(sent).not.toMatch(/lan\.nguyen|Nguyễn Thị Lan/);
  });

  it("câu rỗng / số tiền chưa có → báo lỗi gắn đúng ô", async () => {
    expect((await lan.post("/api/ai/quick-entry/parse").send({ text: "   " }).expect(400)).body.field).toBe("text");
    const bad = { rawText: "x", amount: null, type: "expense", date: TODAY, description: "x", categoryId: "c-food", confidence: 0.9, walletId: "w-cash" };
    expect((await lan.post("/api/ai/quick-entry").send(bad).expect(400)).body.field).toBe("amount");
  });
});

describe("Phân loại hybrid khi nhập CSV (F08)", () => {
  it("luật trước, LLM sau — gộp các dòng chưa phân loại vào một request", async () => {
    llm.classifyImpl = (items) =>
      items.map((it) => (/WINMART/.test(it.description) ? { categoryId: "c-food", confidence: 0.75 } : { categoryId: null, confidence: 0.3 }));
    const parsed = sampleCsv("sao-ke-techcombank-10-2026.csv");
    const { mapping, amountMode } = guessMapping(parsed);
    const result = (await lan.post("/api/import/csv").send({ file: parsed, mapping, amountMode, walletId: "w-tcb" }).expect(201)).body;
    const classifyCalls = llm.calls.filter((c) => c.method === "classify");
    expect(classifyCalls).toHaveLength(1);
    const sentRows = (classifyCalls[0].payload as { items: ClassifyItem[] }).items;
    // Dòng đã khớp luật (PHUC LONG, SHOPEE…) không gửi cho LLM
    expect(sentRows.some((r) => /PHUC LONG/.test(r.description))).toBe(false);
    const winmart = result.created.find((x: { description: string }) => /WINMART/.test(x.description));
    expect(winmart).toMatchObject({ categoryId: "c-food", status: "confirmed", aiConfidence: 0.75 });
  });
});

describe("Trợ lý AI (F10, Luồng 3)", () => {
  /** Engine chạy trên toàn bộ dữ liệu của Lan trong DB — đáp án chuẩn để so với công cụ SQL */
  async function engineAnswer(question: string) {
    const [transactions, categories, budgets] = await Promise.all([
      t.prisma.transaction.findMany({ where: { userId: "u-lan" }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
      t.prisma.category.findMany({ where: { OR: [{ userId: null }, { userId: "u-lan" }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
      t.prisma.budget.findMany({ where: { userId: "u-lan" } }),
    ]);
    return answerQuestion(question, {
      transactions: transactions.map(toTransaction),
      categories: categories.map(toCategory),
      budgets: budgets.map(toBudget),
      today: TODAY,
    });
  }

  it.each([
    "Tháng này tiêu ăn uống bao nhiêu?",
    "So sánh tháng 9 với tháng 8",
    "So sánh ăn uống tháng 9 với tháng 8",
    "Tháng này mình chi nhiều nhất vào đâu?",
    "5 khoản chi lớn nhất tháng 9",
    "3 khoản chi lớn nhất tháng này",
    "Ngân sách tháng này thế nào?",
    "Tháng 8 tổng thu chi thế nào?",
    "Tháng 7 nhận lương bao nhiêu?",
    "Tháng 3 tiêu bao nhiêu?",
  ])("công cụ SQL ra cùng kết quả với engine: “%s”", async (question) => {
    const chat = t.app.get(ChatService);
    const plan = planQuestion(question, { today: TODAY, categories: (await t.prisma.category.findMany()).map(toCategory) });
    expect("call" in plan).toBe(true);
    const viaSql = await chat.runToolFor("u-lan", (plan as { call: ChatToolCall }).call, TODAY);
    expect(viaSql).toEqual(await engineAnswer(question));
  });

  it("hỏi → lưu hội thoại, số liệu và giao dịch nguồn lấy từ truy vấn (không phải LLM)", async () => {
    // LLM chọn công cụ bằng function calling với tham số của nó
    llm.toolImpl = async () => ({ name: "tong_theo_danh_muc", args: { danh_muc: "Ăn uống", thang: "2026-09" } });
    const res = (await lan.post("/api/chat/ask").send({ conversationId: null, question: "Tiền ăn tháng trước?" }).expect(201)).body;
    const expected = await engineAnswer("Tháng 9 mình tiêu ăn uống bao nhiêu?");
    expect(res.assistantMessage).toMatchObject({ content: expected.content, sourceIds: expected.sourceIds, refused: false });
    expect(res.assistantMessage.toolCalls).toEqual([{ name: "tong_theo_danh_muc", args: { danh_muc: "Ăn uống", thang: "2026-09" } }]);
    expect(res.conversation.messages).toHaveLength(2);

    const sources = (await lan.post("/api/chat/sources").send({ ids: res.assistantMessage.sourceIds.slice(0, 3) }).expect(200)).body;
    expect(sources).toHaveLength(3);
    expect(sources[0].category.name).toBe("Ăn uống");

    const follow = (await lan.post("/api/chat/ask").send({ conversationId: res.conversation.id, question: "Còn tháng 8?" }).expect(201)).body;
    expect(follow.conversation.messages).toHaveLength(4);
    const list = (await lan.get("/api/chat/conversations").expect(200)).body;
    expect(list[0]).toMatchObject({ id: res.conversation.id, questionCount: 2 });
  });

  it("câu ngoài phạm vi bị từ chối trước khi gọi LLM, không tính nhiệm vụ", async () => {
    const res = (await lan.post("/api/chat/ask").send({ question: "Có nên mua cổ phiếu FPT không?" }).expect(201)).body;
    expect(res.assistantMessage.refused).toBe(true);
    expect(res.assistantMessage.toolCalls).toEqual([]);
    expect(llm.calls.filter((c) => c.method === "chooseTool")).toHaveLength(0);
    const m = await t.prisma.userMission.findFirst({ where: { userId: "u-lan", mission: { code: "DAILY_ASK_CHAT" }, periodKey: TODAY } });
    expect(m?.progress ?? 0).toBe(0);
  });

  it("LLM không chọn công cụ → từ chối nhẹ nhàng, gợi ý câu hỏi mẫu", async () => {
    llm.toolImpl = async () => null;
    const res = (await lan.post("/api/chat/ask").send({ question: "Kể chuyện cười đi" }).expect(201)).body;
    expect(res.assistantMessage.refused).toBe(true);
    expect(res.assistantMessage.content).toMatch(/Tháng này tiêu ăn uống bao nhiêu/);
  });

  it("quá 300 ký tự → 400; quá thời gian → 504 và không lưu gì", async () => {
    await lan.post("/api/chat/ask").send({ question: "a".repeat(301) }).expect(400);
    llm.toolImpl = async () => {
      await sleep(3000);
      return null;
    };
    const before = await t.prisma.chatMessage.count();
    const res = await lan.post("/api/chat/ask").send({ question: "Tháng này tiêu bao nhiêu?" }).expect(504);
    expect(res.body.message).toMatch(/quá 5 giây/);
    expect(await t.prisma.chatMessage.count()).toBe(before);
  });

  it("câu hỏi thứ 10 mở huy hiệu “Trò chuyện cùng AI” và hoàn thành nhiệm vụ hỏi trợ lý", async () => {
    const xp0 = await totalXp(t.prisma, "u-lan");
    const res = await lan.post("/api/chat/ask").send({ question: "Tháng này tiêu ăn uống bao nhiêu?" }).expect(201);
    const kinds = celebrations(res).map((c) => c.kind);
    expect(kinds).toContain("badge");
    expect(kinds).toContain("mission");
    expect(await t.prisma.userBadge.count({ where: { userId: "u-lan", badgeId: "bd-chat10" } })).toBe(1);
    expect(await totalXp(t.prisma, "u-lan")).toBe(xp0 + 20);
  });
});
