/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // ── Core scraper sources ───────────────────────────────────────────────
      { protocol: "https", hostname: "**.liveauctioneers.com" },
      { protocol: "https", hostname: "**.estatesales.net" },
      { protocol: "https", hostname: "**.hibid.com" },
      { protocol: "https", hostname: "**.maxsold.com" },
      { protocol: "https", hostname: "**.gsalr.com" },
      { protocol: "https", hostname: "**.estatesales.org" },
      // ── New scrapers (eBay, 1stDibs, Proxibid) ────────────────────────────
      { protocol: "https", hostname: "**.ebayimg.com" },
      { protocol: "https", hostname: "i.ebayimg.com" },
      { protocol: "https", hostname: "**.1stdibs.com" },
      { protocol: "https", hostname: "a.1stdibscdn.com" },
      { protocol: "https", hostname: "**.proxibid.com" },
      { protocol: "https", hostname: "**.bidpath.com" },
      // ── Cloud storage / CDN ────────────────────────────────────────────────
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.fastly.net" },
      { protocol: "https", hostname: "**.auctionzip.com" },
      { protocol: "https", hostname: "**.azureedge.net" },
      { protocol: "https", hostname: "portal-images.azureedge.net" },
      { protocol: "https", hostname: "**.bidspotter.com" },
      // BidSpotter serves listing images via GlobalAuctionPlatform CDN
      { protocol: "https", hostname: "cdn.globalauctionplatform.com" },
      { protocol: "https", hostname: "**.globalauctionplatform.com" },
      // ── HTTP fallback for older platforms ──────────────────────────────────
      { protocol: "http", hostname: "**.liveauctioneers.com" },
      { protocol: "http", hostname: "**.estatesales.net" },
      { protocol: "http", hostname: "**.hibid.com" },
      { protocol: "http", hostname: "**.maxsold.com" },
      { protocol: "http", hostname: "images.maxsold.com" },
      // ── Discovery scraper sources ──────────────────────────────────────────
      { protocol: "https", hostname: "**.caseantiques.com" },
      { protocol: "https", hostname: "caseantiques.com" },
      { protocol: "https", hostname: "cdn.prod.website-files.com" },
      // ── Placeholder / dev ──────────────────────────────────────────────────
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "**.picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  env: {
    // Server-side default for SSR API calls.
    // Browser calls use relative URLs (see api-client.ts) so this only
    // matters for server-rendered pages calling Next.js API routes.
    // Set NEXT_PUBLIC_API_URL in your environment to point at an external
    // FastAPI backend; leave unset to use the built-in Next.js API routes.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;
