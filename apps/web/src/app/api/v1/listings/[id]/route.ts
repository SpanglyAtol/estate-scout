import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const listing = getListings().find((l) => l.id === parseInt(id));
  if (!listing) {
    return NextResponse.json({ detail: "Listing not found" }, { status: 404 });
  }
  return NextResponse.json(listing);
}
