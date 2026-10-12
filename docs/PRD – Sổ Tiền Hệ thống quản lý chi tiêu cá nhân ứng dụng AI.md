# PRD – Sổ Tiền: Hệ thống quản lý chi tiêu cá nhân ứng dụng AI

Oct 10, 2026 · @Daunue Tran

## 1. Tổng quan sản phẩm

Sổ Tiền là ứng dụng web giúp người dùng ghi chép và hiểu chi tiêu cá nhân với ít thao tác nhất: nhập bằng câu tiếng Việt tự nhiên, AI tự phân loại, chatbot trả lời câu hỏi về tiền bạc, và cơ chế gamification giữ thói quen ghi chép hằng ngày.

| Mục | Nội dung |
| --- | --- |
| Tên đề tài | Xây dựng hệ thống quản lý chi tiêu cá nhân ứng dụng mô hình ngôn ngữ lớn trong phân loại giao dịch và hỏi đáp dữ liệu |
| Tên sản phẩm | Sổ Tiền |
| Loại tài liệu | Product Requirements Document (PRD) cho đồ án môn học |
| Phiên bản | 1.1 — bổ sung nhóm tính năng gamification theo góp ý của giảng viên |
| Nền tảng | Web app responsive (desktop và điện thoại) |

### 1.1. Bối cảnh

Người dùng trẻ ngày càng thanh toán qua chuyển khoản, ví điện tử và mã QR. Giao dịch nhỏ, nhiều và rải rác ở nhiều tài khoản, nên việc theo dõi chi tiêu trở nên khó hơn.

### 1.2. Vấn đề cần giải quyết

- **Nhập liệu thủ công tốn công:** phải chọn danh mục, gõ số tiền, ngày cho từng giao dịch.
- **Phân loại kém:** nội dung chuyển khoản viết tắt, không dấu ("CK an trua NV A") khó tự động xếp đúng danh mục.
- **Khó khai thác dữ liệu:** muốn biết "tháng này tiêu cà phê bao nhiêu" phải tự lọc và tính.
- **Không duy trì được thói quen:** đa số người dùng app sổ chi tiêu bỏ ghi chép sau vài tuần vì thiếu động lực; dữ liệu đứt quãng làm thống kê mất giá trị.

## 2. Mục tiêu và chỉ số thành công

Sản phẩm thành công khi người dùng ghi một giao dịch trong dưới 10 giây, AI phân loại đúng từ 85% trở lên, và người dùng duy trì ghi chép đều đặn nhờ gamification.

| Mục tiêu | Chỉ số đo | Ngưỡng đạt |
| --- | --- | --- |
| Nhập liệu nhanh | Thời gian ghi 1 giao dịch bằng câu tự nhiên | ≤ 10 giây |
| Trích xuất chính xác | Tỷ lệ trích đúng số tiền, ngày, loại thu/chi trên bộ test | ≥ 90% |
| Phân loại chính xác | Độ chính xác phân loại hybrid trên 150–200 giao dịch gán nhãn | ≥ 85% |
| Chatbot tin cậy | Tỷ lệ trả lời đúng số liệu trên 30 câu hỏi mẫu | ≥ 90% |
| Duy trì thói quen | Số ngày ghi chép liên tiếp trung bình của nhóm dùng thử (5–10 người, 2 tuần) | ≥ 7 ngày |
| Gamification có tác dụng | Tỷ lệ ngày có ghi chép trên tổng số ngày dùng thử | ≥ 70% |
| Phản hồi nhanh | Thời gian phản hồi của chatbot | ≤ 5 giây |

## 3. Người dùng mục tiêu

Người dùng chính là sinh viên và người đi làm trẻ (18–30 tuổi) thanh toán chủ yếu qua chuyển khoản và ví điện tử.

### 3.1. Persona

| Persona | Mô tả | Nhu cầu chính | Nỗi đau |
| --- | --- | --- | --- |
| Minh, 20 tuổi, sinh viên | Sống trọ, trợ cấp gia đình 4 triệu/tháng, hay ăn ngoài và mua online | Biết tiền đi đâu, không "cháy túi" cuối tháng | Thử app ghi chép 2 lần, đều bỏ sau 1 tuần vì lười nhập |
| Lan, 25 tuổi, nhân viên văn phòng | Lương 15 triệu, có 2 tài khoản ngân hàng và 1 ví điện tử | Đặt ngân sách, để dành tiền du lịch | Mất thời gian tự tổng hợp sao kê để biết tháng này tiêu bao nhiêu |

