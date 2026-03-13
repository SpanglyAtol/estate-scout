import { NextRequest, NextResponse } from "next/server";

type Platform = "ebay" | "etsy" | "facebook" | "hibid";

interface GenerateListingRequest {
  item: {
    title: string;
    description?: string;
    category?: string;
    condition?: string;
    notes?: string;
    aiAnalysis?: {
      priceLow: number | null;
      priceMid: number | null;
      priceHigh: number | null;
    };
  };
  platform: Platform;
}

export interface GeneratedListing {
  title: string;
  description: string;
  price: number;
  tags: string[];
  conditionLabel: string;
}

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  ebay: `
- Title: max 80 characters, keyword-dense, include brand/maker/period/material if known
- Description: factual, detailed condition notes, measurements if available, 200-350 words
- Condition label: use eBay standard terms (Used, For parts or not working, Very Good, Good, Acceptable)
- Tags: 5-8 relevant search keywords
- Price: competitive market value suitable for Buy It Now`,
  etsy: `
- Title: max 140 characters, artisan/collector tone, include "vintage" or "antique" where accurate, use comma-separated keywords
- Description: story-driven, evoke provenance and beauty, mention era/style/material, 350-500 words
- Condition label: descriptive (e.g. "Excellent vintage condition with minor patina")
- Tags: up to 13 tags using Etsy SEO best practices (long-tail keywords welcome)
- Price: slight premium for handpicked/curated feel`,
  facebook: `
- Title: max 100 characters, casual and direct (e.g. "Antique Oak Dresser — Great Condition")
- Description: brief and friendly, 2-3 short paragraphs, mention local pickup, 100-200 words
- Condition label: casual (e.g. "Good used condition")
- Tags: 3-5 relevant terms
- Price: fair local-market value, round numbers preferred`,
  hibid: `
- Title: max 100 characters, auction catalog style — object type first, then key attributes
- Description: formal auction house tone, provenance emphasis, condition report language, 200-350 words
- Condition label: professional auction condition report style (e.g. "Generally Very Good; light surface wear consistent with age")
- Tags: 5 category and style keywords
- Price: conservative opening bid suggestion (typically 40-60% of retail)`,
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as GenerateListingRequest;
  const { item, platform } = body;

  if (!item?.title || !platform) {
    return NextResponse.json({ error: "item.title and platform are required" }, { status: 400 });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to enable AI listing generation." },
      { status: 503 }
    );
  }

  const priceHint =
    item.aiAnalysis?.priceMid
      ? `Previously estimated value: $${item.aiAnalysis.priceMid}`
      : item.aiAnalysis?.priceLow && item.aiAnalysis?.priceHigh
      ? `Previously estimated range: $${item.aiAnalysis.priceLow}–$${item.aiAnalysis.priceHigh}`
      : null;

  const itemDetails = [
    `Title: ${item.title}`,
    item.description ? `Description: ${item.description.slice(0, 400)}` : null,
    item.category ? `Category: ${item.category}` : null,
    item.condition ? `Condition: ${item.condition}` : null,
    item.notes ? `Additional notes: ${item.notes.slice(0, 200)}` : null,
    priceHint,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are an expert at writing compelling antique and collectibles selling listings. Generate platform-specific listing content optimized for the target marketplace. Always respond with valid JSON only — no markdown, no extra text.`;

  const userPrompt = `Generate a ${platform.toUpperCase()} listing for this antique/collectible item:

${itemDetails}

Platform guidelines for ${platform.toUpperCase()}:${PLATFORM_GUIDANCE[platform]}

Respond with this exact JSON schema:
{
  "title": "string",
  "description": "string",
  "price": number,
  "tags": ["string"],
  "conditionLabel": "string"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const aiData = await response.json();
  const textBlock = aiData.content?.find((b: { type: string }) => b.type === "text");
  if (!textBlock) {
    return NextResponse.json({ error: "No response from AI" }, { status: 503 });
  }

  let parsed: GeneratedListing;
  try {
    let raw = (textBlock.text as string).trim();
    if (raw.startsWith("```")) {
      raw = raw.split("```")[1].replace(/^json/, "").trim();
    }
    parsed = JSON.parse(raw) as GeneratedListing;
  } catch {
    return NextResponse.json({ error: "Could not parse AI response" }, { status: 503 });
  }

  return NextResponse.json(parsed);
}
