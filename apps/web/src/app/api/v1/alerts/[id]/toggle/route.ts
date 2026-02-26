import { NextRequest, NextResponse } from "next/server";
import { getDemoEmailFromToken, demoState } from "@/app/api/v1/_mock-data";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const email = getDemoEmailFromToken(token);
  if (!email) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const aid = parseInt(id);
  const existing = demoState.alerts.get(email) ?? [];
  const alert = existing.find((a) => a.id === aid);

  if (!alert) return NextResponse.json({ detail: "Not found" }, { status: 404 });

  alert.is_active = !alert.is_active;
  demoState.alerts.set(email, existing);

  return NextResponse.json({ id: alert.id, is_active: alert.is_active });
}
