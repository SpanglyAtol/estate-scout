/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.liveauctioneers.com" },
      { protocol: "https", hostname: "**.estatesales.net" },
      { protocol: "https", hostname: "**.hibid.com" },
      { protocol: "https", hostname: "**.maxsold.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;
