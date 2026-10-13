# Kết quả đánh giá AI (PRD §11.1)

Tạo bằng `cd server && npm run eval:ai` (model `gpt-4.1-mini`, "hôm nay" của bộ dữ liệu là 12/10/2026).

---

# Lần chạy 1 — trước khi sửa (13/10/2026)


### Phân loại (166 giao dịch)

| Danh mục | Số mẫu | F1 Chỉ luật | F1 Chỉ LLM | F1 Hybrid |
|---|---:|---:|---:|---:|
| Ăn uống | 25 | 76.6% | 93.9% | 84.0% |
| Di chuyển | 20 | 72.7% | 95.0% | 95.2% |
| Học tập | 18 | 77.4% | 94.1% | 97.3% |
| Giải trí | 20 | 75.0% | 97.4% | 91.9% |
| Mua sắm | 20 | 81.1% | 84.4% | 85.7% |
| Hoá đơn | 18 | 75.9% | 88.9% | 90.9% |
| Sức khoẻ | 18 | 83.9% | 88.2% | 100.0% |
| Khác | 10 | 0.0% | 88.9% | 88.9% |
| Lương | 6 | 90.9% | 100.0% | 100.0% |
| Thưởng | 4 | 100.0% | 100.0% | 100.0% |
| Thu khác | 7 | 83.3% | 100.0% | 100.0% |
| **Accuracy** | | **64.5%** | **91.6%** | **91.6%** |
| **Macro F1** | | **74.3%** | **93.7%** | **94.0%** |

### Trích xuất (50 câu)

| Cách | Số tiền | Loại thu/chi | Ngày | Đúng cả 3 |
|---|---:|---:|---:|---:|
| Bộ parser luật | 100.0% | 96.0% | 100.0% | 96.0% |
| LLM | 100.0% | 100.0% | 100.0% | 100.0% |

### Chatbot (30 câu hỏi)

| Cách | Đúng công cụ + tham số | Từ chối đúng | Thời gian TB |
|---|---:|---:|---:|
| Luật (planQuestion) | 93.3% | 6/6 | 0 ms |
| LLM function calling | 80.0% | 6/6 | 585 ms |

Câu sai:

- [Luật (planQuestion)] “Tháng này chi nhiều hơn tháng trước không?” → tong_thu_chi_thang({"thang":"2026-10"})
- [Luật (planQuestion)] “Top 10 giao dịch lớn nhất tháng 8” → từ chối
- [LLM function calling] “So sánh tháng 9 với tháng 8” → so_sanh_hai_thang({"danh_muc":null,"thang_a":"2026-08","thang_b":"2026-09"})
- [LLM function calling] “So sánh ăn uống tháng 9 với tháng 8” → so_sanh_hai_thang({"danh_muc":"Ăn uống","thang_a":"2026-08","thang_b":"2026-09"})
- [LLM function calling] “Tháng này chi nhiều hơn tháng trước không?” → so_sanh_hai_thang({"danh_muc":null,"thang_a":"2026-09","thang_b":"2026-10"})
- [LLM function calling] “So sánh di chuyển tháng 10 với tháng 9” → so_sanh_hai_thang({"danh_muc":"Di chuyển","thang_a":"2026-09","thang_b":"2026-10"})
- [LLM function calling] “Khoản nào đắt nhất tháng 7?” → top_khoan_chi({"thang":"2026-07","so_luong":1})
- [LLM function calling] “Top 10 giao dịch lớn nhất tháng 8” → từ chối

### Phân loại sai của cách “chỉ luật” (59)

