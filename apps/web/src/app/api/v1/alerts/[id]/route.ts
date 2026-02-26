import { NextRequest, NextResponse } from "next/server";
import { getDemoEmailFromToken, demoState } from "@/app/api/v1/_mock-data";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const email = getDemoEmailFromToken(token);
  if (!email) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const aid = parseInt(id);
  const existing = demoState.alerts.get(email) ?? [];
  demoState.alerts.set(email, existing.filter((a) => a.id !== aid));

  return new NextResponse(null, { status: 204 });
}
