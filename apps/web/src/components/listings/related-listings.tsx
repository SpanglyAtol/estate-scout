import Link from "next/link";
import { searchListings } from "@/lib/api-client";
import { formatPrice, getAuctionStatus } from "@/lib/format";
import type { Listing } from "@/types";

interface RelatedListingsProps {
  listing: Listing;
}

export async function RelatedListings({ listing }: RelatedListingsProps) {
  let results: Listing[] = [];

  try {
    const data = await searchListings({
      category: listing.category ?? undefined,
      page: 1,
      page_size: 5,
    });
    // Exclude the current listing, take up to 4
    results = (data.results ?? []).filter((l) => l.id !== listing.id).slice(0, 4);
  } catch {
    return null;
  }

  if (results.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-antique-text font-display mb-4">
        Similar Items
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {results.map((item) => {
          const status = getAuctionStatus(item);
          const price = item.current_price ?? item.buy_now_price ?? item.estimate_low;
          return (
            <Link
              key={item.id}
              href={`/listing/${item.id}`}
              className="group border border-antique-border rounded-xl overflow-hidden bg-antique-surface hover:border-antique-accent transition-colors"
            >
              {item.primary_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.primary_image_url}
                  alt={item.title}
                  className="w-full aspect-square object-cover group-hover:opacity-90 transition-opacity"
                />
              ) : (
                <div className="w-full aspect-square bg-antique-muted flex items-center justify-center text-antique-text-mute text-xs">
                  No image
                </div>
              )}
              <div className="p-3 space-y-1">
                <p className="text-xs text-antique-text line-clamp-2 font-medium leading-snug">
                  {item.title}
                </p>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-antique-accent">
                    {price != null ? formatPrice(price) : "—"}
                  </span>
                  {status === "ending_soon" && (
                    <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                      Ending soon
                    </span>
                  )}
                  {status === "live" && (
                    <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                      Live
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
