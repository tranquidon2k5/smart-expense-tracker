# Design System Master File — Sổ Tiền

> **LOGIC:** Khi dựng một trang cụ thể, kiểm tra `design-system/so-tien/pages/[page-name].md` trước.
> Nếu file đó tồn tại, quy tắc trong đó **ghi đè** file Master này.
> Nếu không, tuân thủ nghiêm ngặt các quy tắc dưới đây.

---

**Project:** Sổ Tiền (slug: `so-tien`)
**Phiên bản:** 2 — cập nhật 12/10/2026
**Category:** Personal Finance Tracker — expense budgeting dashboard (web app dùng hằng ngày, thiên về dữ liệu)
**Nền tảng:** **Desktop trước (1280–1920px)**; tablet/mobile chỉ cần responsive dùng được
**Stack (PRD §9.2):** Next.js · React · Tailwind CSS v4 · shadcn/ui · Recharts (qua shadcn Chart) · Lucide
**Design Dials:** Variance 3/10 (Minimal) | Motion 2/10 (Subtle) | Density 6/10 (Standard, hơi dày cho dữ liệu)
**Theme:** Light mode trước. Dark mode để sau (token nháp ở cuối file, chưa áp dụng).

### Nguồn quyết định (đã kiểm chứng)

| Hạng mục | Nguồn | Áp dụng |
|---|---|---|
| Style | `ui-ux-pro-max --design-system "personal finance tracker expense budgeting dashboard"` → **Minimalism & Swiss Style** (best for: dashboards, SaaS, professional tools; a11y risk thấp) | Dùng làm nền, thêm bo góc mềm |
| Biểu đồ | `--domain chart`: Trend Over Time, Compare Categories, Part-to-Whole, Heatmap, Cumulative Changes | Dùng (mục Charts) |
| Stack | `--stack shadcn`: Table/DataTable, Sidebar + SidebarProvider, Chart + chartConfig, theming bằng CSS variables + `@theme inline`; `--stack react`: stable keys, virtualize > 100 dòng | Dùng (mục Stack) |
| UX | `--domain ux`: focus states, hover states, hover vs tap, table handling, bulk actions, number/date formatting, empty states, loading, keyboard navigation | Dùng (mục Tương tác, Checklist) |
| Font chữ | `--domain typography` → "Vietnamese Friendly" (Be Vietnam Pro) | Dùng cho văn bản |
| Font số | Kiểm tra trực tiếp file font Google Fonts (xem mục Typography) | Inter |
| Bảng màu | Kết quả search không phù hợp (nền tối, xanh dương) → **giữ bảng màu xanh ngọc + cam nhấn tự thiết kế**, đã đo lại WCAG | Giữ |

---

## Global Rules

### Color Palette (Light)

Tông chủ đạo **xanh ngọc (teal)**: ổn định, đáng tin về tiền, mềm hơn xanh navy ngân hàng. Màu ấm (cam / vàng hổ phách) **chỉ dành cho gamification**.

#### Nền tảng & thương hiệu

| Role | Hex | Token (→ shadcn) | Tương phản |
|------|-----|------------------|-----------|
| Primary | `#0F766E` | `--color-primary` (`--primary`) | 5.47:1 trên trắng |
| Primary Hover/Pressed | `#115E59` | `--color-primary-hover` | 7.58:1 với chữ trắng |
| On Primary | `#FFFFFF` | `--color-on-primary` (`--primary-foreground`) | 5.47:1 |
| Primary Soft (nav active, chip, dòng được chọn) | `#E6F6F3` | `--color-primary-soft` (`--accent`) | chữ primary 4.91:1, chữ phụ 5.46:1 |
| Background (nền app) | `#F6F8F7` | `--color-background` (`--background`) | — |
| Foreground (chữ chính) | `#132A26` | `--color-foreground` (`--foreground`) | 14.2:1 nền / 15.1:1 trắng |
| Card / Surface / Sidebar | `#FFFFFF` | `--color-card` (`--card`, `--sidebar`) | — |
| Muted (track, nền nhóm phụ) | `#EEF2F1` | `--color-muted` (`--muted`) | — |
| Row Hover | `#F1F6F4` | `--color-row-hover` | chữ chính 13.9:1, chữ phụ 5.57:1 |
| Muted Foreground (chữ phụ, nhãn trục) | `#55665F` | `--color-muted-foreground` (`--muted-foreground`) | 5.7:1 nền / 6.08:1 trắng |
| Border (viền card, đường kẻ bảng) | `#DCE5E2` | `--color-border` (`--border`) | trang trí |
| Gridline biểu đồ | `#E8EEEC` | `--color-grid` | trang trí |
| Input Border | `#7C8D86` | `--color-input` (`--input`) | 3.49:1 (đạt 3:1 cho UI) |
| Ring (focus) | `#0F766E` | `--color-ring` (`--ring`) | 2px + offset 2px |

