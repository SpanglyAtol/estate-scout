"use client";

import { useState } from "react";
import { Package, Loader2, AlertCircle, ArrowUpDown, Clock, DollarSign } from "lucide-react";
import type { ShippingRate } from "@/app/api/v1/shipping/rates/route";

const CARRIER_ICONS: Record<string, string> = {
  USPS: "📬",
  UPS: "📦",
  FedEx: "✈️",
};

type SortKey = "price" | "speed";

function estimatedDaysToNumber(days: string): number {
  const match = days.match(/(\d+)/);
  return match ? parseInt(match[1]) : 99;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: string;
  max?: string;
  step?: string;
  unit?: string;
  half?: boolean;
}

function Field({ label, value, onChange, placeholder, type = "number", min = "0", max, step = "1", unit, half }: FieldProps) {
  return (
    <div className={half ? "col-span-1" : ""}>
      <label className="block text-xs font-medium text-antique-text-sec mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          className="w-full px-3 py-2 rounded-lg border border-antique-border bg-antique-bg text-antique-text text-sm focus:outline-none focus:ring-2 focus:ring-antique-accent focus:border-transparent pr-10"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-antique-text-mute pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function ShippingCalculator() {
  const [fromZip, setFromZip] = useState("");
  const [toZip, setToZip] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [lengthIn, setLengthIn] = useState("");
  const [widthIn, setWidthIn] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<ShippingRate[] | null>(null);
  const [source, setSource] = useState<"shippo" | "estimate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("price");

  const handleCalculate = async () => {
    if (!fromZip || !toZip) {
      setError("Please enter both ZIP codes.");
      return;
    }
    const lbs = parseFloat(weightLbs) || 0;
    const oz = parseFloat(weightOz) || 0;
    if (lbs + oz / 16 <= 0) {
      setError("Please enter a weight greater than 0.");
      return;
    }

    setLoading(true);
    setError(null);
    setRates(null);

    try {
      const res = await fetch("/api/v1/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromZip,
          toZip,
          weightLbs: lbs,
          weightOz: oz,
          lengthIn: parseFloat(lengthIn) || 0,
          widthIn: parseFloat(widthIn) || 0,
          heightIn: parseFloat(heightIn) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Failed to calculate rates");
      } else {
        setRates(data.rates as ShippingRate[]);
        setSource(data.source);
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  };

  const sortedRates = rates
    ? [...rates].sort((a, b) =>
        sortKey === "price"
          ? a.price - b.price
          : estimatedDaysToNumber(a.estimatedDays) - estimatedDaysToNumber(b.estimatedDays)
      )
    : null;

  return (
    <div className="space-y-5">
      {/* ZIP codes */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="From ZIP" value={fromZip} onChange={setFromZip} placeholder="e.g. 90210" type="text" />
        <Field label="To ZIP" value={toZip} onChange={setToZip} placeholder="e.g. 10001" type="text" />
      </div>

      {/* Weight */}
      <div>
        <p className="text-xs font-medium text-antique-text-sec mb-2">Package weight</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pounds" value={weightLbs} onChange={setWeightLbs} placeholder="0" unit="lbs" half />
          <Field label="Ounces" value={weightOz} onChange={setWeightOz} placeholder="0" max="15" unit="oz" half />
        </div>
      </div>

      {/* Dimensions */}
      <div>
        <p className="text-xs font-medium text-antique-text-sec mb-2">
          Package dimensions{" "}
          <span className="font-normal text-antique-text-mute">(optional — improves accuracy)</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Length" value={lengthIn} onChange={setLengthIn} placeholder="0" unit="in" half />
          <Field label="Width" value={widthIn} onChange={setWidthIn} placeholder="0" unit="in" half />
          <Field label="Height" value={heightIn} onChange={setHeightIn} placeholder="0" unit="in" half />
        </div>
      </div>

      {/* Calculate button */}
      <button
        onClick={handleCalculate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-antique-accent text-white px-5 py-3 rounded-xl font-semibold text-sm hover:bg-antique-accent-h transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Calculating…
          </>
        ) : (
          <>
            <Package className="w-4 h-4" />
            Calculate Rates
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Results */}
      {sortedRates && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-antique-text">
              Shipping rates{" "}
              {source === "estimate" && (
                <span className="text-xs font-normal text-antique-text-mute">
                  (estimated — actual rates may vary)
                </span>
              )}
            </p>
            <div className="flex items-center gap-1 text-xs text-antique-text-sec">
              <ArrowUpDown className="w-3 h-3" />
              <span>Sort by:</span>
              <button
                onClick={() => setSortKey("price")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sortKey === "price"
                    ? "bg-antique-accent text-white"
                    : "hover:text-antique-text"
                }`}
              >
                <DollarSign className="w-3 h-3 inline" /> Price
              </button>
              <button
                onClick={() => setSortKey("speed")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  sortKey === "speed"
                    ? "bg-antique-accent text-white"
                    : "hover:text-antique-text"
                }`}
              >
                <Clock className="w-3 h-3 inline" /> Speed
              </button>
            </div>
          </div>

          <div className="divide-y divide-antique-border border border-antique-border rounded-xl overflow-hidden">
            {sortedRates.map((rate, i) => (
              <div
                key={`${rate.carrier}-${rate.service}`}
                className={`flex items-center justify-between px-4 py-3 ${
                  i === 0 ? "bg-antique-accent-s" : "bg-antique-bg"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg w-6 text-center">
                    {CARRIER_ICONS[rate.carrier] ?? "📮"}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${i === 0 ? "text-antique-accent" : "text-antique-text"}`}>
                      {rate.carrier} {rate.service}
                      {i === 0 && (
                        <span className="ml-2 text-xs bg-antique-accent text-white px-1.5 py-0.5 rounded-full">
                          Best value
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-antique-text-sec">{rate.estimatedDays}</p>
                  </div>
                </div>
                <p className={`text-sm font-bold ${i === 0 ? "text-antique-accent" : "text-antique-text"}`}>
                  ${rate.price.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
