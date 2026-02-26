"use client";

import Link from "next/link";
import {
  Search, Bell, MapPin, Check, Star, Megaphone, ShoppingBag, Tag,
} from "lucide-react";

// ── Revenue stream cards ──────────────────────────────────────────────────────

const revenueStreams = [
  {
    icon: Megaphone,
    color: "blue",
    title: "Contextual Ads",
    description:
      "Google AdSense shows relevant ads between listing cards — think cleaning kits for pottery, display cases for collectibles, shipping supplies for antiques. Ads are placed thoughtfully and never in the middle of search results.",
    note: "We chose AdSense because it matches ads to what you're actually browsing.",
  },
  {
    icon: ShoppingBag,
    color: "amber",
    title: "Amazon Affiliate Links",
    description:
      "When you're viewing a piece of silver or a vintage camera, we surface \"How to care for & display this\" with relevant Amazon product links. If you buy something through a link, we earn a small commission at no cost to you.",
    note: "Only shown on listing detail pages. Never pushed as ads.",
  },
  {
    icon: Tag,
    color: "green",
    title: "Sponsored Listings",
    description:
      "Local estate sale companies can pay to appear at the top of relevant searches with a clear \"Sponsored\" badge. These are real active sales, not random banners — they're always relevant to what you're searching for.",
    note: "Sponsored placements are always labeled. We never disguise them.",
  },
];

const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
  blue:  { bg: "bg-blue-50",  icon: "text-blue-600",  border: "border-blue-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", border: "border-amber-100" },
  green: { bg: "bg-green-50", icon: "text-green-600", border: "border-green-100" },
};

// ── Full feature list ─────────────────────────────────────────────────────────

const features = [
  { icon: Search,  text: "Search across LiveAuctioneers, EstateSales.NET, HiBid, MaxSold & more" },
  { icon: MapPin,  text: "Browse local estate sales by city or zip — 8 platforms in one place" },
  { icon: Bell,    text: "Save searches and set price alerts with email notifications" },
  { icon: Star,    text: "AI Price Check — see comparable sold items and estimated value" },
  { icon: Check,   text: "Filter by location radius, pickup only, ending soon, price range" },
  { icon: Check,   text: "Unlimited saved searches and alerts during early access" },
  { icon: Check,   text: "Full listing detail pages with buyer's premium breakdowns" },
  { icon: Check,   text: "Mobile-friendly — works on any device" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">

      {/* Hero */}
      <div className="text-center mb-14">
        <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
          <Check className="w-4 h-4" /> 100% Free — No Credit Card Required
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Estate Scout is Free.
          <br />
          <span className="text-blue-600">Here&apos;s How We Keep It That Way.</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          We believe everyone — from casual weekend browsers to serious collectors — deserves
          access to every estate sale and auction in one place, without a subscription.
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <Link
            href="/search"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            Start Searching
          </Link>
          <Link
            href="/estate-sales"
            className="bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            Browse Local Sales
          </Link>
        </div>
      </div>

      {/* Revenue streams */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          How We Make Money
        </h2>
        <p className="text-gray-500 text-center mb-8 text-sm">
          Three ad-supported revenue streams — none of them subscriptions.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {revenueStreams.map((stream) => {
            const Icon = stream.icon;
            const c = colorMap[stream.color];
            return (
              <div
                key={stream.title}
                className={`rounded-2xl border p-6 ${c.bg} ${c.border}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-white shadow-sm`}>
                  <Icon className={`w-5 h-5 ${c.icon}`} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{stream.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{stream.description}</p>
                <p className="text-xs text-gray-400 italic">{stream.note}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full feature list */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-12">
        <div className="text-center mb-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Early Access — Everything Included
          </span>
          <h2 className="text-2xl font-bold text-gray-900 mt-3 mb-1">
            Everything, Free, Right Now
          </h2>
          <p className="text-sm text-gray-500">
            While we&apos;re in early access, all features are available to everyone.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.text} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{f.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transparency note */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center">
        <h3 className="font-semibold text-gray-900 mb-2">A Note on the Future</h3>
        <p className="text-sm text-gray-600 max-w-2xl mx-auto">
          We may introduce an optional small upgrade to remove banner ads entirely — something
          like $4–5/month for users who find the app valuable and want a cleaner experience.
          Core search, estate sale browsing, and alerts will always be free.
          <br />
          <span className="text-gray-400 text-xs mt-2 block">
            No bait-and-switch. No features held hostage. We&apos;ll earn your trust first.
          </span>
        </p>
      </div>

      {/* Comparison note */}
      <p className="text-center text-sm text-gray-400 mt-8">
        WorthPoint (historical prices only, no discovery) charges $200/year.{" "}
        <strong className="text-gray-600">We do both — and we&apos;re free.</strong>
      </p>
    </div>
  );
}
