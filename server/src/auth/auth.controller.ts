import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ThrottlerGuard } from "@nestjs/throttler";
import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";
import type { CookieOptions, Request, Response } from "express";
import type { AuthSession } from "@shared/types";
import {
  ACCESS_COOKIE,
  CurrentUser,
  Public,
  REFRESH_COOKIE,
  ROLE_COOKIE,
  type AuthUser,
} from "../common/auth";
import { AppConfig } from "../common/config";
import { AuthService, type IssuedTokens } from "./auth.service";

const STR = { message: "Dữ liệu chưa hợp lệ." };

export class LoginDto {
  @IsString(STR) @MaxLength(254, STR) email: string;
  @IsString(STR) @MaxLength(200, STR) password: string;
}

export class RegisterDto {
  @IsString(STR) @MaxLength(80, { message: "Họ tên tối đa 80 ký tự" }) fullName: string;
  @IsString(STR) @MaxLength(254, STR) email: string;
  @IsString(STR) @MaxLength(200, STR) password: string;
}

export class ForgotPasswordDto {
  @IsString(STR) @MaxLength(254, STR) email: string;
}

export class ResetPasswordDto {
  @IsEmail({}, { message: "Email chưa đúng định dạng, ví dụ ten@example.com" }) email: string;
  @IsString(STR) @MaxLength(10, STR) code: string;
  @IsString(STR) @MaxLength(200, STR) password: string;
}

export class ChangePasswordDto {
  @IsString(STR) @MaxLength(200, STR) currentPassword: string;
  @IsString(STR) @MaxLength(200, STR) newPassword: string;
  @IsOptional() @IsString(STR) confirm?: string;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  private cookieBase(): CookieOptions {
    return { sameSite: "lax", secure: this.config.isProduction };
  }

  private setCookies(res: Response, tokens: IssuedTokens): AuthSession {
    const base = this.cookieBase();
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...base,
      httpOnly: true,
      path: "/",
      maxAge: this.config.get("ACCESS_TOKEN_TTL_MIN") * 60_000,
    });
    const refreshAge = this.config.get("REFRESH_TOKEN_TTL_DAYS") * 86_400_000;
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, { ...base, httpOnly: true, path: "/api/auth", maxAge: refreshAge });
    // Chỉ để Next proxy chuyển hướng cho mượt; không phải bằng chứng quyền
    res.cookie(ROLE_COOKIE, tokens.session.role, { ...base, httpOnly: false, path: "/", maxAge: refreshAge });
    return tokens.session;
  }

  private clearCookies(res: Response) {
    const base = this.cookieBase();
    res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
    res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/auth" });
    res.clearCookie(ROLE_COOKIE, { ...base, path: "/" });
  }

  private refreshCookie(req: Request): string | undefined {
    return (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    return this.setCookies(res, await this.auth.login(dto.email, dto.password));
  }

  @Public()
  @Post("register")
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    return this.setCookies(res, await this.auth.register(dto));
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthSession> {
    try {
      return this.setCookies(res, await this.auth.refresh(this.refreshCookie(req)));
    } catch (error) {
      this.clearCookies(res);
      throw error;
    }
  }

  @Public()
  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(this.refreshCookie(req));
    this.clearCookies(res);
  }

  @Get("me")
  me(@CurrentUser() user: AuthUser): Promise<AuthSession> {
    return this.auth.me(user.id);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post("forgot-password")
  @HttpCode(204)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post("reset-password")
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.email, dto.code, dto.password);
  }

  @Patch("password")
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.setCookies(res, await this.auth.changePassword(user.id, dto.currentPassword, dto.newPassword));
  }
}