#### Thu / Chi — không bao giờ chỉ dựa vào màu

| Role | Hex | Token | Tương phản | Bắt buộc kèm |
|------|-----|-------|-----------|---------------|
| Thu | `#15803D` | `--color-income` | 5.02:1 trắng / 4.7:1 nền | Dấu `+` và icon `ArrowDownLeft` |
| Thu soft | `#DCFCE7` | `--color-income-soft` | — | — |
| Chi | `#BE123C` | `--color-expense` | 6.29:1 trắng / 5.89:1 nền | Dấu `−` (U+2212) và icon `ArrowUpRight` |
| Chi soft | `#FFE4E6` | `--color-expense-soft` | — | — |

- Thu và Chi chênh nhau thấp (1.25:1) → trong biểu đồ phải phân biệt thêm bằng **kiểu nét** (Thu nét đứt, Chi nét liền) và **nhãn trực tiếp**.
- Chi dùng đỏ hồng trầm, không phải đỏ báo lỗi — PRD §6.1 "tích cực, không trách móc".
- `aria-label` số tiền: "Thu 45.000 đồng" / "Chi 45.000 đồng".

#### Gamification (màu ấm — chỉ cho streak, XP, huy hiệu, chúc mừng)

| Role | Hex | Token | Dùng cho |
|------|-----|-------|---------|
| Streak icon | `#EA580C` | `--color-streak` | Icon `Flame` (3.56:1, đạt 3:1 đồ họa) |
| Streak text | `#C2410C` | `--color-streak-text` | Số ngày chuỗi (5.18:1 trắng / 4.68:1 trên soft) |
| Streak soft | `#FFF1E6` | `--color-streak-soft` | Nền pill chuỗi ngày |
| XP fill | `#D97706` | `--color-xp` | Thanh XP, viền huy hiệu đã mở — **luôn kèm nhãn số** |
| XP text | `#92400E` | `--color-xp-text` | Chữ cấp/XP trên nền soft (6.37:1) |
| XP soft | `#FEF3C7` | `--color-xp-soft` | Nền thẻ huy hiệu, toast lên cấp |
| Freeze | `#0369A1` | `--color-freeze` | Icon `Snowflake` + chữ (5.93:1) |

#### Trạng thái hệ thống

| Role | Hex | Token | Ghi chú |
|------|-----|-------|--------|
| Warning (ngân sách ≥ 80%) | `#B45309` | `--color-warning` | Kèm `AlertTriangle` + "Đã dùng 82%" |
| Danger (vượt 100%, xoá) | `#DC2626` | `--color-danger` (`--destructive`) | Chữ trắng 4.83:1; kèm `CircleAlert` |
| Info / AI | `#0369A1` | `--color-info` | Nhãn "AI gợi ý", độ tin cậy |
| Success | `#15803D` | `--color-success` | Toast lưu thành công |

#### Màu danh mục (icon danh mục + biểu đồ)

Màu **cố định theo danh mục** (cùng danh mục luôn cùng màu ở mọi biểu đồ). Tất cả đạt ≥ 3:1 trên nền trắng. Tránh teal primary, cam streak, đỏ chi.

| # | Hex | Tương phản | Danh mục mặc định |
|---|-----|-----------|-------------------|
| 1 | `#2563EB` | 5.17:1 | Ăn uống |
| 2 | `#7C3AED` | 5.70:1 | Di chuyển |
| 3 | `#4D7C0F` | 4.99:1 | Học tập |
| 4 | `#DB2777` | 4.60:1 | Giải trí |
| 5 | `#A16207` | 4.92:1 | Mua sắm |
| 6 | `#0E7490` | 5.36:1 | Hoá đơn |
| 7 | `#86198F` | 8.24:1 | Sức khoẻ |
| 8 | `#64748B` | 4.76:1 | Khác (và nhóm "Khác" trong biểu đồ) |

Định nghĩa trong `chartConfig` của shadcn Chart; không viết màu inline trong component biểu đồ.

---

### Typography

#### Cặp font và nơi dùng

| Font | Dùng ở đâu | Lý do |
|---|---|---|
| **Be Vietnam Pro** (400/500/600/700) | Tiêu đề trang, tiêu đề card, nhãn nav, nút, nhãn form, nội dung bảng dạng chữ (mô tả, danh mục, ví), câu khích lệ, câu trả lời chatbot | Thiết kế cho tiếng Việt, dấu chồng (ắ, ằ, ổ, ự…) cân đối |
| **Inter** (500/600) + `tabular-nums` | **Mọi con số**: số tiền, số dư, KPI, cột Số tiền và cột Ngày trong bảng, nhãn trục và tooltip biểu đồ, %, XP, số ngày chuỗi, ô nhập số tiền | Có `tnum` thật, đủ tiếng Việt, rõ ở cỡ nhỏ trên màn hình dữ liệu |

#### Kiểm tra file font (Google Fonts, 12/10/2026)

