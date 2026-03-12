/**
 * Ad Revenue Click & Impression Tracker
 * --------------------------------------
 * Records outbound link clicks, sponsored listing impressions, and affiliate
 * clicks. Events are logged to stdout (captured by Vercel log drains) and
 * forwarded to GA4 Measurement Protocol when GA4_MEASUREMENT_ID + GA4_API_SECRET
 * are configured.
 *
 * POST /api/v1/track
 * Body: { type, listing_id?, sponsor_id?, platform?, category?, url?, position? }
 *
 * GET  /api/v1/track?type=...&id=...  (lightweight beacon-compatible endpoint)
 */

import { NextRequest, NextResponse } from "next/server";

export interface TrackPayload {
  type:
    | "click_out"        // user clicked through to an auction platform
    | "sponsored_click"  // user clicked a sponsored listing card
    | "sponsored_impression" // sponsored card entered viewport
    | "affiliate_click"  // user clicked Amazon Associates link
    | "listing_view";    // listing detail page viewed
  listing_id?: number | string;
  sponsor_id?: string;
  platform?: string;
  category?: string;
  url?: string;
  position?: number;
  [key: string]: unknown;
}

async function sendToGA4(payload: TrackPayload) {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  const ga4Event = {
    client_id: "server", // server-side events use a fixed client_id
    non_personalized_ads: false,
    events: [
      {
        name: payload.type,
        params: {
          listing_id:  String(payload.listing_id ?? ""),
          sponsor_id:  payload.sponsor_id ?? "",
          platform:    payload.platform ?? "",
          category:    payload.category ?? "",
          engagement_time_msec: "100",
        },
      },
    ],
  };

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  try {
    await fetch(url, {
      method: "POST",
      body: JSON.stringify(ga4Event),
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical — don't break the response if GA4 is down
  }
}

function logEvent(payload: TrackPayload, req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  console.log(
    JSON.stringify({
      event: "ad_track",
      timestamp: new Date().toISOString(),
      ip,
      ua: ua.slice(0, 100),
      ...payload,
    })
  );
}

export async function POST(req: NextRequest) {
  let payload: TrackPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.type) {
    return NextResponse.json({ error: "Missing type" }, { status: 400 });
  }

  logEvent(payload, req);
  // Fire GA4 in background — don't await so we respond immediately
  sendToGA4(payload).catch(() => {});

  return NextResponse.json({ ok: true }, { status: 200 });
}

// GET endpoint for beacon-style requests (img src / sendBeacon fallback)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as TrackPayload["type"] | null;
  if (!type) return NextResponse.json({ error: "Missing type" }, { status: 400 });

  const payload: TrackPayload = {
    type,
    sponsor_id:  searchParams.get("id") ?? undefined,
    listing_id:  searchParams.get("lid") ? Number(searchParams.get("lid")) : undefined,
    platform:    searchParams.get("plt") ?? undefined,
    category:    searchParams.get("cat") ?? undefined,
    position:    searchParams.get("pos") ? Number(searchParams.get("pos")) : undefined,
  };

  logEvent(payload, req);
  sendToGA4(payload).catch(() => {});

  // Return 1×1 transparent GIF for img-beacon compatibility
  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  return new NextResponse(gif, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
    },
  });
}
