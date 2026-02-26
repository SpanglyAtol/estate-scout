import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", environment: "demo", mode: "mock-api" });
}
