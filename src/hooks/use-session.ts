"use client";

import * as React from "react";
import type { AuthSession } from "@/types";
import { authService } from "@/services";

const getServerSnapshot = () => undefined;

/**
 * Phiên đăng nhập hiện tại.
 * - `undefined`: chưa biết (đang prerender / chưa hydrate) → hiện màn chờ, KHÔNG chuyển hướng
 * - `null`: chưa đăng nhập
 */
export function useSession(): AuthSession | null | undefined {
  return React.useSyncExternalStore(authService.onSessionChanged, authService.getSession, getServerSnapshot);
}
