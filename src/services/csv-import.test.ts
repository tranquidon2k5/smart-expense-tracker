import { describe, expect, it } from "vitest";
import {
  CsvFormatError,
  checkRows,
  detectDelimiter,
  guessMapping,
  mappingErrors,
  parseCsvText,
  parseVnAmount,
  parseVnDate,
  splitCsv,
  splitDuplicates,
} from "./csv-import";

const TODAY = "2026-10-12";

describe("parseVnDate", () => {
  it.each([
    ["07/10/2026", "2026-10-07"],
    ["7/10/2026", "2026-10-07"],
    ["07-10-2026", "2026-10-07"],
    ["07.10.2026", "2026-10-07"],
    ["07/10/26", "2026-10-07"],
    ["2026-10-07", "2026-10-07"],
    ["07/10/2026 14:32:10", "2026-10-07"],
    ["29/02/2028", "2028-02-29"],
  ])("%s → %s", (input, expected) => expect(parseVnDate(input)).toBe(expected));

  it.each(["31/09/2026", "29/02/2026", "15/13/2026", "hôm qua", "", "2026/10"])("từ chối %s", (input) =>
    expect(parseVnDate(input)).toBeNull(),
  );
});

describe("parseVnAmount", () => {
  it.each([
    ["-45.000", -45000],
    ["45.000", 45000],
    ["1.250.000đ", 1250000],
    ["+15.000.000 VND", 15000000],
    ["45,000", 45000],
    ["(45.000)", -45000],
    ["45000.00", 45000],
    ["1.250.000,50", 1250001],
    ["−52.000", -52000],
    ["300000", 300000],
  ])("%s → %d", (input, expected) => expect(parseVnAmount(input)).toBe(expected));

  it.each(["abc", "", "12/10/2026", "45k", "1.2.3"])("từ chối %s", (input) => expect(parseVnAmount(input)).toBeNull());
});

describe("đọc CSV", () => {
  it("tách ô có ngoặc kép, dấu phẩy và xuống dòng bên trong", () => {
    expect(splitCsv('a,"b, c","d ""x"""\n1,2,3', ",")).toEqual([
      ["a", "b, c", 'd "x"'],
      ["1", "2", "3"],
    ]);
  });

  it("nhận dấu chấm phẩy và tab", () => {
    expect(detectDelimiter("Ngay;So tien;Noi dung\n01/10/2026;-45.000;Pho")).toBe(";");
    expect(detectDelimiter("Ngay\tSo tien\tNoi dung\n01/10/2026\t-45.000\tPho")).toBe("\t");
    // Số tiền có dấu phẩy trong ngoặc kép không làm lệch cột
    expect(detectDelimiter('Ngay,So tien,Noi dung\n01/10/2026,"-45,000",Pho')).toBe(",");
  });

  it("giữ số dòng thật trong file (bỏ BOM, dòng trống)", () => {
    const p = parseCsvText("﻿Ngày,Số tiền,Nội dung\n\n01/10/2026,-45.000,Phở\n02/10/2026,-30.000,Cà phê\n", "a.csv");
    expect(p.hasHeader).toBe(true);
    expect(p.headers).toEqual(["Ngày", "Số tiền", "Nội dung"]);
    expect(p.lineNumbers).toEqual([3, 4]);
  });

  it("file không có dòng tiêu đề → đặt tên Cột 1, Cột 2…", () => {
    const p = parseCsvText("01/10/2026,-45.000,Phở\n02/10/2026,-30.000,Cà phê", "a.csv");
    expect(p.hasHeader).toBe(false);
    expect(p.headers).toEqual(["Cột 1", "Cột 2", "Cột 3"]);
    expect(p.rows).toHaveLength(2);
  });

  it.each([
    ["", /trống/],
    ["Ngày,Số tiền\n01/10/2026,-45.000", /ít nhất 3 cột/],
    ["Ngày,Số tiền,Nội dung\n", /chỉ có dòng tiêu đề/],
    ["PK\u0003\u0004xl/workbook.xml", /không phải dạng văn bản CSV/],
  ])("báo lỗi định dạng rõ ràng (%#)", (text, message) => {
    expect(() => parseCsvText(text, "x.csv")).toThrow(CsvFormatError);
    expect(() => parseCsvText(text, "x.csv")).toThrow(message);
  });
});