| Font | Feature `tnum` | Độ rộng chữ số 0–9 | Glyph tiếng Việt (70 ký tự có dấu) | `₫` / `−` |
|---|---|---|---|---|
| Be Vietnam Pro v12 | **Không** | Mặc định khác nhau (385–710) → **không thẳng cột** | Đủ | Có / Có |
| **Inter v20** (400 & 600) | **Có** | Sau `tnum`: đều 1328 (400) / 1325 (600) | Đủ | Có / Có |
| IBM Plex Sans v23 | Không có feature, nhưng chữ số **mặc định đã đều** (600) | Thẳng cột | Đủ | Có / Có |
| Plus Jakarta Sans v12 | Có | Sau `tnum`: đều 600 | Đủ | Có / Có |

→ Chọn **Inter** (đúng yêu cầu `tnum` thật, chuẩn phổ biến cho UI dữ liệu). **Dự phòng:** IBM Plex Sans (thẳng cột sẵn, không cần `tnum`).

**Cài đặt:**
```css
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Inter:wght@500;600&display=swap');

:root {
  --font-sans: 'Be Vietnam Pro', 'Noto Sans', system-ui, sans-serif;
  --font-num:  'Inter', 'IBM Plex Sans', system-ui, sans-serif;
}
.num { font-family: var(--font-num); font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }
```
Next.js: `next/font/google` cho cả hai, `subsets: ['latin', 'vietnamese']`, expose thành `--font-sans` / `--font-num`.

#### Thang chữ (desktop là chuẩn)

| Token | Size / Line-height | Weight | Font | Dùng cho |
|---|---|---|---|---|
| `--text-display` | 30px / 38px | 600 | Inter `.num` | Số dư tổng |
| `--text-kpi` | 24px / 32px | 600 | Inter `.num` | Giá trị thẻ KPI |
| `--text-h1` | 24px / 32px | 700 | Be Vietnam Pro | Tiêu đề trang |
| `--text-h2` | 18px / 26px | 600 | Be Vietnam Pro | Tiêu đề card / section |
| `--text-h3` | 15px / 22px | 600 | Be Vietnam Pro | Tiêu đề nhóm, tên mục |
| `--text-body` | 14px / 20px | 400 | Be Vietnam Pro | **Chữ UI mặc định trên desktop**, ô bảng, control |
| `--text-read` | 16px / 24px | 400 | Be Vietnam Pro | Đoạn văn dài: chatbot, câu khích lệ, mô tả trống |
| `--text-sm` | 13px / 18px | 400–500 | Be Vietnam Pro | Header bảng, nhãn KPI, chú thích, legend |
| `--text-xs` | 12px / 16px | 500 | Be Vietnam Pro / Inter | Nhãn trục biểu đồ, chip, badge (tối thiểu — không dùng cho đoạn văn) |

- Mobile (< 768px): `--text-body` lên 15px, **input lên 16px** (tránh iOS tự zoom).
- Line-height ≥ 1.35 ở mọi cỡ để dấu tiếng Việt không bị cắt.
- Không viết IN HOA tiêu đề bảng hay nhãn tiếng Việt; dùng sentence case.

### Quy ước dữ liệu hiển thị

| Loại | Định dạng | Ví dụ |
|---|---|---|
| Tiền | `Intl.NumberFormat('vi-VN')` + `đ` (không cách) | `45.000đ`, `1.250.000đ` |
| Thu / Chi | `+` / `−` (U+2212) + số | `+15.000.000đ` / `−45.000đ` |
| Rút gọn (chỉ trục biểu đồ) | `k`, `tr`, `tỷ` | `450k`, `1,2tr` — tooltip luôn hiện số đầy đủ |
| Ngày | `dd/MM/yyyy` | `12/10/2026` (bảng: cột Ngày dùng `.num`) |
| Tháng | "Tháng 10/2026" hoặc `MM/yyyy` (trục) | `10/2026` |
| Giờ | `HH:mm` 24h | `20:00` |
| Phần trăm | `82%` | — |
| Ngôn ngữ | Toàn bộ tiếng Việt, `<html lang="vi">` | — |

---

### Spacing (lưới 4px, Density 6/10)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | `4px` | Icon ↔ chữ trong chip, khoảng nhỏ nhất |
| `--space-2` | `8px` | Gap giữa control inline, icon ↔ nhãn nút |
| `--space-3` | `12px` | Padding dọc ô bảng, padding chip |
| `--space-4` | `16px` | Padding ngang ô bảng, padding card dày, lề mobile |
| `--space-5` | `20px` | **Padding card chuẩn (desktop)** |
| `--space-6` | `24px` | **Gap lưới card (gutter)**, lề trang tablet |
| `--space-8` | `32px` | **Lề trang desktop**, khoảng giữa các section |
| `--space-12` | `48px` | Khoảng trên/dưới empty state |

