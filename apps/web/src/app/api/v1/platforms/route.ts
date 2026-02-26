import { NextResponse } from "next/server";
import { PLATFORMS } from "../_mock-data";

export async function GET() {
  return NextResponse.json(PLATFORMS);
}
