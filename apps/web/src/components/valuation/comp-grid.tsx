import Image from "next/image";
import type { CompSale, PriceRange } from "@/types";
import { formatPrice, formatDate } from "@/lib/format";
import { ExternalLink } from "lucide-react";

interface CompGridProps {
  comps: CompSale[];
  priceRange?: PriceRange;
}

export function CompGrid({ comps, priceRange }: CompGridProps) {
  if (comps.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">
        Comparable Sales ({comps.length})
      </h3>

      {/* Price range bar */}
      {priceRange && priceRange.low && priceRange.high && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium mb-2">PRICE RANGE</p>
          <div className="flex justify-between items-end">
            <div className="text-center">
              <p className="text-xs text-gray-500">Low</p>
              <p className="font-bold text-gray-800">{formatPrice(priceRange.low)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Median</p>
              <p className="font-bold text-xl text-blue-600">{formatPrice(priceRange.mid)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">High</p>
              <p className="font-bold text-gray-800">{formatPrice(priceRange.high)}</p>
            </div>
          </div>
          <div className="mt-2 h-2 bg-gradient-to-r from-blue-200 via-blue-500 to-blue-200 rounded-full" />
          <p className="text-xs text-gray-500 mt-1 text-center">
            Based on {priceRange.count} completed sales
          </p>
        </div>
      )}

      {/* Comp cards */}
      <div className="space-y-2">
        {comps.map((comp) => (
          <a
            key={comp.listing_id}
            href={comp.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm transition-all group"
          >
            {/* Thumbnail */}
            <div className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
              {comp.primary_image_url ? (
                <Image
                  src={comp.primary_image_url}
                  alt={comp.title}
                  width={64}
                  height={64}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">
                  🏺
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 line-clamp-1 group-hover:text-blue-600">
                {comp.title}
              </p>
              <p className="text-lg font-bold text-green-600">
                {formatPrice(comp.final_price)}
              </p>
              <p className="text-xs text-gray-500">
                {comp.platform_display_name}
                {comp.sale_date && ` · ${formatDate(comp.sale_date)}`}
              </p>
            </div>

            <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-blue-400 flex-shrink-0 mt-1" />
          </a>
        ))}
      </div>
    </div>
  );
}