| Ngữ cảnh | ≥ 1280px | 768–1279px | < 768px |
|---|---|---|---|
| Lề nội dung | 32px | 24px | 16px |
| Gutter lưới | 24px | 20px | 16px |
| Padding card | 20px | 20px | 16px |
| Khoảng giữa section | 32px | 24px | 24px |

### Border Radius (thu nhỏ một bậc so với v1 cho giao diện dữ liệu)

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Chip, badge, checkbox, tooltip, ô heatmap (3px) |
| `--radius-md` | `8px` | Button, input, select, menu item, khung bảng |
| `--radius-lg` | `12px` | Card, panel, popover |
| `--radius-xl` | `16px` | Dialog, sheet |
| `--radius-full` | `9999px` | Pill streak, avatar, thanh tiến độ |

shadcn: đặt `--radius: 0.5rem` (8px) và suy ra sm/lg/xl như trên.

### Shadow (tối giản — phân tầng bằng viền)

| Level | Value | Usage |
|-------|-------|-------|
| none | `none` | **Mặc định cho card, bảng, sidebar** (viền `1px var(--color-border)`) |
| `--shadow-sm` | `0 1px 2px rgba(19,42,38,0.06)` | Top bar khi cuộn, header bảng sticky |
| `--shadow-md` | `0 4px 12px rgba(19,42,38,0.08)` | Popover, dropdown, tooltip biểu đồ, toast |
| `--shadow-lg` | `0 8px 24px rgba(19,42,38,0.12)` | Dialog, sheet |

---

## Layout (desktop trước)

### App Shell

```
┌────────────┬──────────────────────────────────────────────────────────────┐
│ SIDEBAR    │ TOP BAR 64px: Tiêu đề trang · [Ghi nhanh… (N)] · Tìm (Ctrl K) │
│ 248px      │              · Pill streak (Flame + số ngày) · Avatar        │
│ Logo       ├──────────────────────────────────────────────────────────────┤
│ Streak+XP  │ NỘI DUNG — lưới 12 cột, gutter 24px, lề 32px, max 1600px     │
│ ─ Tổng quan│                                                              │
│ ─ Giao dịch│                                                              │
│ ─ Ngân sách│                                                              │
│ ─ Ví       │                                                              │
│ ─ Trợ lý AI│                                                              │
│ ─ Thành tích                                                              │
│ ─ Cài đặt  │                                                              │
└────────────┴──────────────────────────────────────────────────────────────┘
```

- **Sidebar** (shadcn `Sidebar` trong `SidebarProvider` ở layout): nền trắng, viền phải 1px. Mục nav cao 36px, icon Lucide 18px + nhãn 14px/500. Active: nền `--color-primary-soft`, chữ + icon `--color-primary`, thanh 3px bên trái. Đầu sidebar: khối streak (pill) + thanh XP "Cấp 5 · 120/600 XP". Thu gọn được còn 64px (chỉ icon + tooltip), nhớ trạng thái.
- **Top bar**: ô **Ghi nhanh** (ô nhập câu tự nhiên, rộng 480px) là hành động chính, phím tắt `N`; ô tìm kiếm / command palette `Ctrl K`.
- Nội dung `max-width: 1600px`; ở 1920px phần dư để trống hai bên, không kéo giãn bảng.

### Lưới theo trang (≥ 1280px)

| Trang | Hàng 1 | Hàng 2 | Hàng 3 |
|---|---|---|---|
| **Tổng quan** | 4 thẻ KPI × 3 cột: Số dư · Tổng thu · Tổng chi · Còn lại ngân sách | Xu hướng thu/chi 6 tháng (8 cột) · Cơ cấu chi theo danh mục (4 cột) | Giao dịch gần đây — bảng (8 cột) · Cột phải (4 cột): Câu khích lệ, Nhiệm vụ hôm nay, Ngân sách sắp chạm ngưỡng |
| **Giao dịch** | Thanh lọc: khoảng ngày, ví, danh mục, khoảng tiền, loại (12 cột) | DataTable đầy đủ (12 cột) + panel chi tiết trượt từ phải (420px) khi chọn dòng | — |
| **Ngân sách** | Tổng quan tháng (12 cột) | Danh sách ngân sách dạng hàng có thanh tiến độ (8 cột) · So sánh danh mục (4 cột) | — |
| **Trợ lý AI** | Lịch sử hội thoại (3 cột) · Khung chat max 760px (6 cột) · Giao dịch nguồn (3 cột) | — | — |
| **Thành tích** | Streak + kỷ lục + thẻ đóng băng (4) · Cấp & XP (4) · Nhiệm vụ (4) | Lịch nhiệt 12 tháng (12 cột) | Bộ sưu tập huy hiệu, lưới 6 cột |

### Responsive (chỉ cần dùng được)