### 3.2. Vai trò trong hệ thống

| Vai trò | Quyền |
| --- | --- |
| Khách | Xem trang giới thiệu, đăng ký, đăng nhập |
| Người dùng | Toàn bộ tính năng quản lý chi tiêu, AI và gamification trên dữ liệu của chính mình |
| Quản trị viên (Admin) | Quản lý người dùng, danh mục mặc định, nội dung gamification, xem thống kê hệ thống |

## 4. Phạm vi

**Trong phạm vi (bắt buộc):** nhóm A – Tính năng chính, B – Tính năng AI, C – Gamification, D – Quản trị.

**Trong phạm vi (nếu còn thời gian):** nhóm E – Tính năng mở rộng.

**Ngoài phạm vi:**

- Kết nối trực tiếp tài khoản ngân hàng hoặc webhook biến động số dư.
- Ứng dụng di động native (iOS/Android); chỉ làm web responsive.
- Thanh toán, chuyển tiền thật.
- Chạy mô hình AI cục bộ, nhận diện giọng nói.
- Tư vấn đầu tư, tài chính chuyên sâu.
- Bảng xếp hạng công khai giữa người dùng (tránh lộ thông tin tài chính).

## 5. Yêu cầu chức năng

Hệ thống gồm 5 nhóm và 16 chức năng; mức ưu tiên P0 là bắt buộc cho bản demo, P1 nên có, P2 làm nếu còn thời gian. Chi tiết nhóm C (Gamification) nằm ở mục 6.

### A. Tính năng chính

| Mã | Chức năng | Mô tả chi tiết | Ưu tiên |
| --- | --- | --- | --- |
| F01 | Quản lý tài khoản | Đăng ký, đăng nhập, đăng xuất, đổi mật khẩu; cập nhật thông tin cá nhân, chọn đơn vị tiền tệ | P0 |
| F02 | Quản lý ví/nguồn tiền | Tạo nhiều ví (tiền mặt, ngân hàng, ví điện tử); xem số dư từng ví; chuyển tiền giữa các ví | P0 |
| F03 | Quản lý danh mục | Danh mục thu/chi có sẵn (Ăn uống, Di chuyển, Học tập, Giải trí, Lương…); thêm, sửa, xóa danh mục riêng; chọn biểu tượng và màu | P0 |
| F04 | Quản lý giao dịch | Thêm, sửa, xóa giao dịch thu/chi bằng form; tìm kiếm, lọc theo thời gian, ví, danh mục, khoảng số tiền | P0 |
| F05 | Ngân sách | Đặt hạn mức chi theo tháng cho từng danh mục; thanh tiến độ; cảnh báo khi đạt 80% và khi vượt 100% | P0 |
| F06 | Dashboard và thống kê | Tổng thu, tổng chi, số dư tháng; biểu đồ tròn tỷ lệ chi theo danh mục; biểu đồ cột/đường xu hướng theo tháng | P0 |

### B. Tính năng AI

| Mã | Chức năng | Mô tả chi tiết | Ưu tiên |
| --- | --- | --- | --- |
| F07 | Nhập giao dịch bằng ngôn ngữ tự nhiên | Gõ "hôm qua ăn phở 45k với Nam" → AI tách số tiền, ngày, mô tả, loại thu/chi; hiển thị bản xem trước để xác nhận trước khi lưu | P0 |
| F08 | Tự động phân loại (hybrid) | Luật từ khóa chạy trước, không khớp thì gọi LLM kèm độ tin cậy; giao dịch độ tin cậy dưới 0,7 vào danh sách chờ duyệt; người dùng sửa danh mục → hệ thống sinh luật mới | P0 |
| F09 | Import sao kê CSV | Tải file CSV → ánh xạ cột → phân loại hàng loạt → duyệt nhanh giao dịch chưa chắc chắn; phát hiện giao dịch trùng lặp | P1 |
| F10 | Chatbot hỏi đáp chi tiêu | Hỏi "Tháng này tiêu ăn uống bao nhiêu?", "So sánh tháng 9 với tháng 8"; trả lời bằng số liệu lấy từ database qua function calling, kèm danh sách giao dịch liên quan; lưu lịch sử hội thoại | P0 |

