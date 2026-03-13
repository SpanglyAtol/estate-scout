import { NextRequest, NextResponse } from "next/server";

export interface ShippingRateRequest {
  fromZip: string;
  toZip: string;
  weightLbs: number;
  weightOz: number;
  lengthIn: number;
  widthIn: number;
  heightIn: number;
}

export interface ShippingRate {
  carrier: string;
  service: string;
  price: number;
  estimatedDays: string;
  trackingIncluded: boolean;
}

function calcDimWeight(l: number, w: number, h: number): number {
  return (l * w * h) / 139;
}

function calcWeight(weightLbs: number, weightOz: number, dimWeight: number): number {
  const actualLbs = weightLbs + weightOz / 16;
  return Math.max(actualLbs, dimWeight);
}

function mockRates(
  weightLbs: number,
  weightOz: number,
  lengthIn: number,
  widthIn: number,
  heightIn: number
): ShippingRate[] {
  const dimWeight = calcDimWeight(lengthIn, widthIn, heightIn);
  const billableWeight = calcWeight(weightLbs, weightOz, dimWeight);

  // Determine girth for USPS large package surcharge
  const girth = 2 * (widthIn + heightIn);
  const uspsOversized = lengthIn + girth > 108;

  const uspsGroundPrice = uspsOversized
    ? 99.0
    : Math.max(8.5 + billableWeight * 0.95, 8.5);

  const uspsPriorityPrice = uspsOversized
    ? 99.0
    : Math.max(12.0 + billableWeight * 1.2, 12.0);

  const upsGroundPrice = Math.max(10.5 + billableWeight * 1.1, 10.5);
  const ups2DayPrice = Math.max(28.0 + billableWeight * 2.5, 28.0);
  const fedexGroundPrice = Math.max(10.0 + billableWeight * 1.05, 10.0);
  const fedex2DayPrice = Math.max(30.0 + billableWeight * 2.75, 30.0);

  const round = (n: number) => Math.round(n * 100) / 100;

  return [
    {
      carrier: "USPS",
      service: "Ground Advantage",
      price: round(uspsGroundPrice),
      estimatedDays: "2–5 business days",
      trackingIncluded: true,
    },
    {
      carrier: "USPS",
      service: "Priority Mail",
      price: round(uspsPriorityPrice),
      estimatedDays: "1–3 business days",
      trackingIncluded: true,
    },
    {
      carrier: "UPS",
      service: "Ground",
      price: round(upsGroundPrice),
      estimatedDays: "1–5 business days",
      trackingIncluded: true,
    },
    {
      carrier: "UPS",
      service: "2nd Day Air",
      price: round(ups2DayPrice),
      estimatedDays: "2 business days",
      trackingIncluded: true,
    },
    {
      carrier: "FedEx",
      service: "Ground",
      price: round(fedexGroundPrice),
      estimatedDays: "1–5 business days",
      trackingIncluded: true,
    },
    {
      carrier: "FedEx",
      service: "2Day",
      price: round(fedex2DayPrice),
      estimatedDays: "2 business days",
      trackingIncluded: true,
    },
  ].sort((a, b) => a.price - b.price);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ShippingRateRequest;
  const {
    fromZip,
    toZip,
    weightLbs = 0,
    weightOz = 0,
    lengthIn = 0,
    widthIn = 0,
    heightIn = 0,
  } = body;

  if (!fromZip || !toZip) {
    return NextResponse.json({ error: "fromZip and toZip are required" }, { status: 400 });
  }

  const totalWeight = weightLbs + weightOz / 16;
  if (totalWeight <= 0) {
    return NextResponse.json({ error: "Weight must be greater than 0" }, { status: 400 });
  }

  // If SHIPPO_API_KEY is configured, proxy to Shippo for live rates
  const shippoKey = process.env.SHIPPO_API_KEY;
  if (shippoKey) {
    try {
      const shippoRes = await fetch("https://api.goshippo.com/shipments/", {
        method: "POST",
        headers: {
          "Authorization": `ShippoToken ${shippoKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address_from: { zip: fromZip, country: "US" },
          address_to: { zip: toZip, country: "US" },
          parcels: [
            {
              length: String(lengthIn || 12),
              width: String(widthIn || 10),
              height: String(heightIn || 8),
              distance_unit: "in",
              weight: String(totalWeight),
              mass_unit: "lb",
            },
          ],
          async: false,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (shippoRes.ok) {
        const shippoData = await shippoRes.json();
        const rates: ShippingRate[] = (
          shippoData.rates as Array<{
            provider: string;
            servicelevel: { name: string };
            amount: string;
            estimated_days: number | null;
            trackable: boolean;
          }>
        )
          .map((r) => ({
            carrier: r.provider,
            service: r.servicelevel.name,
            price: parseFloat(r.amount),
            estimatedDays: r.estimated_days
              ? `${r.estimated_days} business day${r.estimated_days === 1 ? "" : "s"}`
              : "Varies",
            trackingIncluded: r.trackable ?? true,
          }))
          .sort((a, b) => a.price - b.price);

        return NextResponse.json({ rates, source: "shippo" });
      }
    } catch {
      // Fall through to mock rates
    }
  }

  // Return mock estimated rates
  const rates = mockRates(weightLbs, weightOz, lengthIn, widthIn, heightIn);
  return NextResponse.json({ rates, source: "estimate" });
}
