import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerQuestion, parseMonths, type EngineContext } from "./assistant-engine";
import * as chatService from "./chat.service";
import * as db from "./mock/db";
import { onCelebrate, type Celebration } from "./events";

const ctx = (): EngineContext => ({ transactions: db.transactions, categories: db.categories, budgets: db.budgets, today: db.MOCK_TODAY });
const confirmedIn = (month: string) => db.transactions.filter((t) => t.status === "confirmed" && t.date.startsWith(month));
const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(n)}đ`;

describe("assistant-engine — số liệu tính từ dữ liệu, không bịa", () => {
  it("“Tháng này tiêu ăn uống bao nhiêu?” → gọi tong_theo_danh_muc, tổng khớp dữ liệu", () => {
    const a = answerQuestion("Tháng này tiêu ăn uống bao nhiêu?", ctx());
    const list = confirmedIn("2026-10").filter((t) => t.categoryId === "c-food");
    const total = list.reduce((s, t) => s + t.amount, 0);
    expect(a.refused).toBe(false);
    expect(a.toolCalls).toEqual([{ name: "tong_theo_danh_muc", args: { danh_muc: "Ăn uống", thang: "2026-10" } }]);
    expect(a.content).toContain(vnd(total));
    expect(a.content).toContain(`${list.length} giao dịch`);
    expect(new Set(a.sourceIds)).toEqual(new Set(list.map((t) => t.id)));
  });

  it("“So sánh tháng 9 với tháng 8” → so_sanh_hai_thang với tổng chi từng tháng", () => {
    const a = answerQuestion("So sánh tháng 9 với tháng 8", ctx());
    const chi = (m: string) => confirmedIn(m).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    expect(a.toolCalls[0]).toEqual({ name: "so_sanh_hai_thang", args: { danh_muc: null, thang_a: "2026-09", thang_b: "2026-08" } });
    expect(a.content).toContain(vnd(chi("2026-09")));
    expect(a.content).toContain(vnd(chi("2026-08")));
    expect(a.content).toContain(vnd(Math.abs(chi("2026-09") - chi("2026-08"))));
  });

  it("không tính giao dịch chờ duyệt và nói rõ điều đó", () => {
    const a = answerQuestion("Tháng này tiêu ăn uống bao nhiêu?", ctx());
    const pending = db.transactions.filter((t) => t.status === "pending" && t.categoryId === "c-food" && t.date.startsWith("2026-10"));
    expect(pending.length).toBeGreaterThan(0);
    expect(a.content).toContain(`Chưa tính ${pending.length} giao dịch đang chờ duyệt`);
    for (const p of pending) expect(a.sourceIds).not.toContain(p.id);
  });

  it("top khoản chi lấy đúng N khoản lớn nhất", () => {
    const a = answerQuestion("5 khoản chi lớn nhất tháng 9", ctx());
    const top = confirmedIn("2026-09").filter((t) => t.type === "expense").sort((x, y) => y.amount - x.amount).slice(0, 5);
    expect(a.toolCalls[0].name).toBe("top_khoan_chi");
    expect(a.sourceIds).toEqual(top.map((t) => t.id));
  });

  it("tháng chưa có dữ liệu thì nói chưa có, không bịa số", () => {
    const a = answerQuestion("Tháng 2 mình tiêu ăn uống bao nhiêu?", ctx());
    expect(a.content).toMatch(/chưa có giao dịch nào/);
    expect(a.sourceIds).toEqual([]);
  });

  it.each([
    "Có nên mua cổ phiếu ngân hàng không?",
    "Thời tiết hôm nay thế nào?",
    "Viết giúp mình bài thơ",
  ])("từ chối nhẹ nhàng câu ngoài phạm vi: %s", (q) => {
    const a = answerQuestion(q, ctx());
    expect(a.refused).toBe(true);
    expect(a.toolCalls).toEqual([]);
    expect(a.content).toMatch(/Bạn thử hỏi/);
  });

  it("hiểu “tháng này / tháng trước / tháng 11 (năm trước)”", () => {
    expect(parseMonths(" thang nay ", "2026-10-12")).toEqual(["2026-10"]);
    expect(parseMonths(" thang truoc ", "2026-10-12")).toEqual(["2026-09"]);
    expect(parseMonths(" thang 11 ", "2026-10-12")).toEqual(["2025-11"]);
  });
});

describe("chatService — nhiệm vụ, huy hiệu, quá thời gian", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("câu hỏi đầu tiên hoàn thành nhiệm vụ “Hỏi trợ lý AI 1 câu” (+20 XP) và mở huy hiệu 10 câu", async () => {
    const events: Celebration[] = [];
    const off = onCelebrate((c) => events.push(c));
    const xpBefore = db.level.totalXp;
    const p = chatService.ask(null, "Tháng này tiêu ăn uống bao nhiêu?");
    await vi.runAllTimersAsync();
    const r = await p;
    off();

    expect(r.assistantMessage.refused).toBe(false);
    expect(db.userMissions.find((m) => m.missionId === "m-d-chat")!.progress).toBe(1);
    expect(db.level.totalXp - xpBefore).toBe(20);
    expect(events.map((e) => e.kind)).toEqual(["mission", "badge"]);
    expect(db.userBadges.some((b) => b.badgeId === "bd-chat10")).toBe(true);
  });

  it("câu bị từ chối không tính vào nhiệm vụ / huy hiệu", async () => {
    const before = db.session.chatQuestions;
    const p = chatService.ask(null, "Có nên đầu tư bitcoin không?");
    await vi.runAllTimersAsync();
    const r = await p;
    expect(r.assistantMessage.refused).toBe(true);
    expect(db.session.chatQuestions).toBe(before);
  });

  it("quá 5 giây thì báo ChatTimeoutError và không lưu câu hỏi", async () => {
    vi.stubGlobal("window", { location: { search: "?demo=slow" } });
    const countBefore = (await (async () => {
      const p = chatService.listConversations();
      await vi.runAllTimersAsync();
      return p;
    })()).length;
    const p = chatService.ask(null, "Tháng này tiêu ăn uống bao nhiêu?");
    const assertion = expect(p).rejects.toBeInstanceOf(chatService.ChatTimeoutError);
    await vi.advanceTimersByTimeAsync(chatService.CHAT_TIMEOUT_MS + 10);
    await assertion;
    const list = chatService.listConversations();
    await vi.runAllTimersAsync();
    expect((await list).length).toBe(countBefore);
  });
});
