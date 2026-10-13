import { AsyncLocalStorage } from "node:async_hooks";
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NestMiddleware,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { map, type Observable } from "rxjs";

/** Chúc mừng thành tích — cùng dạng `Celebration` ở frontend (src/services/events.ts) */
export interface Celebration {
  kind: "streak" | "badge" | "level" | "mission";
  title: string;
  description: string;
  icon: string;
  xp?: number;
}

interface RequestStore {
  celebrations: Celebration[];
}

const storage = new AsyncLocalStorage<RequestStore>();

/** Header trả kèm response: JSON các sự kiện chúc mừng, mã hoá base64 (UTF-8) */
export const CELEBRATIONS_HEADER = "X-Celebrations";

/** Ghi nhận chúc mừng để trả kèm response hiện tại (ngoài request — vd. job — thì bỏ qua) */
export function pushCelebration(c: Celebration): void {
  storage.getStore()?.celebrations.push(c);
}

export function runWithRequestStore<T>(fn: () => T): T {
  return storage.run({ celebrations: [] }, fn);
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction) {
    storage.run({ celebrations: [] }, next);
  }
}

/** Đặt header chúc mừng trước khi Nest gửi body → frontend hiện hiệu ứng mà không đổi dạng response */
@Injectable()
export class CelebrationsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        const list = storage.getStore()?.celebrations ?? [];
        if (list.length && !res.headersSent) {
          res.setHeader(CELEBRATIONS_HEADER, Buffer.from(JSON.stringify(list), "utf8").toString("base64"));
        }
        return data;
      }),
    );
  }
}
