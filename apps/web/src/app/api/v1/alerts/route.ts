import { NextRequest, NextResponse } from "next/server";
import { getDemoEmailFromToken, demoState } from "@/app/api/v1/_mock-data";

function requireAuth(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  return getDemoEmailFromToken(token);
}

export async function GET(req: NextRequest) {
  const email = requireAuth(req);
  if (!email) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  return NextResponse.json(demoState.alerts.get(email) ?? []);
}

export async function POST(req: NextRequest) {
  const email = requireAuth(req);
  if (!email) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, query_text, max_price, notify_email } = body;

  if (!name?.trim()) {
    return NextResponse.json({ detail: "Name is required." }, { status: 400 });
  }

  const newAlert = {
    id: demoState.nextId(),
    name,
    query_text: query_text ?? null,
    max_price: max_price ?? null,
    is_active: true,
    notify_email: notify_email ?? true,
    trigger_count: 0,
    created_at: new Date().toISOString(),
  };

  const existing = demoState.alerts.get(email) ?? [];
  demoState.alerts.set(email, [...existing, newAlert]);

  return NextResponse.json(newAlert, { status: 201 });
}
