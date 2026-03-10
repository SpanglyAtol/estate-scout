import { NextRequest, NextResponse } from "next/server";

// When BACKEND_API_URL is set, proxy to FastAPI which calls Claude.
// When not set (e.g. Vercel preview with no backend), use the lightweight
// client-side fallback that calls the Anthropic API directly from the edge.
export async function POST(req: NextRequest) {
  const body = await req.json();

  // ── Path 1: FastAPI backend (full market data + Claude) ──────────────────
  const backendUrl = process.env.BACKEND_API_URL;
  if (backendUrl) {
    try {
      const upstream = await fetch(`${backendUrl}/api/v1/price-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000), // 30s — Claude adaptive thinking can take a moment
      });
      if (upstream.ok) return NextResponse.json(await upstream.json());
    } catch {
      // Backend unavailable — fall through to edge path
    }
  }

  // ── Path 2: Direct Anthropic API call from the Next.js edge ──────────────
  // Used when no backend is configured. No market DB data available, but
  // Claude can still give a general expert estimate.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      {
        estimated_low: null,
        estimated_high: null,
        estimated_median: null,
        confidence: "insufficient_data",
        data_points_used: 0,
        reasoning:
          "Price checking requires either a backend database or an ANTHROPIC_API_KEY environment variable. " +
          "Please configure one to enable this feature.",
        key_value_factors: [],
        market_trend_summary: null,
        comparable_sales: [],
        market_context: null,
        fingerprint_match: null,
        data_source: "template_fallback",
        cached: false,
      },
      { status: 200 }
    );
  }

  // Build a structured prompt from the request body
  const item = body as {
    title: string;
    description?: string;
    category?: string;
    maker?: string;
    period?: string;
    condition?: string;
    asking_price?: number;
  };

  const itemLines = [
    `Title: ${item.title}`,
    item.description ? `Description: ${item.description.slice(0, 300)}` : null,
    item.category ? `Category: ${item.category}` : null,
    item.maker ? `Maker/Artist: ${item.maker}` : null,
    item.period ? `Period: ${item.period}` : null,
    item.condition ? `Condition: ${item.condition}` : null,
    item.asking_price ? `Asking Price: $${item.asking_price.toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system: `You are an expert antique appraiser. Given an item description, provide a price estimate as JSON with this exact schema:
{"estimated_low":number|null,"estimated_high":number|null,"estimated_median":number|null,"confidence":"high"|"medium"|"low"|"insufficient_data","reasoning":"string","key_value_factors":["string"],"market_trend_summary":"string"|null,"asking_price_verdict":"fair"|"below_market"|"above_market"|"unknown"|null,"asking_price_delta_pct":number|null}`,
      messages: [
        {
          role: "user",
          content: `Estimate the market value for this item:\n\n${itemLines}\n\nRespond with JSON only.`,
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const aiData = await response.json();
  const textBlock = aiData.content?.find((b: { type: string }) => b.type === "text");
  if (!textBlock) {
    return NextResponse.json({ error: "No response from AI" }, { status: 503 });
  }

  let parsed: Record<string, unknown>;
  try {
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.split("```")[1].replace(/^json/, "").trim();
    }
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 503 });
  }

  return NextResponse.json({
    ...parsed,
    asking_price: item.asking_price ?? null,
    data_points_used: 0,
    comparable_sales: [],
    market_context: null,
    fingerprint_match: null,
    data_source: "claude_no_data",
    cached: false,
  });
}