describe("đoán cột", () => {
  it("theo tên tiêu đề, không nhầm cột Số dư là Số tiền", () => {
    const p = parseCsvText(
      "Số dư,Ngày giao dịch,Diễn giải,Số tiền\n1.000.000,07/10/2026,GRAB*RIDE 1203,-52.000\n948.000,08/10/2026,Lương,+15.000.000",
      "a.csv",
    );
    expect(guessMapping(p)).toEqual({ mapping: { date: 1, amount: 3, description: 2 }, amountMode: "signed" });
  });

  it("theo nội dung khi không có tiêu đề; toàn số dương → tất cả là chi", () => {
    const p = parseCsvText("PHUC LONG Q1,07/10/2026,55.000\nHIGHLANDS,08/10/2026,65.000", "a.csv");
    expect(guessMapping(p)).toEqual({ mapping: { date: 1, amount: 2, description: 0 }, amountMode: "all_expense" });
  });

  it("báo thiếu cột và cột bị dùng hai lần", () => {
    expect(mappingErrors({ date: 0, amount: null, description: 0 })).toEqual({
      amount: "Chọn cột chứa số tiền",
      date: "Cột này đang dùng cho nội dung",
      description: "Cột này đang dùng cho ngày",
    });
  });
});

describe("kiểm tra từng dòng", () => {
  const p = parseCsvText(
    [
      "Ngày,Số tiền,Nội dung",
      "07/10/2026,-52.000,GRAB*RIDE",
      "31/09/2026,-30.000,Ngày sai",
      "08/10/2026,abc,Số tiền sai",
      "09/10/2026,,Thiếu tiền",
      "10/10/2026,+15.000.000,Lương",
      "20/10/2026,-10.000,Tương lai",
      "11/10/2026,-20.000,",
    ].join("\n"),
    "a.csv",
  );

  it("chỉ rõ dòng lỗi, cột lỗi và giá trị gốc", () => {
    const { candidates, errors } = checkRows(p, { date: 0, amount: 1, description: 2 }, "signed", TODAY);
    expect(candidates.map((c) => [c.line, c.type, c.amount])).toEqual([
      [2, "expense", 52000],
      [6, "income", 15000000],
    ]);
    expect(errors.map((e) => [e.line, e.field, e.value])).toEqual([
      [3, "date", "31/09/2026"],
      [4, "amount", "abc"],
      [5, "amount", ""],
      [7, "date", "20/10/2026"],
      [8, "description", ""],
    ]);
  });

  it("chế độ tất cả là chi bỏ qua dấu", () => {
    const { candidates } = checkRows(p, { date: 0, amount: 1, description: 2 }, "all_expense", TODAY);
    expect(candidates.every((c) => c.type === "expense")).toBe(true);
  });

  it("chưa ánh xạ đủ cột → không đọc dòng nào", () => {
    expect(checkRows(p, { date: 0, amount: null, description: 2 }, "signed", TODAY)).toEqual({ candidates: [], errors: [] });
  });
});

describe("trùng lặp", () => {
  const c = (line: number, date: string, amount: number, description: string) =>
    ({ line, date, amount, type: "expense", description }) as const;

  it("trùng giao dịch đã có (cùng ngày, số tiền, loại), mỗi giao dịch cũ chỉ khớp một dòng", () => {
    const existing = [{ id: "t1", date: "2026-10-05", amount: 30000, type: "expense" as const, description: "Cà phê sữa đá" }];
    const { fresh, duplicates } = splitDuplicates(
      [c(2, "2026-10-05", 30000, "HIGHLANDS"), c(3, "2026-10-05", 30000, "PHUC LONG"), c(4, "2026-10-06", 30000, "X")],
      existing,
    );
    expect(duplicates).toEqual([{ ...c(2, "2026-10-05", 30000, "HIGHLANDS"), reason: "existing", matchId: "t1", matchDescription: "Cà phê sữa đá" }]);
    expect(fresh.map((f) => f.line)).toEqual([3, 4]);
  });

  it("ưu tiên khớp giao dịch cùng nội dung", () => {
    const existing = [
      { id: "a", date: "2026-10-05", amount: 30000, type: "expense" as const, description: "Cà phê" },
      { id: "b", date: "2026-10-05", amount: 30000, type: "expense" as const, description: "GRAB*RIDE 1" },
    ];
    const { duplicates } = splitDuplicates([c(2, "2026-10-05", 30000, "grab*ride 1")], existing);
    expect(duplicates[0].matchId).toBe("b");
  });

  it("dòng lặp lại y hệt trong file", () => {
    const { fresh, duplicates } = splitDuplicates([c(2, "2026-10-05", 98000, "XANH SM"), c(3, "2026-10-05", 98000, "Xanh SM")], []);
    expect(fresh.map((f) => f.line)).toEqual([2]);
    expect(duplicates).toEqual([{ ...c(3, "2026-10-05", 98000, "Xanh SM"), reason: "in_file", matchLine: 2 }]);
  });
});
