/**
 * Bộ kiểm tra GIỮ RIÊNG (holdout) — chỉ dùng để đo, KHÔNG dùng để chỉnh luật hay prompt.
 * Soạn sau lần chạy 1, không trùng mẫu nào với eval-data.ts. Nếu sửa luật/prompt dựa trên câu
 * sai ở đây thì bộ này mất giá trị: khi đó cần soạn bộ holdout mới.
 */
import type { TransactionType } from "@shared/types";

interface Sample {
  description: string;
  type: TransactionType;
  categoryId: string;
}
const rows = (categoryId: string, type: TransactionType, list: string[]): Sample[] => list.map((description) => ({ description, type, categoryId }));

/** 40 giao dịch */
export const HOLDOUT_CLASSIFY_SET: Sample[] = [
  ...rows("c-food", "expense", ["Hủ tiếu Nam Vang", "KFC VINCOM THU DUC", "banh xeo mien tay", "Bò bía cổng trường", "NGON VILLA Q1", "pizza 4ps"]),
  ...rows("c-move", "expense", ["Gửi xe máy siêu thị", "VIETJET AIR VJ123", "Vé máy bay Tết", "thay lop xe dap", "Grab car ra sân bay"]),
  ...rows("c-study", "expense", ["Lệ phí thi chứng chỉ tin học", "Mua bộ đề luyện thi", "khoa tieng nhat online", "Thư viện thẻ năm"]),
  ...rows("c-fun", "expense", ["Ve xem bong da My Dinh", "Escape room với bạn", "APPLE.COM/BILL ICLOUD", "Vé bảo tàng", "Đi Vũng Tàu cuối tuần"]),
  ...rows("c-shop", "expense", ["SENDO*DON 4410", "Mua ốp điện thoại", "BACH HOA XANH Q7 do dung", "Túi xách Charles & Keith", "kem chong nang"]),
  ...rows("c-bill", "expense", ["Tiền điện tháng 10", "VNPT TRA SAU T9", "Phí rác tháng 10", "nuoc sach thang 9"]),
  ...rows("c-health", "expense", ["Nhổ răng khôn", "Thuốc dị ứng", "Phòng khám Đa khoa Hoàn Mỹ", "tiem vac xin cum"]),
  ...rows("c-other", "expense", ["CK TRAN THI B tien hui", "Phat nguoi xe may", "Đóng góp quỹ lớp"]),
  ...rows("c-salary", "income", ["CONG TY XYZ CHUYEN LUONG T10"]),
  ...rows("c-bonus", "income", ["Thưởng sáng kiến tháng 9"]),
  ...rows("c-income-other", "income", ["Bán sách cũ", "Hoàn tiền Lazada đơn hủy"]),
];

/** 15 câu hỏi chatbot (hôm nay 12/10/2026) */
export const HOLDOUT_CHAT_SET: { question: string; expected: { name: string; args: Record<string, string | number | null> } | null }[] = [
  { question: "Tháng 5 tiêu cho học tập bao nhiêu?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Học tập", thang: "2026-05" } } },
  { question: "Tiền hoá đơn tháng này hết bao nhiêu?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Hoá đơn", thang: "2026-10" } } },
  { question: "Tháng 9 mình nhận thưởng bao nhiêu?", expected: { name: "tong_theo_danh_muc", args: { danh_muc: "Thưởng", thang: "2026-09" } } },
  { question: "So sánh sức khoẻ tháng 8 với tháng 7", expected: { name: "so_sanh_hai_thang", args: { danh_muc: "Sức khoẻ", thang_a: "2026-08", thang_b: "2026-07" } } },
  { question: "So sánh tổng chi tháng 6 với tháng 5", expected: { name: "so_sanh_hai_thang", args: { danh_muc: null, thang_a: "2026-06", thang_b: "2026-05" } } },
  { question: "Tháng 7 thu chi ra sao?", expected: { name: "tong_thu_chi_thang", args: { thang: "2026-07" } } },
  { question: "Tháng trước dư được bao nhiêu?", expected: { name: "tong_thu_chi_thang", args: { thang: "2026-09" } } },
  { question: "Tháng 6 tiền chủ yếu đi vào đâu?", expected: { name: "chi_theo_danh_muc", args: { thang: "2026-06" } } },
  { question: "Liệt kê 4 khoản chi lớn nhất tháng 6", expected: { name: "top_khoan_chi", args: { thang: "2026-06", so_luong: 4 } } },
  { question: "Top 8 giao dịch lớn nhất tháng này", expected: { name: "top_khoan_chi", args: { thang: "2026-10", so_luong: 8 } } },
  { question: "Tháng 8 có danh mục nào vượt ngân sách không?", expected: { name: "tinh_trang_ngan_sach", args: { thang: "2026-08" } } },
  { question: "Hạn mức tháng này còn ổn không?", expected: { name: "tinh_trang_ngan_sach", args: { thang: "2026-10" } } },
  { question: "Có nên gửi tiết kiệm hay mua chứng khoán?", expected: null },
  { question: "Giá vàng hôm nay bao nhiêu?", expected: null },
  { question: "Gợi ý món ăn tối nay", expected: null },
];
