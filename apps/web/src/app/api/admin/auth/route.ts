import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "es_admin_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function computeToken(password: string): Promise<string> {
  const salt = process.env.ADMIN_PASSWORD_SALT ?? "estate-scout-admin-v1";
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// GET /api/admin/auth — check if current session cookie is valid
export async function GET(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return NextResponse.json({ isAdmin: false });
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return NextResponse.json({ isAdmin: false });
  const expected = await computeToken(adminPassword);
  return NextResponse.json({ isAdmin: cookie.value === expected });
}

// POST /api/admin/auth — verify password and set session cookie
export async function POST(req: NextRequest) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ error: "Admin access is disabled." }, { status: 403 });
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.password || body.password !== adminPassword) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await computeToken(adminPassword);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: MAX_AGE,
    path: "/",
  });
  return response;
}

// DELETE /api/admin/auth — clear session cookie (logout)
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
