import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getStats } from "@/lib/api-client";
import { CATEGORIES } from "@/lib/category-meta";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse by Category — Estate Scout",
  description:
    "Explore antiques and estate sale listings by category: jewelry, art, ceramics, silver, furniture, glass, watches, coins and more.",
};

export default async function CategoriesPage() {
  let categoryCounts: Record<string, number> = {};
  try {
    const stats = await getStats();
    categoryCounts = stats?.categories ?? {};
  } catch {
    // Backend offline — counts show as 0
  }

  return (
    <div className="container mx-auto px-4 py-10">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <p className="text-antique-accent font-display text-sm tracking-[0.2em] uppercase mb-2">
          Browse
        </p>
        <h1 className="font-display text-3xl md:text-4xl font-bold text-antique-text mb-3">
          Shop by Category
        </h1>
        <p className="text-antique-text-sec max-w-xl">
          Explore estate sales and auction listings across every collecting category,
          sourced from regional auction houses and estate sale companies nationwide.
        </p>
      </div>

      {/* ── Category grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CATEGORIES.map((cat) => {
          const count = categoryCounts[cat.slug] ?? 0;

          return (
            <Link
              key={cat.slug}
              href={`/categories/${cat.slug}`}
              className={`group relative flex flex-col p-5 rounded-xl border transition-all duration-200 hover:shadow-md hover:scale-[1.01] ${cat.cardBg}`}
            >
              {/* Icon + title row */}
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl leading-none">{cat.icon}</span>
                <ChevronRight
                  className={`w-4 h-4 mt-1 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${cat.accentText}`}
                />
              </div>

              {/* Name */}
              <h2 className={`font-display font-semibold text-lg leading-tight mb-1 ${cat.accentText}`}>
                {cat.label}
              </h2>

              {/* Description */}
              <p className="text-antique-text-sec text-sm leading-snug flex-1">
                {cat.description}
              </p>

              {/* Listing count badge */}
              {count > 0 && (
                <div className="mt-3 pt-3 border-t border-current/10">
                  <span className="text-xs font-medium text-antique-text-mute">
                    {count.toLocaleString()} listing{count !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Footer hint ──────────────────────────────────────────────────────── */}
      <p className="text-center text-antique-text-mute text-sm mt-10">
        Can&apos;t find what you&apos;re looking for?{" "}
        <Link href="/search" className="text-antique-accent hover:underline">
          Try the full search
        </Link>{" "}
        with price, location and auction status filters.
      </p>
    </div>
  );
}