### C. Gamification (xem chi tiết mục 6)

| Mã | Chức năng | Mô tả ngắn | Ưu tiên |
| --- | --- | --- | --- |
| F11 | Chuỗi ngày (streak) | Đếm số ngày liên tiếp người dùng ghi chép; có "thẻ đóng băng" giữ chuỗi | P0 |
| F12 | Câu khích lệ và nhắc nhở | Thông điệp động viên theo ngữ cảnh khi đăng nhập, khi ghi giao dịch, khi sắp mất chuỗi | P0 |
| F13 | Nhiệm vụ, điểm kinh nghiệm và cấp độ | Nhiệm vụ ngày/tuần, cộng XP, lên cấp | P1 |
| F14 | Huy hiệu thành tích | Mở khóa huy hiệu khi đạt mốc; trang bộ sưu tập huy hiệu | P1 |

### D. Quản trị

| Mã | Chức năng | Mô tả chi tiết | Ưu tiên |
| --- | --- | --- | --- |
| F15 | Trang quản trị | Quản lý người dùng (xem, khóa/mở khóa); quản lý danh mục mặc định; quản lý ngân hàng câu khích lệ, nhiệm vụ, huy hiệu; thống kê số người dùng, số giao dịch, số lần gọi AI, tỷ lệ giữ chuỗi | P1 |

### E. Tính năng mở rộng

| Mã | Chức năng | Mô tả ngắn | Ưu tiên |
| --- | --- | --- | --- |
| F16 | Mở rộng | Đọc ảnh hóa đơn bằng AI; báo cáo tháng do AI viết kèm gợi ý tiết kiệm; giao dịch định kỳ; xuất báo cáo Excel/PDF; thử thách tiết kiệm theo mục tiêu | P2 |

## 6. Gamification

Gamification thưởng cho hành vi **ghi chép đều đặn**, không thưởng cho việc tiêu nhiều hay ít tiền. Mục tiêu là biến việc cập nhật chi tiêu thành thói quen hằng ngày thông qua chuỗi ngày, câu khích lệ, nhiệm vụ, điểm kinh nghiệm và huy hiệu.

### 6.1. Nguyên tắc thiết kế

- **Tích cực, không trách móc:** câu chữ động viên, không làm người dùng xấu hổ khi vượt ngân sách hay mất chuỗi.
- **Thưởng hành vi tốt:** ghi chép, duyệt giao dịch, xem báo cáo, đặt ngân sách; không thưởng việc tiêu tiền.
- **Riêng tư:** không có bảng xếp hạng công khai; mọi thành tích chỉ người dùng tự xem.
- **Không gây áp lực:** người dùng tắt được nhắc nhở; có thẻ đóng băng để nghỉ một ngày mà không mất chuỗi.

### 6.2. Chuỗi ngày (F11)

| Quy tắc | Chi tiết |
| --- | --- |
| Ngày hợp lệ | Có ít nhất 1 hành động: thêm giao dịch, duyệt giao dịch chờ, hoặc bấm "Hôm nay mình không chi tiêu" |
| Cách tính ngày | Theo múi giờ của người dùng (mặc định UTC+7), từ 00:00 đến 23:59 |
| Đăng nhập | Đăng nhập được ghi nhận riêng (chuỗi đăng nhập) và cộng XP, nhưng chuỗi chính chỉ tính khi có cập nhật thông tin |
| Mất chuỗi | Bỏ trống 1 ngày mà không có thẻ đóng băng → chuỗi hiện tại về 0; kỷ lục chuỗi dài nhất vẫn được lưu |
| Thẻ đóng băng | Nhận 1 thẻ mỗi khi đạt chuỗi 7 ngày, giữ tối đa 2 thẻ; tự động dùng khi bỏ trống 1 ngày |
| Mốc chuỗi | 3, 7, 14, 30, 60, 100 ngày → hiệu ứng chúc mừng + XP thưởng + huy hiệu |
| Hiển thị | Biểu tượng ngọn lửa kèm số ngày trên thanh điều hướng; lịch nhiệt (heatmap) các ngày đã ghi chép trên trang hồ sơ |

### 6.3. Câu khích lệ và nhắc nhở (F12)

Hệ thống chọn câu phù hợp với ngữ cảnh từ ngân hàng câu do Admin quản lý, ưu tiên câu chưa hiển thị trong 7 ngày gần nhất để tránh lặp. Câu có thể chèn biến như tên, số ngày chuỗi, số tiền.