- “GRAB*FOOD 3021 HCM”: đúng Ăn uống, luật đoán Di chuyển
- “SHOPEEFOOD*DON 88123”: đúng Ăn uống, luật đoán Mua sắm
- “THE COFFEE HOUSE Q1”: đúng Ăn uống, luật đoán (không đoán)
- “STARBUCKS LANDMARK81”: đúng Ăn uống, luật đoán (không đoán)
- “BAEMIN*ORDER 5521”: đúng Ăn uống, luật đoán (không đoán)
- “Mì Quảng ếch”: đúng Ăn uống, luật đoán (không đoán)
- “Đi chợ mua rau”: đúng Ăn uống, luật đoán (không đoán)
- “BE*TRIP 22091”: đúng Di chuyển, luật đoán (không đoán)
- “PETROLIMEX CH 25”: đúng Di chuyển, luật đoán (không đoán)
- “Sửa xe máy”: đúng Di chuyển, luật đoán (không đoán)
- “VETC thu phi BOT”: đúng Di chuyển, luật đoán (không đoán)
- “thay nhot xe”: đúng Di chuyển, luật đoán (không đoán)
- “GOJEK*RIDE 1102”: đúng Di chuyển, luật đoán (không đoán)
- “Vé xe khách Phương Trang”: đúng Di chuyển, luật đoán (không đoán)
- “rua xe”: đúng Di chuyển, luật đoán (không đoán)
- “UDEMY*COURSE 9921”: đúng Học tập, luật đoán (không đoán)
- “COURSERA PLUS”: đúng Học tập, luật đoán (không đoán)
- “Mua bút vở”: đúng Học tập, luật đoán (không đoán)
- “FAHASA Q1”: đúng Học tập, luật đoán (không đoán)
- “In tài liệu ôn thi”: đúng Học tập, luật đoán (không đoán)
- “Duolingo Super”: đúng Học tập, luật đoán (không đoán)
- “NETFLIX.COM”: đúng Giải trí, luật đoán Ăn uống
- “STEAMGAMES.COM”: đúng Giải trí, luật đoán Ăn uống
- “ve concert”: đúng Giải trí, luật đoán (không đoán)
- “Bowling cuối tuần”: đúng Giải trí, luật đoán (không đoán)
- “Vé công viên nước”: đúng Giải trí, luật đoán (không đoán)
- “YOUTUBE PREMIUM”: đúng Giải trí, luật đoán (không đoán)
- “Galaxy Cinema”: đúng Giải trí, luật đoán (không đoán)
- “Tour Hạ Long 2N1Đ”: đúng Giải trí, luật đoán (không đoán)
- “HASAKI.VN”: đúng Mua sắm, luật đoán (không đoán)
- “Điện Máy Xanh nồi cơm”: đúng Mua sắm, luật đoán Ăn uống
- “IKEA ke sach”: đúng Mua sắm, luật đoán Học tập
- “Watsons dầu gội”: đúng Mua sắm, luật đoán (không đoán)
- “Mua quà sinh nhật mẹ”: đúng Mua sắm, luật đoán (không đoán)
- “FPT TELECOM 0912”: đúng Hoá đơn, luật đoán (không đoán)
- “MOMO*NAP TIEN DT 0903”: đúng Hoá đơn, luật đoán (không đoán)
- “phi quan ly chung cu”: đúng Hoá đơn, luật đoán Mua sắm
- “Gas nấu ăn”: đúng Hoá đơn, luật đoán Ăn uống
- “Truyền hình K+”: đúng Hoá đơn, luật đoán (không đoán)
- “Phí dịch vụ tòa nhà”: đúng Hoá đơn, luật đoán (không đoán)

Tổng token đã dùng cho lần chạy này: 43.755.
---

# Lần chạy 2 — sau khi sửa (13/10/2026)

Thay đổi so với lần 1: mô tả thứ tự tháng của `so_sanh_hai_thang`; luật mặc định bỏ đuôi tên miền, thêm luật giao đồ ăn và cụm từ loại trừ; bộ lọc ngoài phạm vi dùng cụm từ cụ thể (trước đây "dich " chặn mọi câu có "giao dịch"). Thêm **bộ giữ riêng** (40 giao dịch, 15 câu hỏi) soạn sau lần 1, chỉ dùng để đo.


### Bộ gốc — phân loại (166 giao dịch)

| Danh mục | Số mẫu | F1 Chỉ luật | F1 Chỉ LLM | F1 Hybrid |
|---|---:|---:|---:|---:|
| Ăn uống | 25 | 91.3% | 93.9% | 98.0% |
| Di chuyển | 20 | 75.0% | 95.0% | 97.6% |
| Học tập | 18 | 80.0% | 94.1% | 94.1% |
| Giải trí | 20 | 78.8% | 97.4% | 97.4% |
| Mua sắm | 20 | 88.9% | 88.9% | 93.0% |
| Hoá đơn | 18 | 75.9% | 91.4% | 97.1% |
| Sức khoẻ | 18 | 83.9% | 100.0% | 97.1% |
| Khác | 10 | 0.0% | 82.4% | 94.7% |
| Lương | 6 | 90.9% | 100.0% | 100.0% |
| Thưởng | 4 | 100.0% | 100.0% | 100.0% |
| Thu khác | 7 | 83.3% | 100.0% | 100.0% |
| **Accuracy** | | **67.5%** | **93.4%** | **95.8%** |
| **Macro F1** | | **77.1%** | **94.8%** | **97.2%** |

