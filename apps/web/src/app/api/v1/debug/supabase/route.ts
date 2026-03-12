import { NextResponse } from "next/server";

/**
 * GET /api/v1/debug/supabase
 *
 * Diagnostic endpoint — checks Supabase connectivity and returns:
 * - Whether env vars are set
 * - Raw row count from listings table (no filters)
 * - Row count with is_active=true filter
 * - Row count with archived_at=null filter
 * - Sample of first 3 raw rows
 * - Any errors encountered
 *
 * Remove or restrict this endpoint before going to production if
 * you don't want to expose internal DB state.
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_KEY;

async function sbGet(path: string, params: Record<string, string>) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { error: "env vars not set" };
  const q = new URLSearchParams(params);
  const url = `${SUPABASE_URL}/rest/v1/${path}?${q}`;
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "count=exact",
      },
      cache: "no-store",
    });
    const contentRange = res.headers.get("content-range");
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, ok: res.ok, contentRange, body };
  } catch (err) {
    return { error: String(err) };
  }
}

export async function GET() {
  const report: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 30)}…` : "NOT SET",
      SUPABASE_KEY: SUPABASE_KEY ? `${SUPABASE_KEY.slice(0, 12)}…` : "NOT SET",
    },
  };

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    report.diagnosis = "SUPABASE_URL and/or SUPABASE_KEY env vars are missing. Set them in Vercel → Project → Settings → Environment Variables.";
    return NextResponse.json(report, { status: 200 });
  }

  // 1. Total row count (no filters)
  report.totalRows = await sbGet("listings", {
    select: "id",
    limit: "1",
  });

  // 2. Rows with is_active = true
  report.activeRows = await sbGet("listings", {
    select: "id",
    is_active: "eq.true",
    limit: "1",
  });

  // 3. Rows with archived_at IS NULL
  report.notArchivedRows = await sbGet("listings", {
    select: "id",
    archived_at: "is.null",
    limit: "1",
  });

  // 4. Sample rows (no filters)
  report.sampleRows = await sbGet("listings", {
    select: "id,title,listing_type,is_active,archived_at,platform_id,scraped_at",
    limit: "5",
    order: "id.desc",
  });

  // 5. platforms table check
  report.platforms = await sbGet("platforms", {
    select: "id,name,display_name",
    limit: "20",
  });

  // Diagnosis
  const total = (report.totalRows as { contentRange?: string })?.contentRange;
  const active = (report.activeRows as { contentRange?: string })?.contentRange;

  if (total?.includes("/0") || !total) {
    report.diagnosis = "The listings table appears to be EMPTY. Run the scraper GitHub Action (DATABASE_URL secret must be set in the repo) to populate it.";
  } else if (active?.includes("/0")) {
    report.diagnosis = "Listings exist but none have is_active=true. The scraper may not be setting this flag. The connector will be updated to omit this filter.";
  } else {
    report.diagnosis = "Supabase connection OK. Listings found. If search still shows mock data, check the Next.js API search route logs.";
  }

  return NextResponse.json(report, { status: 200 });
}