| Ngữ cảnh | Thời điểm hiển thị | Ví dụ câu |
| --- | --- | --- |
| Chào buổi sáng | Lần đăng nhập đầu tiên trong ngày | "Chào Minh! Chuỗi của bạn đang là 5 ngày, giữ lửa thêm hôm nay nhé 🔥" |
| Sau khi ghi giao dịch | Ngay khi lưu thành công | "Ghi xong rồi! Bạn đang hiểu túi tiền của mình hơn mỗi ngày." |
| Sắp mất chuỗi | 20:00 nếu hôm nay chưa ghi chép | "Còn vài tiếng nữa là hết ngày. Ghi 1 khoản chi để giữ chuỗi 12 ngày nhé!" |
| Đạt mốc chuỗi | Khi chạm mốc 7, 30, 100… | "Tuyệt vời! 30 ngày liên tiếp, bạn đã có thói quen thật sự rồi." |
| Mất chuỗi | Lần đăng nhập sau khi mất chuỗi | "Không sao cả, ai cũng có ngày bận. Kỷ lục 15 ngày vẫn ở đây, bắt đầu lại thôi!" |
| Quay lại sau thời gian dài | Không đăng nhập từ 7 ngày | "Mừng bạn trở lại! Dán sao kê hoặc gõ nhanh vài khoản để cập nhật nhé." |
| Ngân sách tốt | Cuối tuần, chi tiêu dưới 80% ngân sách | "Tuần này bạn chi đúng kế hoạch, giỏi lắm!" |

**Kênh nhắc nhở:** thông báo trong app (bắt buộc), email hoặc web push (tùy chọn). Người dùng chọn giờ nhắc hoặc tắt hoàn toàn trong phần Cài đặt.

**Cá nhân hóa bằng AI (P2):** LLM viết câu khích lệ dựa trên số liệu thật của người dùng (ví dụ "Tuần này bạn bớt 3 ly trà sữa so với tuần trước"), có câu dự phòng từ ngân hàng câu khi gọi AI lỗi.

### 6.4. Nhiệm vụ, điểm kinh nghiệm và cấp độ (F13)

**Bảng điểm XP:**

| Hành động | XP | Giới hạn |
| --- | --- | --- |
| Đăng nhập trong ngày | +5 | 1 lần/ngày |
| Ghi 1 giao dịch | +10 | Tối đa 10 lần/ngày (chống spam) |
| Duyệt 1 giao dịch AI chờ xác nhận | +5 | Tối đa 10 lần/ngày |
| Hoàn thành nhiệm vụ ngày | +20 | Mỗi nhiệm vụ 1 lần/ngày |
| Hoàn thành nhiệm vụ tuần | +100 | Mỗi nhiệm vụ 1 lần/tuần |
| Đạt mốc chuỗi | +50 đến +500 | Theo mốc |

**Ví dụ nhiệm vụ:**

- Ngày: ghi ít nhất 3 giao dịch; hỏi chatbot 1 câu; duyệt hết giao dịch chờ.
- Tuần: ghi chép đủ 5/7 ngày; đặt ngân sách cho 3 danh mục; xem báo cáo tuần.

**Cấp độ:** XP cần để lên cấp n = 100 × n. Mỗi cấp có danh hiệu, ví dụ Cấp 1 "Người mới ghi sổ", Cấp 5 "Thủ quỹ chăm chỉ", Cấp 10 "Bậc thầy chi tiêu".

### 6.5. Huy hiệu thành tích (F14)

| Huy hiệu | Điều kiện mở khóa |
| --- | --- |
| Bước đầu tiên | Ghi giao dịch đầu tiên |
| Lửa nhỏ / Lửa bền / Lửa bất diệt | Chuỗi 7 / 30 / 100 ngày |
| Trò chuyện cùng AI | Hỏi chatbot 10 câu |
| Người lập kế hoạch | Đặt ngân sách đủ 3 danh mục |
| Giữ đúng lời hứa | Cả tháng không danh mục nào vượt ngân sách |
| Nhà sưu tầm | Ghi đủ 100 giao dịch |
| Thầy giáo của AI | Sửa phân loại 20 lần (giúp hệ thống học luật mới) |

### 6.6. Vị trí trên giao diện

