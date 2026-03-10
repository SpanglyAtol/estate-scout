"use client";

import Link from "next/link";

export default function ListingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container mx-auto px-4 py-20 max-w-xl text-center">
      <p className="text-5xl mb-6">🏺</p>
      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Could not load this listing
      </h1>
      <p className="text-gray-500 mb-6 text-sm">
        {error.message?.includes("404")
          ? "This listing may have ended or been removed from the platform."
          : "Something went wrong fetching the listing details."}
      </p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 transition-colors"
        >
          Try again
        </button>
        <Link
          href="/search"
          className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back to search
        </Link>
      </div>
    </div>
  );
}
