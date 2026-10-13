import { Injectable, Logger } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { AppConfig } from "./config";

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Gửi email qua SMTP (dev: Mailpit, xem ở http://localhost:8025). Không cấu hình SMTP_HOST thì
 * chỉ ghi log. `outbox` giữ các thư gần nhất để test e2e đọc được mã đặt lại mật khẩu.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger("Mail");
  private readonly transport: Transporter | null;
  readonly outbox: SentMail[] = [];

  constructor(private readonly config: AppConfig) {
    const host = config.get("SMTP_HOST");
    this.transport = host ? nodemailer.createTransport({ host, port: config.get("SMTP_PORT"), secure: false }) : null;
  }

  async send(mail: SentMail): Promise<void> {
    this.outbox.push(mail);
    if (this.outbox.length > 50) this.outbox.shift();
    if (!this.transport) {
      this.logger.log(`(không có SMTP) Thư tới ${mail.to}: ${mail.subject}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.config.get("MAIL_FROM"), ...mail });
    } catch (error) {
      // Email là kênh phụ: lỗi gửi không được làm hỏng thao tác chính
      this.logger.warn(`Không gửi được thư tới ${mail.to}: ${(error as Error).message}`);
    }
  }
}