- Thanh điều hướng: ngọn lửa chuỗi ngày + thanh XP cấp độ.
- Dashboard: thẻ "Câu khích lệ hôm nay" và danh sách nhiệm vụ ngày có ô đánh dấu.
- Trang Thành tích: lịch nhiệt, kỷ lục chuỗi, số thẻ đóng băng, bộ sưu tập huy hiệu (đã mở và chưa mở).

## 7. Luồng người dùng chính

Bốn luồng dưới đây là kịch bản demo chính của đồ án.

**Luồng 1 – Ghi nhanh bằng câu tự nhiên (F07, F08, F11, F12)**

1. Người dùng gõ "hôm qua ăn phở 45k với Nam" vào ô nhập nhanh.
2. Hệ thống chuẩn hóa văn bản, LLM trích xuất: 45.000đ, ngày hôm qua, chi, mô tả "Ăn phở với Nam".
3. Rule engine khớp từ "phở" → danh mục Ăn uống (nếu không khớp, LLM gợi ý danh mục kèm độ tin cậy).
4. Bản xem trước hiện ra; người dùng bấm Lưu hoặc sửa trước khi lưu.
5. Hệ thống cộng XP, cập nhật chuỗi ngày, hiện câu khích lệ.

**Luồng 2 – Import sao kê và duyệt (F09, F08)**

1. Người dùng tải file CSV, chọn cột ngày, số tiền, nội dung.
2. Hệ thống loại giao dịch trùng, phân loại hàng loạt.
3. Giao dịch độ tin cậy thấp vào danh sách chờ duyệt.
4. Người dùng xác nhận hoặc sửa; mỗi lần sửa, hệ thống đề xuất tạo luật mới (ví dụ "GRAB" → Di chuyển).

**Luồng 3 – Hỏi chatbot (F10)**

1. Người dùng hỏi "Tháng 9 mình tiêu ăn uống bao nhiêu, so với tháng 8 thế nào?".
2. LLM chọn công cụ `so_sanh_hai_thang(danh_muc="Ăn uống", thang_a=8, thang_b=9)`.
3. Backend chạy truy vấn SQL có tham số, trả số liệu.
4. LLM diễn giải thành câu trả lời, kèm danh sách giao dịch nguồn.

**Luồng 4 – Giữ chuỗi ngày (F11, F12, F13)**

1. 20:00, người dùng chưa ghi chép → nhận nhắc nhở "Ghi 1 khoản chi để giữ chuỗi 12 ngày nhé!".
2. Người dùng mở app, ghi giao dịch hoặc bấm "Hôm nay mình không chi tiêu".
3. Chuỗi tăng lên 13, nhiệm vụ ngày được đánh dấu hoàn thành, XP cộng thêm.
4. Nếu người dùng không vào app cả ngày và còn thẻ đóng băng → thẻ được dùng, chuỗi giữ nguyên.

## 8. Yêu cầu phi chức năng

| Nhóm | Yêu cầu |
| --- | --- |
| Hiệu năng | Trang tải dưới 2 giây; nhập nhanh bằng câu phản hồi dưới 3 giây; chatbot dưới 5 giây |
| Bảo mật | Mật khẩu băm bằng bcrypt; xác thực JWT; mỗi người dùng chỉ truy cập dữ liệu của mình; chống SQL injection bằng truy vấn tham số; khóa API của LLM chỉ lưu ở backend |
| Quyền riêng tư | Chỉ gửi nội dung giao dịch cần thiết cho LLM, không gửi tên, email; dùng dữ liệu giả lập cho demo; người dùng xuất và xóa được toàn bộ dữ liệu của mình |
| Độ tin cậy | Khi gọi AI lỗi hoặc quá thời gian, hệ thống vẫn cho nhập bằng form và dùng câu khích lệ dự phòng |
| Khả dụng | Giao diện tiếng Việt, responsive trên điện thoại; tối đa 3 lần bấm để ghi 1 giao dịch |
| Bảo trì | Mã nguồn chia module; tách lớp gọi LLM để đổi nhà cung cấp dễ dàng; có tài liệu cài đặt |
| Chi phí | Chi phí API AI cho bản demo dưới 100.000đ/tháng |

## 9. Kiến trúc và công nghệ

Hệ thống theo kiến trúc 3 tầng: web app gọi backend qua REST; backend chứa 4 module nghiệp vụ, lưu dữ liệu ở PostgreSQL và gọi LLM qua API.

