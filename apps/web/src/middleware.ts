/**
 * Middleware — protect /admin routes behind an admin login.
 *
 * If ADMIN_PASSWORD is not set in env, all /admin routes return 403.
 * If the `es_admin_session` cookie matches the expected token, access is granted.
 * Otherwise the user is redirected to /admin/login.
 */
import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "es_admin_session";
const LOGIN_PATH = "/admin/login";

async function computeToken(password: string): Promise<string> {
  const salt = process.env.ADMIN_PASSWORD_SALT ?? "estate-scout-admin-v1";
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow the login page and its API route through unconditionally
  if (pathname === LOGIN_PATH || pathname.startsWith("/api/admin/")) {
    return NextResponse.next();
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return new NextResponse(
      "Admin dashboard is disabled. Set ADMIN_PASSWORD in environment variables.",
      { status: 403, headers: { "content-type": "text/plain" } }
    );
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }

  const expected = await computeToken(adminPassword);
  if (cookie.value !== expected) {
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
