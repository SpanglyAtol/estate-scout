import { NextRequest, NextResponse } from "next/server";
import { getDemoEmailFromToken, demoState } from "@/app/api/v1/_mock-data";

function requireAuth(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  const email = getDemoEmailFromToken(token);
  if (!email) return null;
  return email;
}

export async function GET(req: NextRequest) {
  const email = requireAuth(req);
  if (!email) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const searches = demoState.savedSearches.get(email) ?? [];
  return NextResponse.json(searches);
}

export async function POST(req: NextRequest) {
  const email = requireAuth(req);
  if (!email) return NextResponse.json({ detail: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { name, query_text, filters, notify_email } = body;

  if (!name?.trim()) {
    return NextResponse.json({ detail: "Name is required." }, { status: 400 });
  }

  const newSearch = {
    id: demoState.nextId(),
    name,
    query_text: query_text ?? null,
    filters: filters ?? {},
    notify_email: notify_email ?? false,
    created_at: new Date().toISOString(),
  };

  const existing = demoState.savedSearches.get(email) ?? [];
  demoState.savedSearches.set(email, [...existing, newSearch]);

  return NextResponse.json(newSearch, { status: 201 });
}