&#91;embedded content: Kiến trúc hệ thống · 3 tầng, 4 module backend\]

LLM chỉ đọc hiểu câu chữ và chọn công cụ; mọi con số hiển thị đều do backend tính từ database. Một job định kỳ trong module Gamification gửi nhắc nhở lúc 20:00, cập nhật chuỗi ngày lúc 00:00 và làm mới nhiệm vụ ngày/tuần.

### 9.1. Pipeline xử lý giao dịch

1. Đầu vào: câu tự nhiên, form hoặc file CSV.
2. Tiền xử lý: chuẩn hóa tiếng Việt có/không dấu, số tiền ("45k" → 45.000), ngày ("hôm qua").
3. Trích xuất: LLM trả JSON theo schema cố định {so\_tien, loai, ngay, mo\_ta}.
4. Phân loại: rule engine trước; không khớp thì LLM few-shot kèm độ tin cậy.
5. Lưu: độ tin cậy ≥ 0,7 lưu thẳng; thấp hơn vào hàng đợi duyệt.
6. Sự kiện: ghi activity\_logs → module Gamification cập nhật chuỗi, XP, nhiệm vụ, huy hiệu.

### 9.2. Công nghệ

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | React / Next.js, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Node.js (NestJS) hoặc Python (FastAPI) |
| Cơ sở dữ liệu | PostgreSQL, ORM Prisma hoặc SQLAlchemy |
| AI | LLM qua API (Gemini / OpenAI), structured output JSON, function calling |
| Tác vụ định kỳ | node-cron hoặc APScheduler |
| Thông báo | Thông báo trong app; email qua Nodemailer/SMTP |
| Triển khai | Docker; Vercel (frontend), Render hoặc Railway (backend, database) |

## 10. Mô hình dữ liệu

Cơ sở dữ liệu PostgreSQL gồm 17 bảng; các bảng từ activity\_logs trở xuống phục vụ gamification và nhắc nhở.

| Bảng | Trường chính | Ghi chú |
| --- | --- | --- |
| users | id, email, password\_hash, full\_name, currency, timezone, role, is\_locked, created\_at | role: user / admin |
| wallets | id, user\_id, name, type, balance | type: cash / bank / ewallet |
| categories | id, user\_id (null = mặc định), name, type, icon, color | type: income / expense |
| transactions | id, user\_id, wallet\_id, category\_id, amount, type, date, description, source, ai\_confidence, status | source: form / nlp / csv; status: confirmed / pending |
| budgets | id, user\_id, category\_id, month, limit\_amount |  |
| classification\_rules | id, user\_id, keyword, category\_id, created\_from | created\_from: user / correction |
| chat\_messages | id, user\_id, role, content, tool\_calls, created\_at | lịch sử chatbot |
| ai\_logs | id, user\_id, feature, tokens, latency\_ms, success, created\_at | phục vụ thống kê và đánh giá |
| activity\_logs | id, user\_id, date, action\_type | nguồn tính chuỗi ngày |
| user\_streaks | user\_id, current\_streak, longest\_streak, last\_active\_date, freeze\_count |  |
| user\_levels | user\_id, total\_xp, level |  |
| missions / user\_missions | mission: id, code, period, target, xp · user\_mission: user\_id, mission\_id, period\_key, progress, completed\_at | period: daily / weekly |
| badges / user\_badges | badge: id, code, name, icon, condition · user\_badge: user\_id, badge\_id, unlocked\_at |  |
| motivation\_messages | id, context, template, is\_active | template chứa biến {name}, {streak}… |
| notifications | id, user\_id, type, content, is\_read, created\_at | nhắc nhở và chúc mừng |

**Quan hệ chính:** một người dùng có nhiều ví, danh mục, giao dịch, ngân sách, luật, huy hiệu; một giao dịch thuộc một ví và một danh mục; mỗi người dùng có đúng một bản ghi chuỗi ngày và cấp độ.

## 11. Đánh giá, kiểm thử và tiêu chí nghiệm thu

Đồ án được nghiệm thu khi các chỉ số ở mục 2 đạt ngưỡng và cả 4 luồng ở mục 7 chạy trọn vẹn trong buổi demo.

### 11.1. Đánh giá AI

