import { describe, expect, it } from "vitest";
import type { TransactionStatus, TransactionType } from "@/types";
import { extractKeyword, matchesKeyword, planRuleApplication } from "./rules";

describe("extractKeyword", () => {
  it("giữ phần dịch vụ sau dấu * để tách GRAB*RIDE và GRAB*FOOD", () => {
    expect(extractKeyword("GRAB*RIDE 8812 HCM")).toBe("GRAB*RIDE");
    expect(extractKeyword("GRAB*FOOD 3021 HCM")).toBe("GRAB*FOOD");
    expect(extractKeyword("GRAB*RIDE 8812 HCM")).not.toBe(extractKeyword("GRAB*FOOD 3021 HCM"));
  });

  it("bỏ tiền tố cổng thanh toán, lấy tên cửa hàng", () => {
    expect(extractKeyword("VNPAY*BHX 0021 Q3")).toBe("BHX");
  });

  it("chỉ lấy merchant khi phần sau dấu * là mã số", () => {
    expect(extractKeyword("GRAB*8812 HCM")).toBe("GRAB");
  });

  it("lấy từ đặc trưng đầu tiên cho nội dung thường", () => {
    expect(extractKeyword("HIGHLANDS CF NGUYEN HUE")).toBe("HIGHLANDS");
  });

  it("lấy họ tên người nhận cho chuyển khoản", () => {
    expect(extractKeyword("CK NGUYEN VAN A chuyen tien")).toBe("NGUYEN VAN A");
  });

  it("trả rỗng khi không có từ đủ đặc trưng", () => {
    expect(extractKeyword("THANH TOAN QR 0912XXX")).toBe("");
    expect(extractKeyword("MOMO*NAP TIEN DT 0903")).toBe("");
  });
});

describe("matchesKeyword", () => {
  it("GRAB*RIDE không khớp GRAB*FOOD", () => {
    expect(matchesKeyword("GRAB*RIDE 8812 HCM", "GRAB*RIDE")).toBe(true);
    expect(matchesKeyword("GRAB*FOOD 3021 HCM", "GRAB*RIDE")).toBe(false);
  });

  it("từ khoá ngắn GRAB khớp cả hai", () => {
    expect(matchesKeyword("GRAB*RIDE 8812 HCM", "GRAB")).toBe(true);
    expect(matchesKeyword("GRAB*FOOD 3021 HCM", "GRAB")).toBe(true);
  });

  it("không phân biệt hoa thường và dấu", () => {
    expect(matchesKeyword("Trà sữa Phúc Long", "PHUC LONG")).toBe(true);
    expect(matchesKeyword("grab*ride 1", "GRAB*RIDE")).toBe(true);
  });

  it("từ khoá rỗng không khớp gì", () => {
    expect(matchesKeyword("GRAB*RIDE", "   ")).toBe(false);
  });
});

describe("planRuleApplication", () => {
  const tx = (id: string, description: string, categoryId: string, type: TransactionType = "expense", status: TransactionStatus = "pending") => ({
    id,
    description,
    categoryId,
    type,
    status,
  });
  const diChuyen = { id: "c-move", type: "expense" as const };

  const pending = [
    tx("t1", "GRAB*RIDE 8812 HCM", "c-food"), // giao dịch đang duyệt
    tx("t2", "GRAB*RIDE 1203 HCM", "c-food"), // cùng loại chuyến xe, AI đoán sai
    tx("t3", "GRAB*RIDE 5550 HN", "c-move"), // đã đúng danh mục
    tx("t4", "GRAB*FOOD 3021 HCM", "c-food"), // đồ ăn — không được đụng tới
    tx("t5", "GRAB*RIDE HOAN TIEN", "c-income-other", "income"), // khác loại thu/chi
    tx("t6", "GRAB*RIDE 9999 HCM", "c-food", "expense", "confirmed"), // đã duyệt
  ];

  it("từ khoá GRAB*RIDE chỉ chạm giao dịch chuyến xe, không chạm GRAB*FOOD", () => {
    const ids = planRuleApplication(pending, "GRAB*RIDE", diChuyen, "t1").map((p) => p.transaction.id);
    expect(ids).toEqual(["t2", "t3", "t5"]);
    expect(ids).not.toContain("t4");
  });

  it("bỏ qua giao dịch đang duyệt và giao dịch đã xác nhận", () => {
    const ids = planRuleApplication(pending, "GRAB*RIDE", diChuyen, "t1").map((p) => p.transaction.id);
    expect(ids).not.toContain("t1");
    expect(ids).not.toContain("t6");
  });

  it("cảnh báo giao dịch đang thuộc danh mục khác lựa chọn của người dùng", () => {
    const plan = planRuleApplication(pending, "GRAB*RIDE", diChuyen, "t1");
    const byId = Object.fromEntries(plan.map((p) => [p.transaction.id, p]));
    expect(byId.t2.conflict).toBe(true); // Ăn uống → Di chuyển
    expect(byId.t3.conflict).toBe(false); // đã là Di chuyển
  });

  it("đánh dấu khác loại thu/chi, không coi là xung đột", () => {
    const t5 = planRuleApplication(pending, "GRAB*RIDE", diChuyen, "t1").find((p) => p.transaction.id === "t5")!;
    expect(t5.typeMismatch).toBe(true);
    expect(t5.conflict).toBe(false);
  });

  it("từ khoá quá chung (GRAB) kéo cả GRAB*FOOD vào và bị cảnh báo xung đột", () => {
    const t4 = planRuleApplication(pending, "GRAB", diChuyen, "t1").find((p) => p.transaction.id === "t4");
    expect(t4).toBeDefined();
    expect(t4!.conflict).toBe(true);
  });
});
