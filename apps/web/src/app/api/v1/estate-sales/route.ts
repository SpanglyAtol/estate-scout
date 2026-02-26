import { NextRequest, NextResponse } from "next/server";
import { getEstateSales } from "@/app/api/v1/_mock-data";

export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get("city") ?? undefined;
  const sales = getEstateSales(city);
  return NextResponse.json(sales);
}