- **Bộ dữ liệu:** 150–200 giao dịch tiếng Việt gán nhãn thủ công (có dấu, không dấu, viết tắt, nội dung chuyển khoản).
- **Thí nghiệm phân loại:** so sánh 3 cách: chỉ dùng luật, chỉ dùng LLM, kết hợp hybrid; đo accuracy và F1 theo từng danh mục.
- **Trích xuất:** tỷ lệ trích đúng số tiền, ngày, loại thu/chi trên 50 câu mẫu.
- **Chatbot:** 30 câu hỏi mẫu có đáp án chuẩn; đo tỷ lệ đúng số liệu và thời gian phản hồi.

### 11.2. Đánh giá gamification

- Thử nghiệm với 5–10 người dùng trong 2 tuần, chia 2 nhóm: bật và tắt gamification.
- So sánh số ngày có ghi chép, chuỗi dài nhất, số giao dịch trung bình mỗi người.
- Khảo sát ngắn sau thử nghiệm: câu khích lệ có tạo động lực không, có gây phiền không.

### 11.3. Kiểm thử phần mềm

- Unit test cho rule engine, logic tính chuỗi ngày (đổi ngày, múi giờ, thẻ đóng băng), tính XP và mở khóa huy hiệu.
- Integration test cho API giao dịch, import CSV, chatbot.
- Kiểm thử thủ công giao diện trên Chrome desktop và điện thoại.

### 11.4. Sản phẩm bàn giao

- [ ] Web app chạy được, có tài khoản demo với dữ liệu 2–3 tháng
- [ ] Mã nguồn trên GitHub kèm hướng dẫn cài đặt
- [ ] Báo cáo: phân tích yêu cầu, thiết kế (use case, ERD, kiến trúc), cài đặt, kết quả đánh giá
- [ ] Bảng kết quả thí nghiệm phân loại và gamification
- [ ] Slide và kịch bản demo

## 12. Lộ trình triển khai

Dự án chia thành 6 giai đoạn trong 13 tuần, mỗi giai đoạn kết thúc bằng một cổng kiểm tra trước khi sang giai đoạn sau.

&#91;embedded content: Lộ trình 13 tuần · 6 giai đoạn, 5 cổng kiểm tra\]

Nếu chậm tiến độ, cắt F09 (import CSV) và F13–F14 (nhiệm vụ, huy hiệu) trước; giữ F11–F12 (chuỗi ngày, câu khích lệ) vì đây là góp ý trực tiếp của giảng viên.

## 13. Rủi ro, giả định và vấn đề mở

### 13.1. Rủi ro

| Rủi ro | Mức độ | Cách xử lý |
| --- | --- | --- |
| LLM phân loại sai hoặc bịa số liệu | Cao | Hybrid với luật; số liệu chatbot chỉ lấy từ SQL; hàng đợi duyệt cho giao dịch độ tin cậy thấp |
| Gói API miễn phí bị giới hạn hoặc thay đổi | Trung bình | Tách lớp gọi LLM để đổi nhà cung cấp; giảm số lần gọi nhờ rule engine; ngân sách nhỏ cho gói trả phí |
| Gamification gây phiền hoặc áp lực | Trung bình | Cho tắt nhắc nhở; câu chữ tích cực; thẻ đóng băng; khảo sát người dùng thử |
| Người dùng spam giao dịch để lấy XP | Thấp | Giới hạn XP mỗi ngày; giao dịch xóa trong ngày bị trừ XP tương ứng |
| Lỗi tính chuỗi do múi giờ | Trung bình | Lưu ngày theo múi giờ người dùng; viết unit test cho các trường hợp biên |
| Trễ tiến độ do làm một mình | Trung bình | Ưu tiên P0 trước; P1, P2 chỉ làm khi P0 xong |

### 13.2. Giả định

- Người dùng có kết nối Internet và dùng trình duyệt hiện đại.
- File CSV sao kê có tối thiểu các cột ngày, số tiền, nội dung.
- Dữ liệu demo là dữ liệu giả lập, không dùng dữ liệu tài chính thật của người khác.

### 13.3. Vấn đề mở

- Chọn nhà cung cấp LLM chính (Gemini hay OpenAI) sau khi thử độ chính xác tiếng Việt.
- Có cần web push hay chỉ thông báo trong app và email là đủ cho nhắc nhở.
- Ngưỡng độ tin cậy 0,7 cho hàng đợi duyệt có thể điều chỉnh sau thí nghiệm.
