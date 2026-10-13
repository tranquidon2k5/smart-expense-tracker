/** Logic thuần dùng chung FE + BE */
import { describe, expect, it } from "vitest";
import { addDays, isoWeekKey, mondayOf, timeIn, todayIn } from "./dates";
import { computeStreaks, levelFromXp, nextMilestone } from "./gamification-rules";
import { classifyByRules, guessWallet, parseQuickEntryText } from "./quick-entry";
import { isOutOfScope, planQuestion } from "./assistant-engine";
import { breakdownFromTotals, comparisonRows } from "./stats";
import { isDeleteConfirmation, validatePassword } from "./validation";

describe("Ngày tháng theo múi giờ", () => {
  it("cùng một thời điểm là hai ngày khác nhau ở UTC+7 và UTC−5", () => {
    const at = new Date("2026-10-13T03:00:00Z");
    expect(todayIn("Asia/Ho_Chi_Minh", at)).toBe("2026-10-13");
    expect(todayIn("America/Bogota", at)).toBe("2026-10-12");
    expect(timeIn("Asia/Ho_Chi_Minh", at)).toBe("10:00");
    expect(timeIn("America/Bogota", at)).toBe("22:00");
  });

  it("tuần ISO và thứ Hai đầu tuần, kể cả giao năm", () => {
    expect(isoWeekKey("2026-10-12")).toBe("2026-W42");
    expect(isoWeekKey("2026-10-18")).toBe("2026-W42");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
    expect(isoWeekKey("2025-12-29")).toBe("2026-W01");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("Quy tắc gamification", () => {
  it("cấp n cần 100 × n XP", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpInLevel: 0, xpForNextLevel: 200 });
    expect(levelFromXp(1_520)).toEqual({ level: 5, xpInLevel: 120, xpForNextLevel: 600 });
  });

  it("ngày đóng băng giữ chuỗi nhưng không cộng; ngày trống làm chuỗi về 0", () => {
    const s = computeStreaks(new Set(["2026-01-01", "2026-01-02", "2026-01-04"]), new Set(["2026-01-03"]), "2026-01-01", "2026-01-04");
    expect(s).toEqual({ current: 3, longest: 3 });
    expect(nextMilestone(13)).toEqual({ days: 14, xp: 150, remaining: 1 });
    expect(nextMilestone(100)).toBeNull();
  });
});

describe("Ghi nhanh bằng luật", () => {
  it("đọc số tiền, ngày, mô tả, thu/chi", () => {
    expect(parseQuickEntryText("lương tháng 9 15tr", "2026-10-12")).toMatchObject({ amount: 15_000_000, type: "income" });
    expect(parseQuickEntryText("grab 1tr2 ngày 5/10", "2026-10-12")).toMatchObject({ amount: 1_200_000, date: "2026-10-05", description: "Grab" });
  });

  it("đoán ví từ tên hoặc viết tắt; không có thì thu → ngân hàng, chi → tiền mặt", () => {
    const wallets = [
      { id: "a", name: "Tiền mặt", type: "cash" as const },
      { id: "b", name: "Vietcombank", type: "bank" as const },
      { id: "c", name: "MoMo", type: "ewallet" as const },
    ];
    expect(guessWallet("cà phê 30k momo", wallets, "expense")?.id).toBe("c");
    expect(guessWallet("chuyển vcb 1tr", wallets, "expense")?.id).toBe("b");
    expect(guessWallet("lương 15tr", wallets, "income")?.id).toBe("b");
    expect(guessWallet("phở 45k", wallets, "expense")?.id).toBe("a");
  });
});

describe("Thống kê", () => {
  const cats = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, name: id.toUpperCase(), color: "#000000" }));

  it("quá 5 lát thì gộp đuôi vào “Khác”", () => {
    const b = breakdownFromTotals(cats.map((c, i) => [c.id, 100 - i * 10] as const), cats, "2026-10");
    expect(b.slices.map((s) => s.name)).toEqual(["A", "B", "C", "D", "Khác"]);
    expect(b.slices.reduce((s, x) => s + x.amount, 0)).toBe(b.total);
  });

  it("so sánh hai tháng: tổng các dòng bằng tổng chi", () => {
    const rows = comparisonRows(cats.map((c, i) => [c.id, { a: i * 10, b: 5 }] as const), cats, 3);
    expect(rows.at(-1)!.name).toBe("Khác");
    expect(rows.reduce((s, r) => s + r.amountB, 0)).toBe(30);
  });
});

describe("Kiểm tra tài khoản", () => {
  it("mật khẩu ≥ 8 ký tự, có chữ và số, tối đa 72; cụm xác nhận xoá chấp nhận có/không dấu", () => {
    expect(validatePassword("abc12345")).toBeNull();
    expect(validatePassword("abcdefgh")).toBe("Mật khẩu cần: có chữ số");
    expect(validatePassword(`a1${"x".repeat(80)}`)).toMatch(/tối đa/);
    expect(isDeleteConfirmation("XÓA DỮ LIỆU")).toBe(true);
    expect(isDeleteConfirmation("xoa  du lieu")).toBe(true);
    expect(isDeleteConfirmation("xoa")).toBe(false);
  });
});

describe("Luật mặc định không bắt nhầm", () => {
  const cats = ["c-food", "c-move", "c-study", "c-fun", "c-shop", "c-bill", "c-health", "c-other", "c-salary", "c-bonus"].map((id) => ({
    id,
    type: id === "c-salary" || id === "c-bonus" ? ("income" as const) : ("expense" as const),
  }));
  const cat = (text: string) => classifyByRules(text, { categories: cats, userRules: [] }).category?.id ?? null;

  it.each([
    ["GRAB*FOOD 3021 HCM", "c-food"],
    ["SHOPEEFOOD*DON 88123", "c-food"],
    ["GRAB*RIDE 8812 HCM", "c-move"],
    ["NETFLIX.COM", "c-fun"],
    ["Phí quản lý chung cư", null],
    ["Điện máy xanh nồi cơm", null],
    ["Kệ sách IKEA", null],
    ["Cơm văn phòng", "c-food"],
    ["Quần kaki Uniqlo", "c-shop"],
    ["Mua sách Fahasa", "c-study"],
  ])("“%s” → %s", (text, expected) => {
    expect(cat(text)).toBe(expected);
  });
});

describe("Phạm vi câu hỏi trợ lý", () => {
  it("“giao dịch”, “như vậy” không bị coi là ngoài phạm vi; đầu tư, vay tiền, dịch thuật thì có", () => {
    expect(isOutOfScope("Top 10 giao dịch lớn nhất tháng 8")).toBe(false);
    expect(isOutOfScope("Chi như vậy có nhiều không?")).toBe(false);
    expect(isOutOfScope("Có nên vay tiền mua xe không?")).toBe(true);
    expect(isOutOfScope("Dịch giúp mình câu này sang tiếng Anh")).toBe(true);
  });

  it("top N lấy đúng N (tối đa 20)", () => {
    const plan = planQuestion("Top 10 giao dịch lớn nhất tháng 8", { today: "2026-10-12", categories: [] });
    expect(plan).toEqual({ call: { name: "top_khoan_chi", args: { thang: "2026-08", so_luong: 10 } } });
    const top = planQuestion("Top 7 tháng này", { today: "2026-10-12", categories: [] });
    expect(top).toMatchObject({ call: { args: { so_luong: 7 } } });
  });
});
