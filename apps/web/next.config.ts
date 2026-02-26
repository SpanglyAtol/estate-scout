import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle scraped JSON data into Vercel serverless function output so
  // fs.readFileSync works correctly in API routes on Vercel
  outputFileTracingIncludes: {
    "/api/**": ["./src/data/**"],
  },
  images: {
    remotePatterns: [
      // ── Core scraper sources ───────────────────────────────────────────────
      { protocol: "https", hostname: "**.liveauctioneers.com" },
      { protocol: "https", hostname: "**.estatesales.net" },
      { protocol: "https", hostname: "**.hibid.com" },
      { protocol: "https", hostname: "**.maxsold.com" },
      { protocol: "https", hostname: "**.gsalr.com" },
      { protocol: "https", hostname: "**.estatesales.org" },
      // ── Cloud storage / CDN (images may live on these even for above sites) ─
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.fastly.net" },
      { protocol: "https", hostname: "**.auctionzip.com" },
      { protocol: "https", hostname: "**.azureedge.net" },
      { protocol: "https", hostname: "portal-images.azureedge.net" },
      { protocol: "https", hostname: "**.bidspotter.com" },
      // ── HTTP fallback for older platforms serving non-HTTPS images ─────────
      { protocol: "http", hostname: "**.liveauctioneers.com" },
      { protocol: "http", hostname: "**.estatesales.net" },
      { protocol: "http", hostname: "**.hibid.com" },
      { protocol: "http", hostname: "**.maxsold.com" },
      { protocol: "http", hostname: "images.maxsold.com" },
      // ── Placeholder / dev ──────────────────────────────────────────────────
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**.picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  },
};

export default nextConfig;