| Breakpoint | Thay đổi |
|---|---|
| ≥ 1536px | Như trên, max 1600px |
| 1280–1535px | **Chuẩn thiết kế** |
| 1024–1279px | Sidebar thu gọn 64px; lưới KPI 4 → 2×2; biểu đồ 8+4 → 12+12 |
| 768–1023px | Sidebar thành drawer (nút menu); 1–2 cột; bảng ẩn cột Ví |
| < 768px | Bottom nav 5 mục (Tổng quan · Giao dịch · [+] Ghi nhanh · Trợ lý · Thành tích); bảng chuyển thành danh sách hàng 2 dòng (không cuộn ngang); vùng chạm ≥ 44px; panel/dialog thành bottom sheet |

---

## Components

### Buttons (shadcn `Button`)

| Size | Cao | Padding ngang | Chữ |
|---|---|---|---|
| sm | 32px | 12px | 13px/500 |
| default | **36px** | 16px | 14px/500 |
| lg | 40px | 20px | 14px/600 |
| icon | 36×36px | — | icon 18px, bắt buộc `aria-label` |
| mobile (< 768px) | ≥ 44px | — | — |

- Variants: `default` (primary teal), `secondary` (nền primary-soft, chữ primary), `outline` (viền input), `ghost`, `destructive`.
- Hover: đổi nền 150ms (primary → primary-hover; ghost → `--color-row-hover`). Không dùng `transform`.
- Loading: giữ nguyên chiều rộng, spinner + "Đang phân tích…", `aria-busy="true"`, disabled.

### Thẻ KPI

```
Tổng chi tháng 10/2026            [ReceiptText]   ← 13px muted
−8.450.000đ                                        ← 24px Inter 600 .num
[TrendingUp] +12% so với tháng 9                   ← 13px, icon + dấu, màu muted (không phán xét)
```
- Card trắng, viền 1px, padding 20px, bo 12px, không bóng.
- Có thể kèm sparkline 6 tháng (cao 32px, không trục) khi ≥ 4 điểm dữ liệu; < 4 điểm thì chỉ hiện số.

### Bảng dữ liệu (shadcn `Table` + `DataTable` / TanStack Table)

| Thuộc tính | Giá trị |
|---|---|
| Cấu trúc | Luôn có `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` |
| Header | 13px/500 `--color-muted-foreground`, sentence case, nền `#FAFBFB`, sticky, viền dưới 1px |
| Ô | 14px/20px; padding `12px 16px` |
| Chiều cao dòng | **44px** (mặc định) · 36px (chế độ "Gọn", tuỳ chọn trong menu bảng) |
| Đường kẻ | Viền dưới 1px `--color-border` mỗi dòng; không kẻ dọc, không zebra |
| Hover dòng | Nền `--color-row-hover`, 120ms |
| Dòng được chọn | Nền `--color-primary-soft` + checkbox |
| Cột Ngày | 112px, `.num`, `dd/MM/yyyy` |
| Cột Mô tả | Co giãn, cắt `…` 1 dòng + `title` đầy đủ; nguồn AI có icon `Sparkles` 14px |
| Cột Danh mục | Chip: chấm màu danh mục 8px + tên (không chỉ dùng màu) |
| Cột Ví | 140px |
| Cột Số tiền | 140px, **căn phải**, `.num` 500, màu thu/chi + dấu `+`/`−` |
| Cột thao tác | 48px, nút `MoreHorizontal` — hiện khi hover **và** khi `:focus-within`; trên thiết bị cảm ứng luôn hiện |
| Sắp xếp | Header bấm được (Enter/Space), icon `ArrowUpDown`, `aria-sort` |
| Chọn nhiều | Checkbox đầu dòng → thanh hành động hàng loạt: Đổi danh mục · Đổi ví · Xoá |
| Phân trang | 25 / 50 / 100 dòng; > 100 dòng hiển thị liên tục thì **virtualize** |
| Dòng tổng | Cuối bảng khi lọc: "Tổng thu +… · Tổng chi −…" `.num` |
| Trống | Icon + câu hướng dẫn + nút "Ghi giao dịch đầu tiên" |
| Đang tải | Skeleton đúng số cột và chiều cao dòng (không xê dịch layout) |
| Key React | ID giao dịch ổn định, không dùng index |

Giao dịch chờ duyệt: chip `--color-info` "Chờ duyệt · 62%" + nút Duyệt / Sửa ngay trong dòng.

### Inputs & Form (shadcn `Field` + React Hook Form `Controller`)

- Cao 36px desktop (44px mobile), viền `--color-input`, bo 8px, chữ 14px (16px mobile).
- Nhãn luôn hiện phía trên (13px/500); lỗi ngay dưới ô với icon `CircleAlert`; có helper text khi cần.
- Ô số tiền: `inputmode="numeric"`, `.num`, căn phải, tự chèn dấu chấm nghìn khi gõ, hậu tố `đ`.
- Ô ngày: hiển thị `dd/MM/yyyy`, date picker tiếng Việt, tuần bắt đầu thứ Hai.

