import { NextRequest, NextResponse } from "next/server";
import { makeDemoToken, getOrCreateUser } from "@/app/api/v1/_mock-data";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ detail: "Email and password are required." }, { status: 400 });
  }

  // Demo: any password works for any email (this is the mock API)
  getOrCreateUser(email);

  return NextResponse.json({
    access_token: makeDemoToken(email),
    token_type: "bearer",
  });
}
