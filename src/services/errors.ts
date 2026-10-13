/** Lỗi giao diện hiểu được — dùng chung cho bản mock và bản gọi API */

/** Lỗi có thể chỉ ra ô nhập gây lỗi để giao diện đặt thông báo ngay dưới ô đó */
export class AuthError extends Error {
  constructor(
    message: string,
    public field?: "email" | "password" | "currentPassword" | "code" | "fullName",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** PRD §8: chatbot phản hồi dưới 5 giây — quá thì báo lỗi để người dùng thử lại */
export class ChatTimeoutError extends Error {
  constructor() {
    super("Trợ lý trả lời quá 5 giây. Có thể mạng đang chậm, bạn thử lại nhé.");
    this.name = "ChatTimeoutError";
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Bạn không có quyền truy cập trang quản trị.");
    this.name = "ForbiddenError";
  }
}