<details><summary>Chỉ luật: sai 54</summary>

- “THE COFFEE HOUSE Q1”: đúng Ăn uống, đoán (không đoán)
- “STARBUCKS LANDMARK81”: đúng Ăn uống, đoán (không đoán)
- “Mì Quảng ếch”: đúng Ăn uống, đoán (không đoán)
- “Đi chợ mua rau”: đúng Ăn uống, đoán (không đoán)
- “BE*TRIP 22091”: đúng Di chuyển, đoán (không đoán)
- “PETROLIMEX CH 25”: đúng Di chuyển, đoán (không đoán)
- “Sửa xe máy”: đúng Di chuyển, đoán (không đoán)
- “VETC thu phi BOT”: đúng Di chuyển, đoán (không đoán)
- “thay nhot xe”: đúng Di chuyển, đoán (không đoán)
- “GOJEK*RIDE 1102”: đúng Di chuyển, đoán (không đoán)
- “Vé xe khách Phương Trang”: đúng Di chuyển, đoán (không đoán)
- “rua xe”: đúng Di chuyển, đoán (không đoán)
- “UDEMY*COURSE 9921”: đúng Học tập, đoán (không đoán)
- “COURSERA PLUS”: đúng Học tập, đoán (không đoán)
- “Mua bút vở”: đúng Học tập, đoán (không đoán)
- “FAHASA Q1”: đúng Học tập, đoán (không đoán)
- “In tài liệu ôn thi”: đúng Học tập, đoán (không đoán)
- “Duolingo Super”: đúng Học tập, đoán (không đoán)
- “STEAMGAMES.COM”: đúng Giải trí, đoán (không đoán)
- “ve concert”: đúng Giải trí, đoán (không đoán)
- “Bowling cuối tuần”: đúng Giải trí, đoán (không đoán)
- “Vé công viên nước”: đúng Giải trí, đoán (không đoán)
- “YOUTUBE PREMIUM”: đúng Giải trí, đoán (không đoán)
- “Galaxy Cinema”: đúng Giải trí, đoán (không đoán)
- “Tour Hạ Long 2N1Đ”: đúng Giải trí, đoán (không đoán)
- “HASAKI.VN”: đúng Mua sắm, đoán (không đoán)
- “IKEA ke sach”: đúng Mua sắm, đoán (không đoán)
- “Watsons dầu gội”: đúng Mua sắm, đoán (không đoán)
- “Mua quà sinh nhật mẹ”: đúng Mua sắm, đoán (không đoán)
- “FPT TELECOM 0912”: đúng Hoá đơn, đoán (không đoán)
- “MOMO*NAP TIEN DT 0903”: đúng Hoá đơn, đoán (không đoán)
- “phi quan ly chung cu”: đúng Hoá đơn, đoán (không đoán)
- “Gas nấu ăn”: đúng Hoá đơn, đoán (không đoán)
- “Truyền hình K+”: đúng Hoá đơn, đoán (không đoán)
- “Phí dịch vụ tòa nhà”: đúng Hoá đơn, đoán (không đoán)
- “nap the dien thoai”: đúng Hoá đơn, đoán (không đoán)
- “Vitamin C”: đúng Sức khoẻ, đoán (không đoán)
- “yoga thang 10”: đúng Sức khoẻ, đoán (không đoán)
- “Xét nghiệm máu”: đúng Sức khoẻ, đoán (không đoán)
- “Massage trị liệu”: đúng Sức khoẻ, đoán (không đoán)
- “kinh can”: đúng Sức khoẻ, đoán (không đoán)
- “Mừng cưới bạn”: đúng Khác, đoán (không đoán)
- “mung cuoi dong nghiep”: đúng Khác, đoán (không đoán)
- “Quà sinh nhật đồng nghiệp”: đúng Khác, đoán (không đoán)
- “CK NGUYEN VAN A chuyen tien”: đúng Khác, đoán (không đoán)
- “THANH TOAN QR 0912XXX”: đúng Khác, đoán (không đoán)
- “Từ thiện quỹ trẻ em”: đúng Khác, đoán (không đoán)
- “Phí chuyển tiền”: đúng Khác, đoán (không đoán)
- “rut tien ATM”: đúng Khác, đoán (không đoán)
- “Tiền lì xì”: đúng Khác, đoán (không đoán)
- “Đám hiếu”: đúng Khác, đoán (không đoán)
- “Salary Sep 2026”: đúng Lương, đoán (không đoán)
- “Lãi tiết kiệm”: đúng Thu khác, đoán (không đoán)
- “Được bạn trả nợ”: đúng Thu khác, đoán (không đoán)

