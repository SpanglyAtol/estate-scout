import { NextRequest, NextResponse } from "next/server";
import { makeDemoToken, getOrCreateUser } from "@/app/api/v1/_mock-data";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, display_name } = body;

  if (!email || !password) {
    return NextResponse.json({ detail: "Email and password are required." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ detail: "Password must be at least 8 characters." }, { status: 400 });
  }

  getOrCreateUser(email, display_name ?? null);

  return NextResponse.json(
    { access_token: makeDemoToken(email), token_type: "bearer" },
    { status: 201 }
  );
}
