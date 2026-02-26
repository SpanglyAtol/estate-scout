import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { QueryProvider } from "@/providers/query-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Estate Scout",
    template: "%s | Estate Scout",
  },
  description:
    "Find estate sales and auctions across every platform in one search. AI-powered price checking for antiques and collectibles.",
  keywords: ["estate sales", "auctions", "antiques", "LiveAuctioneers", "EstateSales.net"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adsenseId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

  return (
    <html lang="en">
      <head>{adsenseId ? <Script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`} crossOrigin="anonymous" strategy="afterInteractive" /> : null}</head>
      <body className={inter.className}>
        <QueryProvider>
          <Navbar />
          <main className="min-h-screen bg-gray-50">{children}</main>
          <footer className="border-t bg-white py-8 mt-16">
            <div className="container mx-auto px-4 text-center text-sm text-gray-500">
              <p>Estate Scout · Find it before anyone else</p>
              <p className="mt-1">
                We aggregate listings from third-party platforms. All purchases complete on the original platform.
              </p>
            </div>
          </footer>
        </QueryProvider>
      </body>
    </html>
  );
}