</details>

<details><summary>Chỉ LLM: sai 11</summary>

- “Đi chợ mua rau”: đúng Ăn uống, đoán Mua sắm
- “WINMART+ 112 LE LOI”: đúng Ăn uống, đoán Mua sắm
- “XANH SM 0912”: đúng Di chuyển, đoán Mua sắm
- “Mua bút vở”: đúng Học tập, đoán Mua sắm
- “FAHASA Q1”: đúng Học tập, đoán Mua sắm
- “vexere ve xe di choi”: đúng Giải trí, đoán Di chuyển
- “MOMO*NAP TIEN DT 0903”: đúng Hoá đơn, đoán (không đoán)
- “Gas nấu ăn”: đúng Hoá đơn, đoán Ăn uống
- “CK NGUYEN VAN A chuyen tien”: đúng Khác, đoán (không đoán)
- “THANH TOAN QR 0912XXX”: đúng Khác, đoán (không đoán)
- “Phí chuyển tiền”: đúng Khác, đoán Hoá đơn

</details>

<details><summary>Hybrid: sai 7</summary>

- “WINMART+ 112 LE LOI”: đúng Ăn uống, đoán Mua sắm
- “Mua bút vở”: đúng Học tập, đoán Mua sắm
- “FAHASA Q1”: đúng Học tập, đoán Mua sắm
- “vexere ve xe di choi”: đúng Giải trí, đoán Di chuyển
- “MOMO*NAP TIEN DT 0903”: đúng Hoá đơn, đoán (không đoán)
- “kinh can”: đúng Sức khoẻ, đoán (không đoán)
- “THANH TOAN QR 0912XXX”: đúng Khác, đoán (không đoán)

</details>

### Bộ gốc — trích xuất (50 câu)

| Cách | Số tiền | Loại thu/chi | Ngày | Đúng cả 3 |
|---|---:|---:|---:|---:|
| Bộ parser luật | 100.0% | 96.0% | 100.0% | 96.0% |
| LLM | 100.0% | 100.0% | 100.0% | 100.0% |

### Bộ gốc — chatbot (30 câu hỏi)

| Cách | Đúng công cụ + tham số | Từ chối đúng | Thời gian TB |
|---|---:|---:|---:|
| Luật (planQuestion) | 96.7% | 6/6 | 0 ms |
| LLM function calling | 96.7% | 6/6 | 599 ms |

Câu sai:

- [Luật (planQuestion)] “Tháng này chi nhiều hơn tháng trước không?” → tong_thu_chi_thang({"thang":"2026-10"})
- [LLM function calling] “Khoản nào đắt nhất tháng 7?” → top_khoan_chi({"thang":"2026-07","so_luong":1})

### Bộ giữ riêng (chỉ để đo) — phân loại (40 giao dịch)

| Danh mục | Số mẫu | F1 Chỉ luật | F1 Chỉ LLM | F1 Hybrid |
|---|---:|---:|---:|---:|
| Ăn uống | 6 | 0.0% | 100.0% | 100.0% |
| Di chuyển | 5 | 57.1% | 100.0% | 90.9% |
| Học tập | 4 | 33.3% | 100.0% | 88.9% |
| Giải trí | 5 | 0.0% | 88.9% | 88.9% |
| Mua sắm | 5 | 0.0% | 88.9% | 88.9% |
| Hoá đơn | 4 | 40.0% | 88.9% | 75.0% |
| Sức khoẻ | 4 | 66.7% | 88.9% | 88.9% |
| Khác | 3 | 0.0% | 80.0% | 50.0% |
| Lương | 1 | 100.0% | 100.0% | 100.0% |
| Thưởng | 1 | 100.0% | 100.0% | 100.0% |
| Thu khác | 2 | 66.7% | 100.0% | 100.0% |
| **Accuracy** | | **22.5%** | **92.5%** | **87.5%** |
| **Macro F1** | | **42.2%** | **94.1%** | **88.3%** |

