/**
 * Bảng màu và bộ icon cho danh mục — nguồn duy nhất cho giao diện và kiểm tra dữ liệu.
 * Màu lấy đúng 8 màu danh mục trong MASTER.md (đều đạt ≥ 3:1 trên nền trắng).
 */
export const CATEGORY_COLORS = [
  { value: "#2563EB", name: "Xanh dương" },
  { value: "#7C3AED", name: "Tím" },
  { value: "#4D7C0F", name: "Xanh rêu" },
  { value: "#DB2777", name: "Hồng" },
  { value: "#A16207", name: "Vàng đất" },
  { value: "#0E7490", name: "Xanh ngọc đậm" },
  { value: "#86198F", name: "Mận" },
  { value: "#64748B", name: "Xám" },
] as const;

/** Tên icon Lucide cho phép chọn (phải có trong registry của CategoryIcon) */
export const CATEGORY_ICON_OPTIONS = [
  { name: "Utensils", label: "Ăn uống" },
  { name: "Coffee", label: "Cà phê" },
  { name: "ShoppingCart", label: "Đi chợ" },
  { name: "Bike", label: "Xe máy" },
  { name: "Car", label: "Ô tô" },
  { name: "Bus", label: "Xe buýt" },
  { name: "Fuel", label: "Xăng" },
  { name: "Plane", label: "Du lịch" },
  { name: "House", label: "Nhà ở" },
  { name: "Zap", label: "Điện" },
  { name: "Wifi", label: "Internet" },
  { name: "Smartphone", label: "Điện thoại" },
  { name: "GraduationCap", label: "Học tập" },
  { name: "BookOpen", label: "Sách" },
  { name: "Clapperboard", label: "Phim" },
  { name: "Gamepad2", label: "Trò chơi" },
  { name: "Music", label: "Âm nhạc" },
  { name: "ShoppingBag", label: "Mua sắm" },
  { name: "Shirt", label: "Quần áo" },
  { name: "HeartPulse", label: "Sức khoẻ" },
  { name: "Dumbbell", label: "Thể thao" },
  { name: "Baby", label: "Con cái" },
  { name: "PawPrint", label: "Thú cưng" },
  { name: "Gift", label: "Quà tặng" },
  { name: "Briefcase", label: "Công việc" },
  { name: "Coins", label: "Tiền" },
  { name: "PiggyBank", label: "Tiết kiệm" },
  { name: "Landmark", label: "Ngân hàng" },
  { name: "TrendingUp", label: "Đầu tư" },
  { name: "Shapes", label: "Khác" },
] as const;

export const CATEGORY_NAME_MAX = 30;
