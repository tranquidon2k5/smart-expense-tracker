import { NextResponse, type NextRequest } from "next/server";

/**
 * Lớp trải nghiệm (chế độ api): chưa có phiên mà vào app → sang /dang-nhap; không phải admin mà
 * vào /quan-tri → về trang chủ. Cookie `st_role` không phải bằng chứng quyền — mọi API vẫn kiểm
 * JWT và vai trò ở server. Bản mock giữ phiên ở localStorage nên proxy bỏ qua.
 */
const USE_API = process.env.NEXT_PUBLIC_DATA_SOURCE === "api";
const AUTH_PAGES = ["/dang-nhap", "/dang-ky", "/quen-mat-khau"];

export function proxy(request: NextRequest) {
  if (!USE_API) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const role = request.cookies.get("st_role")?.value;
  if (!role) {
    const url = new URL("/dang-nhap", request.url);
    if (pathname !== "/") url.searchParams.set("tiep", pathname + search);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/quan-tri") && role !== "admin") return NextResponse.redirect(new URL("/", request.url));
  return NextResponse.next();
}

export const config = {
  // Bỏ qua API, file tĩnh, ảnh và file mẫu
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|mau/|.*\\.[a-zA-Z0-9]+$).*)"],
};
