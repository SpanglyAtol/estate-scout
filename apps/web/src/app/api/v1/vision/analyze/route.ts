import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = "claude-opus-4-6";

interface AnalyzeBody {
  /** Public image URL to analyze */
  imageUrl: string;
  /** Optional extra context (item title, category) */
  context?: string;
}

export async function POST(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 503 }
    );
  }

  let body: AnalyzeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { imageUrl, context } = body;
  if (!imageUrl || typeof imageUrl !== "string") {
    return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
  }

  // Validate it's actually a URL (basic guard against injection)
  try {
    const parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return NextResponse.json({ error: "imageUrl must be an http/https URL" }, { status: 400 });
  }

  const systemPrompt = `You are an expert antique appraiser and estate sale specialist with 30+ years of experience.
Analyze items from photos to identify them, estimate value, and help collectors find comparable items.
Always respond in valid JSON matching the schema below — no markdown, no prose outside the JSON.`;

  const userPrompt = `Analyze this antique/collectible item from the photo.${context ? `\n\nAdditional context: ${context}` : ""}

Respond with ONLY this JSON (no markdown):
{
  "identification": "what the item is, e.g. 'Meissen porcelain figurine, mid-18th century'",
  "category": "one of: Ceramics & Porcelain | Silver & Metalware | Furniture | Art & Paintings | Jewelry & Watches | Books & Manuscripts | Rugs & Textiles | Glass & Crystal | Clocks & Instruments | Coins & Stamps | Toys & Collectibles | Other",
  "estimated_period": "e.g. 'circa 1880–1920' or 'Victorian era'",
  "estimated_value_usd": { "low": 0, "mid": 0, "high": 0 },
  "condition_notes": "brief condition observations from the photo",
  "key_features": ["list", "of", "notable", "features"],
  "ebay_search_terms": "optimized search query for eBay sold listings",
  "google_lens_tip": "short tip on what to look for in a Google Lens search for this item",
  "confidence": "high | medium | low"
}`;

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const err = await anthropicRes.text();
    console.error("Anthropic API error:", err);
    return NextResponse.json(
      { error: "Vision analysis failed", detail: anthropicRes.status },
      { status: 502 }
    );
  }

  const anthropicData = await anthropicRes.json();
  const raw = anthropicData?.content?.[0]?.text ?? "";

  let parsed: unknown;
  try {
    // Strip accidental markdown fences if Claude wraps in ```json ... ```
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json({ error: "Could not parse model response", raw }, { status: 500 });
  }

  return NextResponse.json({ result: parsed });
}
