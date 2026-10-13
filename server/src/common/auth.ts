import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { UserRole } from "@shared/types";
import { forbidden, unauthorized } from "./errors";
import { PrismaService } from "./prisma.service";

export const ACCESS_COOKIE = "st_access";
export const REFRESH_COOKIE = "st_refresh";
/** Cookie không httpOnly, chỉ để Next proxy biết có phiên/vai trò (quyền thật vẫn kiểm ở server) */
export const ROLE_COOKIE = "st_role";

export const LOCKED_MESSAGE = "Tài khoản này đang bị khoá. Liên hệ quản trị viên qua hotro@sotien.vn để được mở lại.";

export interface AuthUser {
  id: string;
  role: UserRole;
  email: string;
  fullName: string;
  timezone: string;
}

export interface AccessPayload {
  sub: string;
  role: UserRole;
}

const IS_PUBLIC = "isPublic";
const ROLES = "roles";

/** Route không cần đăng nhập */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Route chỉ cho các vai trò này */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES, roles);

/** Người dùng lấy từ token — mọi truy vấn dữ liệu lọc theo `user.id` này, không lấy từ body/query */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user;
});

function readToken(req: Request): string | null {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[ACCESS_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Guard toàn cục: kiểm JWT trong cookie httpOnly (hoặc Bearer), rồi đọc lại người dùng trong DB
 * để tài khoản vừa bị khoá bị chặn ngay ở lần gọi kế tiếp.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, handlers)) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = readToken(req);
    if (!token) throw unauthorized("Bạn cần đăng nhập để tiếp tục.", "UNAUTHENTICATED");
    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token);
    } catch {
      throw unauthorized("Phiên đăng nhập đã hết. Đăng nhập lại nhé.", "TOKEN_EXPIRED");
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, email: true, fullName: true, timezone: true, isLocked: true },
    });
    if (!user) throw unauthorized("Phiên đăng nhập đã hết. Đăng nhập lại nhé.", "UNAUTHENTICATED");
    if (user.isLocked) throw unauthorized(LOCKED_MESSAGE, "ACCOUNT_LOCKED");
    req.user = { id: user.id, role: user.role, email: user.email, fullName: user.fullName, timezone: user.timezone };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthUser }>().user;
    if (!user || !roles.includes(user.role)) throw forbidden("Bạn không có quyền truy cập trang quản trị.", "FORBIDDEN");
    return true;
  }
}
