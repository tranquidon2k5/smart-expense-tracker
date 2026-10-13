import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Response } from "express";
import { ThrottlerException } from "@nestjs/throttler";

/** Body lỗi thống nhất: giao diện đọc `message` (tiếng Việt) và `field` để đặt lỗi dưới ô nhập */
export interface ErrorBody {
  statusCode: number;
  message: string;
  field?: string;
  code?: string;
}

export class AppError extends HttpException {
  constructor(status: number, message: string, extra: { field?: string; code?: string } = {}) {
    super({ statusCode: status, message, ...extra } satisfies ErrorBody, status);
  }
}

export const badRequest = (message: string, field?: string) => new AppError(HttpStatus.BAD_REQUEST, message, { field });
export const notFound = (message: string) => new AppError(HttpStatus.NOT_FOUND, message);
export const forbidden = (message: string, code?: string) => new AppError(HttpStatus.FORBIDDEN, message, { code });
export const unauthorized = (message: string, code?: string) => new AppError(HttpStatus.UNAUTHORIZED, message, { code });
export const conflict = (message: string, field?: string) => new AppError(HttpStatus.CONFLICT, message, { field });

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Dữ liệu gửi lên chưa hợp lệ.",
  401: "Phiên đăng nhập đã hết. Đăng nhập lại nhé.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu, có thể đã bị xoá.",
  409: "Dữ liệu đã thay đổi, tải lại trang rồi thử lại nhé.",
  413: "Dữ liệu gửi lên quá lớn.",
  429: "Bạn thao tác quá nhanh. Đợi một lúc rồi thử lại nhé.",
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (body.statusCode >= 500) this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: 429,
        message: "Bạn đã thử quá nhiều lần. Đợi 15 phút rồi thử lại nhé.",
        code: "RATE_LIMITED",
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === "object" && raw !== null) {
        const r = raw as { message?: unknown; field?: string; code?: string };
        // ValidationPipe: message là mảng câu lỗi tiếng Việt từ DTO → lấy câu đầu
        const message = Array.isArray(r.message) ? String(r.message[0]) : typeof r.message === "string" ? r.message : "";
        const english = !message || (exception instanceof BadRequestException && /^[\x00-\x7F]*$/.test(message));
        return {
          statusCode: status,
          message: english ? (DEFAULT_MESSAGES[status] ?? "Có lỗi xảy ra.") : message,
          ...(r.field ? { field: r.field } : {}),
          ...(r.code ? { code: r.code } : {}),
        };
      }
      return { statusCode: status, message: DEFAULT_MESSAGES[status] ?? "Có lỗi xảy ra." };
    }
    return { statusCode: 500, message: "Máy chủ gặp lỗi. Thử lại sau ít phút nhé." };
  }
}