### Ghi nhanh (preview AI)

- Ô nhập ở top bar → popover 480px dưới ô: Số tiền (`.num` 24px), Loại (chip Thu/Chi có icon), Danh mục (chip + "AI gợi ý · 92%"), Ngày, Ví, Mô tả; mỗi trường sửa inline.
- `Enter` = Lưu, `Esc` = Huỷ. Độ tin cậy < 70% → chip `--color-warning` "Cần bạn kiểm tra".

### Thanh tiến độ (ngân sách, XP)

- Cao 8px, bo full, track `--color-muted`, `role="progressbar"` + `aria-valuenow/min/max`.
- Ngân sách: < 80% primary; 80–100% warning + `AlertTriangle`; > 100% danger + `CircleAlert`; luôn kèm chữ "820.000đ / 1.000.000đ · 82%".
- XP: fill `--color-xp`, nhãn "Cấp 5 · 120/600 XP".

### Gamification

- **Pill streak**: nền `--color-streak-soft`, `Flame` 18px `--color-streak`, số `.num` 600 `--color-streak-text`, `aria-label="Chuỗi 12 ngày"`. Hôm nay chưa ghi: icon outline `--color-muted-foreground`, tooltip "Ghi 1 khoản để giữ chuỗi" (không dùng đỏ).
- **Huy hiệu**: ô bo 12px, icon Lucide 28px. Đã mở: viền 2px `--color-xp`, nền `--color-xp-soft`. Chưa mở: nền `--color-muted`, icon `Lock`, vẫn hiện tên + điều kiện (chữ ≥ 4.5:1).
- **Câu khích lệ**: khối phẳng nền `--color-primary-soft`, icon `Sparkles`, chữ 16px.
- **Chúc mừng mốc**: toast góc phải dưới (desktop) nền `--color-xp-soft`; confetti ≤ 800ms, tắt khi reduced-motion.

### Dialog / Sheet / Popover

- Overlay `rgba(19,42,38,0.45)`, không blur.
- Dialog: bo 16px, padding 24px, max 520px, `--shadow-lg`, focus trap, `Esc` đóng, trả focus về nút mở.
- Panel chi tiết giao dịch: sheet bên phải 420px trên desktop; bottom sheet trên mobile.

### Icons (Lucide)

- Cỡ: 16px trong bảng/chip, 18px nav + nút, 20px tiêu đề card. Stroke 2 (1.75 khi ≥ 24px).
- Icon trang trí `aria-hidden="true"`; nút chỉ có icon bắt buộc `aria-label` tiếng Việt + tooltip.
- Bản đồ: Thu `ArrowDownLeft` · Chi `ArrowUpRight` · Chuyển ví `ArrowLeftRight` · Streak `Flame` · Đóng băng `Snowflake` · XP `Star` · Huy hiệu `Award` · Thành tích `Trophy` · AI `Sparkles` · Ví `Wallet` · Ngân sách `PiggyBank` · Giao dịch `ReceiptText` · Tổng quan `LayoutDashboard` · Trợ lý `MessageCircle` · Nhắc nhở `Bell` · Tăng/giảm `TrendingUp`/`TrendingDown`.

---

## Charts (shadcn `Chart` + Recharts)

### Chọn loại biểu đồ

| Nhu cầu (PRD) | Biểu đồ | Quy tắc |
|---|---|---|
| Xu hướng thu/chi theo tháng (F06) | **Line** (hoặc Area 20% opacity) 6–12 tháng | Thu nét đứt `--color-income`, Chi nét liền `--color-expense`, **nhãn trực tiếp cuối đường**; < 4 điểm → chỉ hiện thẻ số |
| So sánh thu/chi từng tháng | **Grouped column** ≤ 6 tháng | Thu / Chi cạnh nhau, có legend + giá trị trong tooltip |
| Tỷ lệ chi theo danh mục (F06 "biểu đồ tròn") | **Donut**, tối đa **5 lát**: top 4 + "Khác" | Lát lớn nhất bắt đầu 12 giờ, nhãn % trên/ cạnh lát, tổng chi ở giữa donut; > 5 danh mục gộp vào "Khác" |
| So sánh danh mục / xếp hạng | **Horizontal bar**, sắp giảm dần | Nhãn tên + số tiền ngay đầu/cuối thanh |
| Ngân sách theo danh mục (F05) | **Thanh tiến độ ngang** (không dùng gauge) | Kèm số và % |
| Lịch ghi chép (F11) | **Calendar heatmap** 12 tháng | 5 mức teal (`#EEF2F1` → `#0F766E`), legend "Ít → Nhiều", ô dùng thẻ đóng băng có icon `Snowflake`, tooltip "12/10/2026 · 3 giao dịch" |
| Dòng tiền tháng (tuỳ chọn, P2) | Waterfall ≤ 12 cột | Tăng/giảm kèm dấu và icon, không chỉ xanh/đỏ |

