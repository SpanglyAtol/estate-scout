"use client";

import Link from "next/link";
import {
  Check, Search, Bell, MapPin, BookOpen,
  Star, Package, Zap, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TierFeature {
  label: string;
  included: boolean;
  note?: string;
}

// ── Tier definitions ──────────────────────────────────────────────────────────

const tiers: Array<{
  id: string; name: string; price: number; period: string | null;
  badge: string | null; description: string; cta: string;
  ctaHref: string; ctaStyle: string; features: TierFeature[];
}> = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: null,
    badge: null,
    description: "Everything you need to discover and browse estate sales and auctions.",
    cta: "Get Started",
    ctaHref: "/search",
    ctaStyle: "border border-antique-border text-antique-text hover:border-antique-accent",
    features: [
      { label: "Search all platforms (HiBid, MaxSold, BidSpotter, EstateSales.NET)", included: true },
      { label: "Map view — find sales near you by ZIP or location", included: true },
      { label: "Listing detail pages with buyer's premium breakdown", included: true },
      { label: "5 saved searches", included: true },
      { label: "5 AI price checks per month", included: true },
      { label: "Basic item catalog (5 items)", included: true },
      { label: "Contextual ads between results", included: false, note: "ad-supported" },
      { label: "Unlimited saved searches", included: false },
      { label: "Extended catalog", included: false },
    ],
  },
  {
    id: "pro",
    name: "Subscriber",
    price: 6,
    period: "month",
    badge: "Most Popular",
    description: "Ad-free browsing, unlimited saved searches, and a 100-item personal catalog.",
    cta: "Start Free Trial",
    ctaHref: "/auth?plan=pro",
    ctaStyle: "bg-antique-accent text-white hover:bg-antique-accent-h",
    features: [
      { label: "Everything in Free", included: true },
      { label: "No ads — completely clean browsing experience", included: true },
      { label: "Unlimited saved searches & price alerts", included: true },
      { label: "Personal catalog up to 100 items", included: true },
      { label: "AI price checks — 50 per month", included: true },
      { label: "AI item analysis from your catalog photos", included: true },
      { label: "Email notifications for saved searches", included: true },
      { label: "Early access to new features", included: true },
      { label: "Unlimited catalog", included: false },
    ],
  },
  {
    id: "premium",
    name: "Collector",
    price: 20,
    period: "month",
    badge: "For Serious Collectors",
    description: "Unlimited catalog, unlimited AI checks, and full historical market data.",
    cta: "Start Free Trial",
    ctaHref: "/auth?plan=premium",
    ctaStyle: "bg-antique-text text-antique-bg hover:opacity-80",
    features: [
      { label: "Everything in Subscriber", included: true },
      { label: "Unlimited personal catalog", included: true },
      { label: "Unlimited AI price checks", included: true },
      { label: "Historical price charts by category", included: true },
      { label: "Bulk CSV export of your catalog", included: true },
      { label: "Priority support", included: true },
      { label: "AI listing generator for eBay, Etsy, Facebook & HiBid", included: true },
      { label: "Shipping rate comparison (USPS, UPS, FedEx)", included: true },
    ],
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────

const faqs = [
  {
    q: "What counts as an AI price check?",
    a: "Each valuation query — whether typed in the chatbot or run from your catalog — uses one check. Viewing the result again does not use another.",
  },
  {
    q: "What is the item catalog?",
    a: "Your personal catalog lets you upload photos of antiques and collectibles you own or are considering buying. The AI analyzes each item to provide identification, provenance notes, condition assessment, and a price estimate.",
  },
  {
    q: "Will the free tier always exist?",
    a: "Yes. Core search, map browsing, and listing details will always be free. We want the best discovery tool for estate sales to be accessible to everyone.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Absolutely. Cancel from your profile page at any time. You keep your subscription benefits until the end of the billing period.",
  },
  {
    q: "Why $6 and $20?",
    a: "We want the subscriber tier to be a no-brainer for anyone who uses the site regularly. The Collector tier covers users building a serious inventory — the unlimited catalog and AI checks pay for themselves quickly.",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">

      {/* Hero */}
      <div className="text-center mb-14">
        <p className="text-antique-accent font-display text-sm tracking-[0.2em] uppercase mb-3">
          Pricing
        </p>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-antique-text leading-tight mb-4 max-w-2xl mx-auto">
          Simple, Honest Pricing
        </h1>
        <p className="text-antique-text-sec text-lg max-w-xl mx-auto leading-relaxed">
          Free to browse. Upgrade when you want an ad-free experience and a personal catalog for your collection.
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        {tiers.map((tier) => (
          <div
            key={tier.id}
            className={`relative antique-card p-6 flex flex-col ${
              tier.id === "pro" ? "ring-2 ring-antique-accent ring-offset-2 ring-offset-antique-bg" : ""
            }`}
          >
            {tier.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="bg-antique-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                  {tier.badge}
                </span>
              </div>
            )}

            <div className="mb-5">
              <h2 className="font-display text-lg font-bold text-antique-text mb-1">{tier.name}</h2>
              <div className="flex items-baseline gap-1 mb-2">
                {tier.price === 0 ? (
                  <span className="font-display text-3xl font-bold text-antique-text">Free</span>
                ) : (
                  <>
                    <span className="text-sm text-antique-text-sec">$</span>
                    <span className="font-display text-3xl font-bold text-antique-text">{tier.price}</span>
                    <span className="text-sm text-antique-text-mute">/ {tier.period}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-antique-text-sec leading-relaxed">{tier.description}</p>
            </div>

            <ul className="space-y-2.5 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5">
                  {f.included ? (
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <X className="w-4 h-4 text-antique-border flex-shrink-0 mt-0.5" />
                  )}
                  <span className={`text-xs leading-relaxed ${f.included ? "text-antique-text-sec" : "text-antique-text-mute line-through"}`}>
                    {f.label}
                    {f.note && (
                      <span className="ml-1 not-line-through no-underline text-antique-text-mute">
                        ({f.note})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={`block text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${tier.ctaStyle}`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* What your subscription supports */}
      <div className="antique-card p-8 mb-14">
        <h2 className="font-display text-xl font-bold text-antique-text text-center mb-2">
          What Your Subscription Supports
        </h2>
        <p className="text-antique-text-sec text-sm text-center mb-8 max-w-xl mx-auto">
          Subscriptions keep Estate Scout independent, ad-light, and continuously improving.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { icon: Search,   label: "Daily scraper runs",       sub: "Fresh listings every morning" },
            { icon: Star,     label: "AI model costs",           sub: "Price checks & catalog analysis" },
            { icon: Package,  label: "Database infrastructure",  sub: "Built for 9M+ listings" },
            { icon: Zap,      label: "New platform scrapers",    sub: "eBay, 1stDibs, Proxibid next" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label}>
              <Icon className="w-6 h-6 text-antique-accent mx-auto mb-2" />
              <p className="text-sm font-semibold text-antique-text">{label}</p>
              <p className="text-xs text-antique-text-mute mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue model transparency */}
      <div className="antique-card-warm border border-antique-border rounded-xl p-6 mb-14">
        <h2 className="font-display text-lg font-bold text-antique-text mb-1">How We Stay Free for Everyone</h2>
        <p className="text-xs text-antique-text-sec mb-4 leading-relaxed">
          Free users see contextual ads between listing cards — relevant things like display cases, cleaning supplies,
          and shipping materials. Ads are never shown inside search results or on detail pages. Subscribers see no ads at all.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-antique-text-sec">
          <div className="flex items-start gap-2">
            <Bell className="w-4 h-4 text-antique-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-antique-text">Contextual Ads</p>
              <p>Google AdSense — relevant to what you browse</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-antique-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-antique-text">Affiliate Links</p>
              <p>Care &amp; display products on listing detail pages</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-antique-accent flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-antique-text">Sponsored Listings</p>
              <p>Estate sale companies can promote relevant sales</p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-10">
        <h2 className="font-display text-xl font-bold text-antique-text text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {faqs.map(({ q, a }) => (
            <div key={q} className="antique-card p-5">
              <p className="text-sm font-semibold text-antique-text mb-1.5">{q}</p>
              <p className="text-xs text-antique-text-sec leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center">
        <p className="text-antique-text-mute text-sm mb-4">
          WorthPoint charges $200/year for historical prices only.
          Estate Scout gives you live discovery, price checking, and a personal catalog — starting free.
        </p>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 bg-antique-accent text-white px-6 py-3 rounded-lg font-semibold hover:bg-antique-accent-h transition-colors"
        >
          <Search className="w-4 h-4" />
          Start Searching for Free
        </Link>
      </div>

    </div>
  );
}