<details><summary>Chỉ luật: sai 31</summary>

- “Hủ tiếu Nam Vang”: đúng Ăn uống, đoán (không đoán)
- “KFC VINCOM THU DUC”: đúng Ăn uống, đoán (không đoán)
- “banh xeo mien tay”: đúng Ăn uống, đoán (không đoán)
- “Bò bía cổng trường”: đúng Ăn uống, đoán (không đoán)
- “NGON VILLA Q1”: đúng Ăn uống, đoán (không đoán)
- “pizza 4ps”: đúng Ăn uống, đoán (không đoán)
- “VIETJET AIR VJ123”: đúng Di chuyển, đoán Giải trí
- “Vé máy bay Tết”: đúng Di chuyển, đoán (không đoán)
- “thay lop xe dap”: đúng Di chuyển, đoán (không đoán)
- “Mua bộ đề luyện thi”: đúng Học tập, đoán (không đoán)
- “khoa tieng nhat online”: đúng Học tập, đoán (không đoán)
- “Thư viện thẻ năm”: đúng Học tập, đoán (không đoán)
- “Ve xem bong da My Dinh”: đúng Giải trí, đoán (không đoán)
- “Escape room với bạn”: đúng Giải trí, đoán (không đoán)
- “APPLE.COM/BILL ICLOUD”: đúng Giải trí, đoán (không đoán)
- “Vé bảo tàng”: đúng Giải trí, đoán (không đoán)
- “Đi Vũng Tàu cuối tuần”: đúng Giải trí, đoán (không đoán)
- “SENDO*DON 4410”: đúng Mua sắm, đoán (không đoán)
- “Mua ốp điện thoại”: đúng Mua sắm, đoán (không đoán)
- “BACH HOA XANH Q7 do dung”: đúng Mua sắm, đoán Ăn uống
- “Túi xách Charles & Keith”: đúng Mua sắm, đoán (không đoán)
- “kem chong nang”: đúng Mua sắm, đoán (không đoán)
- “VNPT TRA SAU T9”: đúng Hoá đơn, đoán (không đoán)
- “Phí rác tháng 10”: đúng Hoá đơn, đoán (không đoán)
- “nuoc sach thang 9”: đúng Hoá đơn, đoán Học tập
- “Nhổ răng khôn”: đúng Sức khoẻ, đoán (không đoán)
- “tiem vac xin cum”: đúng Sức khoẻ, đoán (không đoán)
- “CK TRAN THI B tien hui”: đúng Khác, đoán (không đoán)
- “Phat nguoi xe may”: đúng Khác, đoán (không đoán)
- “Đóng góp quỹ lớp”: đúng Khác, đoán (không đoán)
- “Bán sách cũ”: đúng Thu khác, đoán (không đoán)

</details>

<details><summary>Chỉ LLM: sai 3</summary>

- “APPLE.COM/BILL ICLOUD”: đúng Giải trí, đoán Hoá đơn
- “kem chong nang”: đúng Mua sắm, đoán Sức khoẻ
- “CK TRAN THI B tien hui”: đúng Khác, đoán (không đoán)

</details>

<details><summary>Hybrid: sai 5</summary>

- “APPLE.COM/BILL ICLOUD”: đúng Giải trí, đoán Hoá đơn
- “kem chong nang”: đúng Mua sắm, đoán Sức khoẻ
- “nuoc sach thang 9”: đúng Hoá đơn, đoán Học tập
- “CK TRAN THI B tien hui”: đúng Khác, đoán (không đoán)
- “Phat nguoi xe may”: đúng Khác, đoán Di chuyển

</details>

### Bộ giữ riêng (chỉ để đo) — chatbot (15 câu hỏi)

| Cách | Đúng công cụ + tham số | Từ chối đúng | Thời gian TB |
|---|---:|---:|---:|
| Luật (planQuestion) | 100.0% | 3/3 | 0 ms |
| LLM function calling | 100.0% | 3/3 | 595 ms |

Tổng token đã dùng cho lần chạy này: 58.780.