import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import type { AuthSession, RegisterInput } from "@shared/types";
import { cleanFullName, validateEmail, validatePassword } from "@shared/validation";
import { LOCKED_MESSAGE, type AccessPayload } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { AppConfig } from "../common/config";
import { AppError, badRequest, forbidden, unauthorized } from "../common/errors";
import { MailService } from "../common/mail.service";
import { toSession } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { GamificationService } from "../gamification/gamification.service";

export const LOGIN_FAILED = "Email hoặc mật khẩu chưa đúng. Kiểm tra lại giúp mình nhé.";
const RESET_INVALID = "Mã chưa đúng hoặc đã hết hạn. Kiểm tra email mới nhất hoặc gửi lại mã.";
const RESET_TTL_MIN = 15;
const RESET_MAX_ATTEMPTS = 5;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  session: AuthSession;
}

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

@Injectable()
export class AuthService {
  /** Băm giả để so sánh khi email không tồn tại — thời gian phản hồi như nhau, không lộ email */
  private dummyHash: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly clock: ClockService,
    private readonly mail: MailService,
    private readonly gamification: GamificationService,
  ) {
    this.dummyHash = bcrypt.hash("khong-phai-mat-khau-that-1", config.get("BCRYPT_COST"));
  }

  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.config.get("BCRYPT_COST"));
  }

  // ───────────── Token ─────────────

  private async issue(user: { id: string; role: "user" | "admin"; email: string; fullName: string; timezone: string }, familyId?: string): Promise<IssuedTokens> {
    const payload: AccessPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = randomBytes(48).toString("base64url");
    const days = this.config.get("REFRESH_TOKEN_TTL_DAYS");
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        familyId: familyId ?? randomBytes(12).toString("hex"),
        expiresAt: new Date(this.clock.now().getTime() + days * 86_400_000),
      },
    });
    return { accessToken, refreshToken, session: toSession(user) };
  }

  /**
   * Xoay vòng refresh token: token cũ bị thu hồi, cấp token mới cùng "họ". Dùng lại token đã
   * thu hồi (dấu hiệu bị đánh cắp) → thu hồi cả họ, buộc đăng nhập lại.
   */
  async refresh(refreshToken: string | undefined): Promise<IssuedTokens> {
    const expired = () => unauthorized("Phiên đăng nhập đã hết. Đăng nhập lại nhé.", "SESSION_EXPIRED");
    if (!refreshToken) throw expired();
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) }, include: { user: true } });
    const now = this.clock.now();
    if (!row) throw expired();
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: now } });
      throw expired();
    }
    if (row.expiresAt <= now) throw expired();
    if (row.user.isLocked) {
      await this.revokeAll(row.userId);
      throw unauthorized(LOCKED_MESSAGE, "ACCOUNT_LOCKED");
    }
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: now } });
    if (!claimed.count) throw expired();
    return this.issue(row.user, row.familyId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (row) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: this.clock.now() } });
    }
  }

  async revokeAll(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: this.clock.now() } });
  }

  // ───────────── Đăng nhập / đăng ký ─────────────

  async login(email: string, password: string): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Không nói rõ sai email hay sai mật khẩu để không lộ email nào đã đăng ký
    const ok = await bcrypt.compare(password ?? "", user?.passwordHash ?? (await this.dummyHash));
    if (!user || !ok) throw unauthorized(LOGIN_FAILED, "INVALID_CREDENTIALS");
    if (user.isLocked) throw forbidden(LOCKED_MESSAGE, "ACCOUNT_LOCKED");
    const today = this.clock.today(user.timezone);
    await this.prisma.$transaction((tx) => this.gamification.recordActivity(tx, user.id, today, "login"));
    return this.issue(user);
  }

  async register(input: RegisterInput): Promise<IssuedTokens> {
    const fullName = cleanFullName(input.fullName ?? "");
    if (!fullName) throw badRequest("Nhập họ tên của bạn", "fullName");
    const emailError = validateEmail(input.email ?? "");
    if (emailError) throw badRequest(emailError, "email");
    const passwordError = validatePassword(input.password ?? "");
    if (passwordError) throw badRequest(passwordError, "password");
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new AppError(409, "Email này đã có tài khoản. Bạn đăng nhập hoặc lấy lại mật khẩu nhé.", { field: "email" });
    }
    const passwordHash = await this.hashPassword(input.password);
    // Sổ mới: một ví Tiền mặt, chuỗi và cấp độ bắt đầu từ 0
    const user = await this.prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        createdAt: this.clock.now(),
        wallets: { create: { name: "Tiền mặt", type: "cash" } },
        streak: { create: {} },
        level: { create: {} },
      },
    });
    return this.issue(user);
  }

  async me(userId: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return toSession(user);
  }

  // ───────────── Quên / đổi mật khẩu ─────────────

  private codeHash(userId: string, code: string): string {
    return createHmac("sha256", this.config.get("JWT_SECRET")).update(`${userId}:${code}`).digest("hex");
  }

  /** Luôn "thành công" dù email có tồn tại hay không (không lộ tài khoản) */
  async requestPasswordReset(email: string): Promise<void> {
    const emailError = validateEmail(email ?? "");
    if (emailError) throw badRequest(emailError, "email");
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || user.isLocked) return;
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const now = this.clock.now();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, codeHash: this.codeHash(user.id, code), expiresAt: new Date(now.getTime() + RESET_TTL_MIN * 60_000) },
      }),
    ]);
    await this.mail.send({
      to: user.email,
      subject: `Mã đặt lại mật khẩu Sổ Tiền: ${code}`,
      text:
        `Chào ${user.fullName},\n\nMã đặt lại mật khẩu của bạn là ${code}. Mã có hiệu lực trong ${RESET_TTL_MIN} phút.\n` +
        `Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.\n\nSổ Tiền`,
    });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    if (!/^\d{6}$/.test((code ?? "").trim())) throw badRequest("Mã gồm 6 chữ số", "code");
    const user = await this.prisma.user.findUnique({ where: { email: (email ?? "").trim().toLowerCase() } });
    const now = this.clock.now();
    const token = user
      ? await this.prisma.passwordResetToken.findFirst({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: "desc" },
        })
      : null;
    if (!user || !token || token.attempts >= RESET_MAX_ATTEMPTS) throw badRequest(RESET_INVALID, "code");
    const expected = Buffer.from(token.codeHash, "hex");
    const actual = Buffer.from(this.codeHash(user.id, code.trim()), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
      throw badRequest(RESET_INVALID, "code");
    }
    const passwordError = validatePassword(newPassword ?? "");
    if (passwordError) throw badRequest(passwordError, "password");
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
    ]);
  }

  /** Đổi mật khẩu: thu hồi mọi phiên khác, cấp lại phiên cho thiết bị đang dùng */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword ?? "", user.passwordHash))) {
      throw badRequest("Mật khẩu hiện tại chưa đúng", "currentPassword");
    }
    const passwordError = validatePassword(newPassword ?? "");
    if (passwordError) throw badRequest(passwordError, "password");
    if (currentPassword === newPassword) throw badRequest("Mật khẩu mới cần khác mật khẩu hiện tại", "password");
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(newPassword) } });
    await this.revokeAll(userId);
    return this.issue(user);
  }
}