### Nhãn & trục

- Nhãn trục: 12px Inter `.num`, `--color-muted-foreground` (6.08:1). Trục Y rút gọn (`450k`, `1,2tr`), trục X tháng `T10` hoặc `10/2026`.
- Gridline: chỉ ngang, `--color-grid`, 1px; không kẻ dọc; không viền khung biểu đồ.
- Legend: 13px Be Vietnam Pro, phía trên trái, ký hiệu khớp kiểu nét (đứt/liền).
- Tooltip: nền trắng, viền 1px, bo 8px, `--shadow-md`; tiêu đề ngày `dd/MM/yyyy` hoặc "Tháng 10/2026", giá trị **đầy đủ** `1.250.000đ` `.num`.
- Tiêu đề biểu đồ là câu trả lời ngắn khi có thể, ví dụ "Chi tháng 10 tăng 12% so với tháng 9".
- Chiều cao: biểu đồ chính 280px, biểu đồ cột phải 240px, sparkline 32px.

### Truy cập & tương tác

- Không bao giờ phân biệt chỉ bằng màu: kiểu nét, nhãn trực tiếp, dấu `+`/`−`, nhãn %.
- Mỗi biểu đồ có nút **"Xem dạng bảng"** (bảng dữ liệu tương đương) + một câu tóm tắt cho trình đọc màn hình.
- Phím Tab vào biểu đồ, mũi tên trái/phải đi qua điểm dữ liệu; focus hiển thị cùng giá trị như hover.
- Bấm lát donut / thanh danh mục → mở trang Giao dịch đã lọc theo danh mục đó.

---

## Tương tác chuột & bàn phím

| Hạng mục | Quy tắc |
|---|---|
| Hover | Mọi phần tử bấm được có `cursor: pointer` + thay đổi nền/màu nhẹ 120–150ms. Không scale/translate |
| Không phụ thuộc hover | Hành động hiện khi hover cũng phải hiện khi `:focus-within`; trên cảm ứng luôn hiện |
| Focus | `:focus-visible` → outline 2px `--color-ring`, offset 2px, trên mọi control (kể cả trong dialog, ô bảng, điểm biểu đồ). Không bao giờ `outline: none` mà không thay thế |
| Không che focus | Top bar/sticky header không đè lên phần tử đang focus (`scroll-padding-top: 80px`) |
| Thứ tự Tab | Khớp thứ tự thị giác: Skip link → Sidebar → Top bar → Nội dung |
| Skip link | "Bỏ qua đến nội dung chính" — hiện khi focus |
| Phím tắt | `N` ghi nhanh · `Ctrl K` / `/` tìm kiếm · `Esc` đóng · `Enter` lưu trong preview · `?` xem danh sách phím tắt. Không kích hoạt khi đang gõ trong ô nhập |
| Tooltip | Hiện khi hover **và** focus, trễ 300ms, `Esc` ẩn |
| Disabled | Opacity 0.5, `cursor: not-allowed`, có tooltip lý do khi cần |

---

## Motion

- CSS transitions (không cần thư viện animation cuộn).
- Thời lượng: hover 120–150ms · mở popover/dropdown 150ms · dialog/sheet vào 200ms ra 150ms · chúc mừng 400–800ms.
- Easing vào `cubic-bezier(0.2, 0, 0, 1)`, ra `ease-in`. Chỉ animate `transform` / `opacity`.
- `prefers-reduced-motion: reduce`: tắt confetti và nảy; chuyển trạng thái tức thời.
- Loading: skeleton giữ kích thước (CLS < 0.1); không nháy spinner cho thao tác < 300ms; AI đang xử lý hiện "Đang phân tích…" với `aria-live="polite"`.

---

## Style Guidelines

**Style:** Soft Minimal Dashboard — dựa trên *Minimalism & Swiss Style* (kết quả skill cho dashboard tài chính), làm mềm bằng bo góc 8–12px và một điểm nhấn ấm cho thành tích.

**Keywords:** sạch, phẳng, lưới 12 cột rõ ràng, nhiều khoảng trắng nhưng mật độ vừa phải, phân tầng bằng viền mảnh + nền hơi ngả xanh, typography rõ thứ bậc, số liệu thẳng cột, màu đặc (không gradient), màu ấm chỉ ở khoảnh khắc thành tích.

**Hiệu ứng chính:** hover đổi nền nhẹ, viền thay bóng, bóng chỉ cho lớp nổi, chuyển động tối thiểu.

---

## Stack Notes (shadcn/ui + React)

