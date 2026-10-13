/**
 * Bộ dữ liệu đánh giá AI (PRD §11.1), gán nhãn thủ công. Trộn có dấu / không dấu / viết tắt /
 * nội dung sao kê và chuyển khoản. "Hôm nay" của bộ dữ liệu: 12/10/2026.
 */
import type { TransactionType } from "@shared/types";

export const EVAL_TODAY = "2026-10-12";

type Row = [description: string, categoryId: string];

const rows = (categoryId: string, list: string[]): Row[] => list.map((d) => [d, categoryId]);

/** 180 giao dịch: mô tả → danh mục đúng */
export const CLASSIFY_SET: { description: string; type: TransactionType; categoryId: string }[] = [
  ...rows("c-food", [
    "Phở bò tái Nam Định", "pho bo ha noi", "Bún chả Hàng Mành", "bun cha", "Cơm tấm sườn bì", "com van phong", "Bánh mì pate",
    "banh mi thit", "Cà phê sữa đá", "cf sua da", "Trà sữa Phúc Long", "tra sua gongcha", "HIGHLANDS CF NGUYEN HUE", "GRAB*FOOD 3021 HCM",
    "SHOPEEFOOD*DON 88123", "Lẩu nấm với nhóm bạn", "Xôi gà sáng", "Bún bò Huế", "THE COFFEE HOUSE Q1", "STARBUCKS LANDMARK81",
    "BAEMIN*ORDER 5521", "Mì Quảng ếch", "an trua cong ty", "Đi chợ mua rau", "WINMART+ 112 LE LOI",
  ]),
  ...rows("c-move", [
    "Grab đi làm", "grab ve nha", "GRAB*RIDE 8812 HCM", "Be bike", "BE*TRIP 22091", "Đổ xăng", "do xang xe may", "PETROLIMEX CH 25",
    "Taxi Mai Linh", "XANH SM 0912", "Gửi xe tháng", "gui xe chung cu", "Vé tàu Hà Nội - Huế", "xe buyt 08", "Sửa xe máy",
    "VETC thu phi BOT", "thay nhot xe", "GOJEK*RIDE 1102", "Vé xe khách Phương Trang", "rua xe",
  ]),
  ...rows("c-study", [
    "Khoá IELTS online", "khoa hoc ielts", "Tiki - sách kỹ năng", "sach giao trinh", "Học phí tiếng Anh", "hoc phi thang 10",
    "UDEMY*COURSE 9921", "COURSERA PLUS", "Mua bút vở", "Thi TOEIC", "le phi thi toeic", "Giáo trình Cambridge 19",
    "Khoá học Excel", "khoa hoc lap trinh", "FAHASA Q1", "In tài liệu ôn thi", "hoc them toan", "Duolingo Super",
  ]),
  ...rows("c-fun", [
    "Xem phim CGV", "xem phim lotte", "Netflix Premium", "NETFLIX.COM", "Spotify Family", "SPOTIFY P1A2B3", "Karaoke với nhóm bạn",
    "karaoke nice", "Steam - game", "STEAMGAMES.COM", "Vé ca nhạc", "ve concert", "Du lịch Đà Lạt", "AGODA*HOTEL DALAT",
    "Bowling cuối tuần", "Vé công viên nước", "YOUTUBE PREMIUM", "Galaxy Cinema", "Tour Hạ Long 2N1Đ", "vexere ve xe di choi",
  ]),
  ...rows("c-shop", [
    "Shopee - áo sơ mi", "SHOPEE 2209931", "Lazada - tai nghe", "LAZADA VN 7781", "Tiki đồ gia dụng", "Uniqlo - quần kaki",
    "UNIQLO VINCOM", "mua giay the thao", "Mỹ phẩm Hasaki", "HASAKI.VN", "Thế Giới Di Động - sạc", "CELLPHONES Q10",
    "Điện Máy Xanh nồi cơm", "mua ao khoac", "IKEA ke sach", "Zara quần jean", "Watsons dầu gội", "Mua quà sinh nhật mẹ",
    "TIKI*ORDER 556", "H&M ao thun",
  ]),
  ...rows("c-bill", [
    "Tiền nhà tháng 10", "tien phong thang 9", "Tiền điện tháng 9", "EVN HCMC tien dien", "Tiền nước", "tien nuoc sawaco",
    "Internet FPT", "FPT TELECOM 0912", "Cước điện thoại Viettel", "MOMO*NAP TIEN DT 0903", "Nạp 4G Mobifone", "phi quan ly chung cu",
    "VNPT internet", "Gas nấu ăn", "tien wifi thang 10", "Truyền hình K+", "Phí dịch vụ tòa nhà", "nap the dien thoai",
  ]),
  ...rows("c-health", [
    "Phí tập gym", "gym california", "Pharmacity - thuốc cảm", "PHARMACITY 1102", "Long Châu thuốc dạ dày", "nha thuoc long chau",
    "Khám răng Nha khoa Kim", "kham benh vien Cho Ray", "Bảo hiểm y tế", "bao hiem suc khoe", "Vitamin C", "Khám mắt",
    "yoga thang 10", "GUARDIAN Q3", "thuoc ho", "Xét nghiệm máu", "Massage trị liệu", "kinh can",
  ]),
  ...rows("c-other", [
    "Mừng cưới bạn", "mung cuoi dong nghiep", "Quà sinh nhật đồng nghiệp", "CK NGUYEN VAN A chuyen tien", "THANH TOAN QR 0912XXX",
    "Từ thiện quỹ trẻ em", "Phí chuyển tiền", "rut tien ATM", "Tiền lì xì", "Đám hiếu",
  ]),
].map(([description, categoryId]) => ({ description, categoryId, type: "expense" as TransactionType }))
  .concat(
    [
      ...rows("c-salary", ["Lương tháng 9", "luong thang 10", "CTY ABC TRA LUONG T9", "Salary Sep 2026", "Nhận lương part-time", "luong lam them"]),
      ...rows("c-bonus", ["Thưởng hoàn thành dự án", "thuong le 2/9", "Thưởng KPI quý 3", "thuong tet"]),
      ...rows("c-income-other", [
        "Hoàn tiền Shopee", "HOAN TIEN SHOPEE DON 2209931", "Bán đồ cũ trên Chợ Tốt", "ban do cu", "Mẹ cho tiền", "Lãi tiết kiệm", "Được bạn trả nợ",
      ]),
    ].map(([description, categoryId]) => ({ description, categoryId, type: "income" as TransactionType })),
  );

