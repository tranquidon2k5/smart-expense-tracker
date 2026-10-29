/**
 * Dịch thông báo lỗi do máy chủ, bản giả lập và logic dùng chung (shared/) tạo ra. Các nơi đó trả câu
 * tiếng Việt (backend dùng chung một bộ quy tắc); giao diện tiếng Anh tra bảng dưới đây, câu chưa có
 * trong bảng thì giữ nguyên tiếng Việt thay vì đoán.
 */
import { getActiveLocale } from "./core";

/** Câu cố định → bản tiếng Anh */
const EXACT: Record<string, string> = {
  // Kết nối, phiên, quyền
  "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại nhé.": "Can't reach the server. Check your connection and try again.",
  "Máy chủ gặp lỗi. Thử lại sau ít phút nhé.": "The server ran into a problem. Please try again in a few minutes.",
  "Có lỗi xảy ra.": "Something went wrong.",
  "Dữ liệu gửi lên chưa hợp lệ.": "The submitted data isn't valid.",
  "Dữ liệu chưa hợp lệ.": "The data isn't valid.",
  "Phiên đăng nhập đã hết. Đăng nhập lại nhé.": "Your session has expired. Please log in again.",
  "Bạn không có quyền thực hiện thao tác này.": "You don't have permission to do this.",
  "Không tìm thấy dữ liệu, có thể đã bị xoá.": "Data not found; it may have been deleted.",
  "Dữ liệu đã thay đổi, tải lại trang rồi thử lại nhé.": "The data has changed. Reload the page and try again.",
  "Dữ liệu gửi lên quá lớn.": "The submitted data is too large.",
  "Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại nhé.": "You're going too fast. Wait a moment and try again.",
  "Bạn đã thử quá nhiều lần. Đợi 15 phút rồi thử lại nhé.": "Too many attempts. Wait 15 minutes and try again.",
  "Bạn cần đăng nhập để tiếp tục.": "Please log in to continue.",
  "Bạn không có quyền truy cập trang quản trị.": "You don't have access to the admin console.",
  "Trợ lý trả lời quá 5 giây. Có thể mạng đang chậm, bạn thử lại nhé.": "The assistant took more than 5 seconds. The network may be slow; please try again.",
  // Tài khoản
  "Email hoặc mật khẩu chưa đúng. Kiểm tra lại giúp mình nhé.": "Incorrect email or password. Please check and try again.",
  "Tài khoản này đang bị khoá. Liên hệ quản trị viên qua hotro@sotien.vn để được mở lại.":
    "This account is locked. Contact the administrator at hotro@sotien.vn to have it unlocked.",
  "Email này đã có tài khoản. Bạn đăng nhập hoặc lấy lại mật khẩu nhé.": "This email already has an account. Log in or reset your password.",
  "Email này đã được tài khoản khác sử dụng": "This email is already used by another account",
  "Email chưa đúng định dạng, ví dụ ten@example.com": "Email format looks wrong, e.g. name@example.com",
  "Nhập email của bạn": "Enter your email",
  "Nhập họ tên của bạn": "Enter your full name",
  "Nhập mật khẩu": "Enter a password",
  "Họ tên tối đa 80 ký tự": "Full name can be at most 80 characters",
  "Mã gồm 6 chữ số": "The code has 6 digits",
  "Mã chưa đúng hoặc đã hết hạn. Kiểm tra email mới nhất hoặc gửi lại mã.": "The code is wrong or expired. Check your latest email or resend the code.",
  "Mật khẩu hiện tại chưa đúng": "Your current password is incorrect",
  "Mật khẩu mới cần khác mật khẩu hiện tại": "The new password must differ from the current one",
  "Gõ đúng XOÁ DỮ LIỆU để xác nhận.": "Type XOÁ DỮ LIỆU exactly to confirm.",
  "Đơn vị tiền tệ này chưa được hỗ trợ.": "This currency isn't supported yet.",
  "Múi giờ không hợp lệ.": "Invalid time zone.",
  "Giờ nhắc cần dạng HH:mm, ví dụ 20:00.": "Reminder time must be HH:mm, e.g. 20:00.",
  "Nhắc nhở đang tắt. Bật lại để gửi thử.": "Reminders are off. Turn them on to send a test.",
  // Giao dịch, ví, danh mục, ngân sách
  "Không tìm thấy giao dịch, có thể đã bị xoá.": "Transaction not found; it may have been deleted.",
  "Số tiền chưa hợp lệ": "Invalid amount",
  "Số tiền phải lớn hơn 0đ.": "The amount must be greater than 0₫.",
  "Số tiền quá lớn, bạn kiểm tra lại số 0 nhé.": "That amount is too large; please check the zeros.",
  "Ngày chưa hợp lệ.": "Invalid date.",
  "Ngày giao dịch không được sau hôm nay.": "The transaction date can't be after today.",
  "Chọn danh mục cho giao dịch.": "Pick a category for the transaction.",
  "Chưa có danh mục mặc định để xếp giao dịch.": "There's no default category to file the transaction under.",
  "Nhập một câu, ví dụ “ăn phở 45k”.": "Type a sentence, e.g. “ăn phở 45k”.",
  "Câu ghi nhanh tối đa 200 ký tự.": "Quick-add sentences can be at most 200 characters.",
  "Hôm nay bạn đã có khoản chi nên không đánh dấu “không chi tiêu” được.": "You've already logged spending today, so you can't mark it as a no-spend day.",
  "Hôm nay bạn đã đánh dấu không chi tiêu rồi.": "You've already marked today as a no-spend day.",
  "Ví không tồn tại.": "Wallet doesn't exist.",
  "Ví đích không tồn tại.": "The destination wallet doesn't exist.",
  "Loại ví không hợp lệ.": "Invalid wallet type.",
  "Nhập tên ví.": "Enter a wallet name.",
  "Tên ví tối đa 50 ký tự.": "Wallet names can be at most 50 characters.",
  "Số dư ban đầu chưa hợp lệ.": "Invalid opening balance.",
  "Cần giữ lại ít nhất một ví.": "You need to keep at least one wallet.",
  "Chọn ví chuyển và ví nhận.": "Pick the source and destination wallets.",
  "Ví chuyển và ví nhận phải khác nhau.": "The source and destination wallets must be different.",
  "Ngày chuyển chưa hợp lệ.": "Invalid transfer date.",
  "Ngày chuyển không được sau hôm nay.": "The transfer date can't be after today.",
  "Ghi chú tối đa 100 ký tự.": "Notes can be at most 100 characters.",
  "Danh mục không tồn tại.": "Category doesn't exist.",
  "Không tìm thấy danh mục, có thể đã bị xoá.": "Category not found; it may have been deleted.",
  "Danh mục mặc định không sửa hoặc xoá được.": "Default categories can't be edited or deleted.",
  "Nhập tên danh mục.": "Enter a category name.",
  "Tên danh mục cần ít nhất 2 ký tự.": "The category name needs at least 2 characters.",
  "Chọn một biểu tượng trong danh sách.": "Pick an icon from the list.",
  "Chọn một màu trong bảng màu.": "Pick a color from the palette.",
  "Biểu tượng chưa hợp lệ.": "Invalid icon.",
  "Màu cần dạng #RRGGBB.": "Colors must be #RRGGBB.",
  "Chọn loại thu hoặc chi.": "Choose income or expense.",
  "Danh mục nhận phải cùng loại thu/chi.": "The destination category must be the same income/expense type.",
  "Chọn danh mục để chuyển các giao dịch đang dùng danh mục này.": "Pick a category to move this category's transactions to.",
  "Danh mục đang có giao dịch nên không đổi được loại thu/chi.": "This category has transactions, so its income/expense type can't change.",
  "Danh mục đang được dùng trong ngân sách hoặc luật phân loại nên không xoá được.": "This category is used by a budget or a rule, so it can't be deleted.",
  "Không tìm thấy ngân sách, có thể đã bị xoá.": "Budget not found; it may have been deleted.",
  "Chỉ đặt ngân sách cho danh mục chi.": "Budgets can only be set for expense categories.",
  "Hạn mức phải là số.": "The limit must be a number.",
  "Hạn mức phải lớn hơn 0đ.": "The limit must be greater than 0₫.",
  "Hạn mức quá lớn, bạn kiểm tra lại số 0 nhé.": "That limit is too large; please check the zeros.",
  "Tháng cần dạng yyyy-MM, ví dụ 2026-10.": "Months must be yyyy-MM, e.g. 2026-10.",
  "Từ khoá không được để trống.": "The keyword can't be empty.",
  "Từ khoá tối đa 60 ký tự.": "Keywords can be at most 60 characters.",
  // Nhập CSV
  "File trống, không có dữ liệu để nhập.": "The file is empty; there's nothing to import.",
  "File không phải dạng văn bản CSV. Nếu bạn có file Excel (.xlsx), hãy mở và lưu lại dưới dạng CSV.":
    "The file isn't plain-text CSV. If you have an Excel file (.xlsx), open it and save it as CSV.",
  "File cần ít nhất 3 cột: ngày, số tiền và nội dung. Hãy kiểm tra file có đúng là sao kê và dùng dấu phẩy hoặc chấm phẩy để ngăn cột.":
    "The file needs at least 3 columns: date, amount and description. Check that it's a statement using commas or semicolons as separators.",
  "File chỉ có dòng tiêu đề, chưa có giao dịch nào.": "The file only has a header row and no transactions.",
  "Dữ liệu file chưa hợp lệ. Chọn lại file nhé.": "The file data isn't valid. Please choose the file again.",
  "Cách đọc số tiền chưa hợp lệ.": "Invalid amount reading mode.",
  "Không tải được file mẫu. Thử lại nhé.": "Couldn't load the sample file. Please try again.",
  "Thiếu ngày": "Missing date",
  "Ngày không có trên lịch (sai ngày hoặc tháng)": "Not a real calendar date (wrong day or month)",
  "Ngày không đọc được (cần dạng dd/MM/yyyy)": "Unreadable date (expected dd/MM/yyyy)",
  "Ngày ở tương lai": "Date is in the future",
  "Thiếu số tiền": "Missing amount",
  "Số tiền không đọc được": "Unreadable amount",
  "Số tiền bằng 0": "Amount is 0",
  "Thiếu nội dung giao dịch": "Missing description",
  // Trợ lý
  "Nhập câu hỏi trước khi gửi nhé.": "Type a question before sending.",
  "Không tìm thấy cuộc trò chuyện, có thể đã bị xoá.": "Conversation not found; it may have been deleted.",
  // Quản trị
  "Không tìm thấy người dùng.": "User not found.",
  "Bạn không thể tự khoá tài khoản của mình.": "You can't lock your own account.",
  "Không khoá được tài khoản quản trị viên khác từ đây.": "Other admin accounts can't be locked from here.",
  "Không tìm thấy câu.": "Message not found.",
  "Câu khích lệ cần ít nhất 10 ký tự.": "Messages need at least 10 characters.",
  "Câu khích lệ tối đa 200 ký tự để hiển thị gọn.": "Messages can be at most 200 characters to display neatly.",
  "Ngữ cảnh không hợp lệ.": "Invalid context.",
  "Không tìm thấy nhiệm vụ.": "Mission not found.",
  "Tên nhiệm vụ cần ít nhất 5 ký tự.": "Mission names need at least 5 characters.",
  "Tên nhiệm vụ tối đa 80 ký tự.": "Mission names can be at most 80 characters.",
  "Mục tiêu là số nguyên từ 1 đến 100.": "The target must be a whole number from 1 to 100.",
  "XP phải là số nguyên.": "XP must be a whole number.",
  "Chu kỳ không hợp lệ.": "Invalid period.",
  "Mã nhiệm vụ chưa hợp lệ.": "Invalid mission code.",
  "Không đổi được chu kỳ của nhiệm vụ đang chạy. Tạo nhiệm vụ mới thay thế.": "A running mission's period can't change. Create a new mission instead.",
  "Không tìm thấy huy hiệu.": "Badge not found.",
  "Tên huy hiệu cần ít nhất 2 ký tự.": "Badge names need at least 2 characters.",
  "Mô tả điều kiện cần ít nhất 5 ký tự.": "Condition descriptions need at least 5 characters.",
};