- **Theming:** khai báo token trong `globals.css` (`:root`, sau này `.dark`), map sang Tailwind v4 bằng `@theme inline` (ví dụ `--color-primary: var(--primary)`). Không hardcode màu Tailwind (`bg-teal-700`) trong component. shadcn mặc định dùng OKLCH — chuyển các hex ở trên sang OKLCH khi khởi tạo.
- **Navigation:** shadcn `Sidebar` + `SidebarProvider` ở layout gốc.
- **Bảng:** `Table` cho bảng đơn giản; `DataTable` (TanStack Table) cho trang Giao dịch (sort, filter, pagination, chọn nhiều).
- **Biểu đồ:** shadcn `Chart` (bọc Recharts) + `chartConfig` chứa màu danh mục/thu/chi; không gọi Recharts trực tiếp với màu inline.
- **Form:** `Field` + React Hook Form `Controller` (không dùng abstraction `FormField` cũ).
- **React:** key ổn định theo ID; virtualize danh sách > 100 dòng; đo bằng Profiler trước khi tối ưu.

---

## Anti-Patterns (Do NOT Use)

- ❌ Gradient tím/hồng kiểu AI — mọi nền và nút dùng màu đặc
- ❌ Emoji làm icon — chỉ Lucide SVG
- ❌ Card lồng card — chia nhóm trong card bằng divider/khoảng trắng/nền muted không viền
- ❌ Bóng đổ nặng, hiệu ứng nổi khối hay kính mờ
- ❌ Phong cách ngân hàng cứng nhắc — navy đậm, chữ in hoa, bảng kẻ ô dày, góc vuông
- ❌ Bố cục kiểu trang giới thiệu (hero, video, CTA lớn) bên trong app
- ❌ Phân biệt thu/chi hoặc series biểu đồ chỉ bằng màu
- ❌ Donut quá 5 lát; gauge cho ngân sách; biểu đồ 3D
- ❌ Số tiền/ngày không dùng `.num` (Be Vietnam Pro không có tabular figures)
- ❌ Định dạng sai: `45,000 VND`, `45000đ`, `10/12/2026` kiểu Mỹ, chữ tiếng Anh trong UI
- ❌ Màu ấm gamification cho dữ liệu tài chính và ngược lại
- ❌ Câu chữ trách móc khi vượt ngân sách hay mất chuỗi (PRD §6.1)
- ❌ Hành động chỉ xuất hiện khi hover; focus bị ẩn; scale/translate khi hover
- ❌ Kéo giãn bảng full 1920px — giới hạn nội dung 1600px

---

## Dark Mode (NHÁP — chưa áp dụng, phải đo lại tương phản khi triển khai)

| Role | Hex dự kiến |
|---|---|
| Background | `#0E1715` |
| Card / Sidebar | `#15211E` |
| Border | `#25332F` |
| Foreground | `#E6EFEC` |
| Muted Foreground | `#9DB0A9` |
| Primary | `#2DD4BF` (chữ trên primary: `#0E1715`) |
| Income | `#4ADE80` |
| Expense | `#FB7185` |
| Streak | `#FB923C` |
| XP | `#FBBF24` |

---

## Pre-Delivery Checklist

**Hình ảnh & dữ liệu**
- [ ] Không emoji làm icon; toàn bộ icon từ Lucide, cỡ thống nhất (16/18/20)
- [ ] Thu/chi có `+`/`−` và icon; series biểu đồ có kiểu nét + nhãn trực tiếp
- [ ] Mọi số tiền, ngày, %, XP dùng `.num` (Inter, tabular-nums); cột Số tiền căn phải, thẳng hàng
- [ ] Tiền `45.000đ`, ngày `dd/MM/yyyy`, toàn bộ tiếng Việt, `lang="vi"`
- [ ] Donut ≤ 5 lát, có nhãn %; mỗi biểu đồ có "Xem dạng bảng"
- [ ] Không card lồng card, không gradient, không bóng nặng; màu ấm chỉ ở gamification
- [ ] Token màu qua CSS variables / `chartConfig`, không hardcode

**Tương tác & truy cập**
- [ ] Chữ ≥ 4.5:1; icon, viền input, nét biểu đồ mang nghĩa ≥ 3:1
- [ ] `cursor-pointer` + hover state trên mọi phần tử bấm được
- [ ] Focus ring thấy rõ ở mọi control; Tab theo thứ tự thị giác; có skip link; focus không bị che
- [ ] Hành động hover cũng hiện khi focus và trên cảm ứng
- [ ] Bảng có header ngữ nghĩa, `aria-sort`, chọn nhiều + thao tác hàng loạt
- [ ] Empty state có hướng dẫn + hành động; loading dùng skeleton, không xê dịch layout
- [ ] `prefers-reduced-motion` được tôn trọng

**Layout**
- [ ] Kiểm tra ở 1280, 1440, 1920px (chuẩn) và 1024, 768, 375px (dùng được)
- [ ] Không cuộn ngang ở mọi breakpoint; bảng chuyển thành danh sách < 768px
- [ ] Nội dung không bị che bởi top bar / bottom nav; vùng chạm ≥ 44px trên mobile
- [ ] Câu chữ tích cực, không trách móc