/** 50 câu ghi nhanh: số tiền, loại, ngày đúng (hôm nay 12/10/2026) */
export const EXTRACT_SET: { text: string; amount: number; type: TransactionType; date: string }[] = [
  ["ăn phở 45k", 45000, "expense", "2026-10-12"],
  ["hôm qua ăn phở 45k với Nam", 45000, "expense", "2026-10-11"],
  ["cà phê 30 nghìn", 30000, "expense", "2026-10-12"],
  ["grab đi làm 52k", 52000, "expense", "2026-10-12"],
  ["lương tháng 9 15tr", 15000000, "income", "2026-10-12"],
  ["mua áo shopee 289.000đ", 289000, "expense", "2026-10-12"],
  ["tiền điện tháng 9 586000", 586000, "expense", "2026-10-12"],
  ["hôm kia xem phim 160k", 160000, "expense", "2026-10-10"],
  ["được thưởng 2tr", 2000000, "income", "2026-10-12"],
  ["đổ xăng 85k ngày 6/10", 85000, "expense", "2026-10-06"],
  ["trà sữa 55k", 55000, "expense", "2026-10-12"],
  ["học phí IELTS 1tr2", 1200000, "expense", "2026-10-12"],
  ["tiền nhà 4,5tr", 4500000, "expense", "2026-10-12"],
  ["mẹ cho 500k", 500000, "income", "2026-10-12"],
  ["bán đồ cũ được 350k", 350000, "income", "2026-10-12"],
  ["karaoke 220 nghìn hôm qua", 220000, "expense", "2026-10-11"],
  ["bánh mì 25k sáng nay", 25000, "expense", "2026-10-12"],
  ["mua thuốc cảm 120k", 120000, "expense", "2026-10-12"],
  ["netflix 260k", 260000, "expense", "2026-10-12"],
  ["internet fpt 220000đ", 220000, "expense", "2026-10-12"],
  ["an trua 40k", 40000, "expense", "2026-10-12"],
  ["cf 35k vs dong nghiep", 35000, "expense", "2026-10-12"],
  ["hoàn tiền shopee 120k", 120000, "income", "2026-10-12"],
  ["phí gym 500k ngày 3/10", 500000, "expense", "2026-10-03"],
  ["sách tiki 189k", 189000, "expense", "2026-10-12"],
  ["mừng cưới bạn 500k", 500000, "expense", "2026-10-12"],
  ["uniqlo quần kaki 540k", 540000, "expense", "2026-10-12"],
  ["ăn tối gia đình 650k", 650000, "expense", "2026-10-12"],
  ["be bike 39k", 39000, "expense", "2026-10-12"],
  ["lẩu nấm 320k với nhóm bạn hôm kia", 320000, "expense", "2026-10-10"],
  ["nạp điện thoại 100k", 100000, "expense", "2026-10-12"],
  ["thưởng lễ 1 triệu", 1000000, "income", "2026-10-12"],
  ["tiền nước 120.000", 120000, "expense", "2026-10-12"],
  ["xôi gà 30k", 30000, "expense", "2026-10-12"],
  ["vé ca nhạc 450k ngày 20/9", 450000, "expense", "2026-09-20"],
  ["khám răng 300k", 300000, "expense", "2026-10-12"],
  ["mua giày 1tr5", 1500000, "expense", "2026-10-12"],
  ["gửi xe 5k", 5000, "expense", "2026-10-12"],
  ["taxi về nhà 120k", 120000, "expense", "2026-10-12"],
  ["highlands 58k", 58000, "expense", "2026-10-12"],
  ["lương part time 3tr", 3000000, "income", "2026-10-12"],
  ["quà sinh nhật đồng nghiệp 300k", 300000, "expense", "2026-10-12"],
  ["bún bò 45 ngàn hôm qua", 45000, "expense", "2026-10-11"],
  ["mỹ phẩm 450k", 450000, "expense", "2026-10-12"],
  ["cơm tấm 42k", 42000, "expense", "2026-10-12"],
  ["steam game 120k", 120000, "expense", "2026-10-12"],
  ["được bạn trả 200k", 200000, "income", "2026-10-12"],
  ["phở 60k ngày 1/10", 60000, "expense", "2026-10-01"],
  ["bảo hiểm 1tr", 1000000, "expense", "2026-10-12"],
  ["trà đá 5k", 5000, "expense", "2026-10-12"],
].map(([text, amount, type, date]) => ({ text: text as string, amount: amount as number, type: type as TransactionType, date: date as string }));