/** Câu có biến → hàm dựng bản tiếng Anh từ các nhóm bắt được */
const PATTERNS: [RegExp, (...m: string[]) => string][] = [
  [/^Mật khẩu tối đa (\d+) ký tự$/, (n) => `Password can be at most ${n} characters`],
  [/^Mật khẩu cần: (.+)$/, (what) => `Password needs: ${PASSWORD_CHECKS[what] ?? what}`],
  [/^Tên tối đa (\d+) ký tự\.$/, (n) => `Names can be at most ${n} characters.`],
  [/^Câu hỏi tối đa (\d+) ký tự\.$/, (n) => `Questions can be at most ${n} characters.`],
  [/^Đã có danh mục (thu|chi) “(.+)”\.$/, (t, name) => `There's already an ${t === "thu" ? "income" : "expense"} category “${name}”.`],
  [/^Đã có danh mục mặc định “(.+)”\.$/, (name) => `There's already a default category “${name}”.`],
  [/^Danh mục đang được dùng cho (\d+) giao dịch nên không xoá được\. Bạn có thể đổi tên thay vì xoá\.$/, (n) => `This category is used by ${n} transactions, so it can't be deleted. You can rename it instead.`],
  [/^Ví đang có (\d+) giao dịch nên chưa xoá được\. Chuyển giao dịch sang ví khác trước nhé\.$/, (n) => `This wallet has ${n} transactions, so it can't be deleted yet. Move them to another wallet first.`],
  [/^Số dư (.+) không đủ \(còn (.+)\)\.$/, (name, left) => `Not enough balance in ${name} (${left} left).`],
  [/^Số dư (.+) không đủ\.$/, (name) => `Not enough balance in ${name}.`],
  [/^File “(.+)” có định dạng (.+)\. Sổ Tiền chỉ đọc được file CSV \(\.csv\)\.$/, (name, ext) => `“${name}” is a ${ext === "không rõ" ? "unknown" : ext} file. Sổ Tiền can only read CSV files (.csv).`],
  [/^File nặng (.+) MB, vượt giới hạn 2 MB\. Hãy chia nhỏ theo tháng\.$/, (mb) => `The file is ${mb} MB, over the 2 MB limit. Split it by month.`],
  [/^File có (\d+) dòng, vượt giới hạn (\d+) dòng mỗi lần nhập\. Hãy chia nhỏ file theo tháng\.$/, (n, max) => `The file has ${n} rows, over the ${max}-row limit per import. Split it by month.`],
  [/^File có hơn (\d+) dòng\. Hãy chia nhỏ theo tháng\.$/, (max) => `The file has more than ${max} rows. Split it by month.`],
  [/^Chưa ánh xạ đủ cột: (.+)\.$/, (list) => `Not all columns are mapped: ${list.split("; ").map(translateMapping).join("; ")}.`],
  [/^(Chọn cột chứa .+|Cột này đang dùng cho .+)$/, (m) => translateMapping(m)],
  [/^Mã (.+) đã tồn tại\.$/, (code) => `Code ${code} already exists.`],
  [/^XP của nhiệm vụ (ngày|tuần) trong khoảng 5–(\d+)\.$/, (p, max) => `XP for a ${p === "ngày" ? "daily" : "weekly"} mission must be 5–${max}.`],
  [/^“(.+)” cần còn ít nhất 1 câu đang bật\. Thêm câu khác trước khi tắt câu này\.$/, (ctx) => `“${ctx}” needs at least 1 active message. Add another before turning this one off.`],
];

const PASSWORD_CHECKS: Record<string, string> = {
  "ít nhất 8 ký tự": "at least 8 characters",
  "có chữ cái": "a letter",
  "có chữ số": "a digit",
};

const FIELDS: Record<string, string> = { ngày: "date", "số tiền": "amount", "nội dung": "description" };

function translateMapping(text: string): string {
  const pick = text.match(/^Chọn cột chứa (.+)$/);
  if (pick) return `Pick the ${FIELDS[pick[1]] ?? pick[1]} column`;
  const used = text.match(/^Cột này đang dùng cho (.+)$/);
  if (used) return `This column is already used for ${FIELDS[used[1]] ?? used[1]}`;
  return text;
}

/** Thông báo lỗi theo ngôn ngữ giao diện; câu không có trong bảng giữ nguyên */
export function te(message: string): string;
export function te(message: string | null | undefined): string | null | undefined;
export function te(message: string | null | undefined) {
  if (!message || getActiveLocale() === "vi") return message;
  const exact = EXACT[message.trim()];
  if (exact) return exact;
  for (const [re, build] of PATTERNS) {
    const m = message.trim().match(re);
    if (m) return build(...m.slice(1));
  }
  return message;
}
