import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

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
    <html lang="en" suppressHydrationWarning className={`${playfair.variable} ${inter.variable}`}>
      <head>
        {adsenseId ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>
            <Navbar />
            <main className="min-h-screen bg-antique-bg">
              {children}
            </main>
            <footer className="border-t border-antique-border bg-antique-surface py-10 mt-20">
              <div className="container mx-auto px-4 text-center">
                <p className="font-display text-base text-antique-text-sec tracking-wide">
                  Estate Scout
                </p>
                <p className="text-xs text-antique-text-mute mt-2 max-w-md mx-auto leading-relaxed">
                  We aggregate listings from third-party platforms. All purchases complete on the original platform.
                </p>
              </div>
            </footer>
            <ChatbotWidget />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
