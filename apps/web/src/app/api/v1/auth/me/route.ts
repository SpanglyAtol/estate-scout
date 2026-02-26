import { NextRequest, NextResponse } from "next/server";
import { getDemoEmailFromToken, getOrCreateUser } from "@/app/api/v1/_mock-data";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const email = getDemoEmailFromToken(token);

  if (!email) {
    return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });
  }

  const user = getOrCreateUser(email);

  return NextResponse.json({
    id: "demo-" + Buffer.from(email).toString("base64url").slice(0, 8),
    email: user.email,
    display_name: user.display_name,
    tier: user.tier,
    valuation_queries_this_month: 3,
    created_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  });
}
