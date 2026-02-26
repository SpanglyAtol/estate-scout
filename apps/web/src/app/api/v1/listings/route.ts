import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/scraped-data";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("page_size") ?? "24");

  const listings = getListings();
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const slice = listings.slice(start, end);

  return NextResponse.json(slice);
}