/** 30 câu hỏi chatbot: công cụ + tham số đúng (null = phải từ chối) */
export const CHAT_SET: { question: string; expected: { name: string; args: Record<string, string | number | null> } | null }[] = [
  { question: "Tháng này tiêu ăn uống bao nhiêu?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Ăn uống", thang: "2026-10" } } },
  { question: "Tháng 9 mình tiêu ăn uống bao nhiêu?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Ăn uống", thang: "2026-09" } } },
  { question: "Tháng trước đi lại hết bao nhiêu tiền?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Di chuyển", thang: "2026-09" } } },
  { question: "Tháng 8 nhận lương bao nhiêu?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Lương", thang: "2026-08" } } },
  { question: "Tiền giải trí tháng 7?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Giải trí", thang: "2026-07" } } },
  { question: "Tháng này mua sắm hết bao nhiêu", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Mua sắm", thang: "2026-10" } } },
  { question: "So sánh tháng 9 với tháng 8", expected: { name: "so_sanh_hai_thang", args: { danh_muc: null, thang_a: "2026-09", thang_b: "2026-08" } } },
  { question: "So sánh ăn uống tháng 9 với tháng 8", expected: { name: "so_sanh_hai_thang", args: { danh_muc: "Ăn uống", thang_a: "2026-09", thang_b: "2026-08" } } },
  { question: "Tháng này chi nhiều hơn tháng trước không?", expected: { name: "so_sanh_hai_thang", args: { danh_muc: null, thang_a: "2026-10", thang_b: "2026-09" } } },
  { question: "So sánh di chuyển tháng 10 với tháng 9", expected: { name: "so_sanh_hai_thang", args: { danh_muc: "Di chuyển", thang_a: "2026-10", thang_b: "2026-09" } } },
  { question: "Tháng 8 tổng thu chi thế nào?", expected: { name: "tong_thu_chi_thang", args: { thang: "2026-08" } } },
  { question: "Tháng này mình tiết kiệm được bao nhiêu?", expected: { name: "tong_thu_chi_thang", args: { thang: "2026-10" } } },
  { question: "Tháng 9 còn dư bao nhiêu tiền?", expected: { name: "tong_thu_chi_thang", args: { thang: "2026-09" } } },
  { question: "Tổng chi tháng 6", expected: { name: "tong_thu_chi_thang", args: { thang: "2026-06" } } },
  { question: "Tháng này mình chi nhiều nhất vào đâu?", expected: { name: "chi_theo_danh_muc", args: { thang: "2026-10" } } },
  { question: "Tháng 9 tiền đi vào đâu nhiều nhất?", expected: { name: "chi_theo_danh_muc", args: { thang: "2026-09" } } },
  { question: "Danh mục nào tốn nhất tháng 8?", expected: { name: "chi_theo_danh_muc", args: { thang: "2026-08" } } },
  { question: "5 khoản chi lớn nhất tháng 9", expected: { name: "top_khoan_chi", args: { thang: "2026-09", so_luong: 5 } } },
  { question: "3 khoản chi lớn nhất tháng này", expected: { name: "top_khoan_chi", args: { thang: "2026-10", so_luong: 3 } } },
  { question: "Khoản nào đắt nhất tháng 7?", expected: { name: "top_khoan_chi", args: { thang: "2026-07", so_luong: 5 } } },
  { question: "Top 10 giao dịch lớn nhất tháng 8", expected: { name: "top_khoan_chi", args: { thang: "2026-08", so_luong: 10 } } },
  { question: "Ngân sách tháng này thế nào?", expected: { name: "tinh_trang_ngan_sach", args: { thang: "2026-10" } } },
  { question: "Mình có vượt hạn mức nào không?", expected: { name: "tinh_trang_ngan_sach", args: { thang: "2026-10" } } },
  { question: "Tình hình ngân sách tháng 9", expected: { name: "tinh_trang_ngan_sach", args: { thang: "2026-09" } } },
  { question: "Có nên mua cổ phiếu FPT không?", expected: null },
  { question: "Lãi suất vay mua nhà bây giờ bao nhiêu?", expected: null },
  { question: "Bitcoin tuần này lên hay xuống?", expected: null },
  { question: "Thời tiết Hà Nội mai thế nào?", expected: null },
  { question: "Viết code Python giúp mình", expected: null },
  { question: "Kể chuyện cười đi", expected: null },
];
