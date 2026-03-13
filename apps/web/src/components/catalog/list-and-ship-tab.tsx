"use client";

import { useState } from "react";
import { Sparkles, Package, Share2, X, Bell } from "lucide-react";
import type { CatalogItem } from "./catalog-types";
import { GenerateListingPanel } from "./generate-listing-panel";
import { ShippingCalculator } from "./shipping-calculator";

interface Props {
  items: CatalogItem[];
}

interface Platform {
  id: string;
  icon: string;
  label: string;
  description: string;
  color: string;
}

const PLATFORMS: Platform[] = [
  {
    id: "ebay",
    icon: "🛒",
    label: "eBay",
    description: "List to the world's largest online marketplace. Reach millions of buyers.",
    color: "from-yellow-500/10 to-amber-500/10",
  },
  {
    id: "etsy",
    icon: "🧵",
    label: "Etsy",
    description: "Perfect for vintage and handcrafted items. Connect with collectors who care.",
    color: "from-orange-500/10 to-red-500/10",
  },
  {
    id: "facebook",
    icon: "📘",
    label: "Facebook Marketplace",
    description: "Sell locally or nationwide. Great for large items or quick cash sales.",
    color: "from-blue-500/10 to-indigo-500/10",
  },
  {
    id: "hibid",
    icon: "🔨",
    label: "HiBid",
    description: "Run your own auction. Ideal for higher-value items with competitive bidding.",
    color: "from-stone-500/10 to-amber-500/10",
  },
];

function NotifyModal({ platform, onClose }: { platform: Platform; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    // Store in localStorage
    try {
      const key = "listAndShipNotify";
      const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
      if (!existing.includes(email)) {
        localStorage.setItem(key, JSON.stringify([...existing, email]));
      }
    } catch {
      // ignore storage errors
    }
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-antique-surface border border-antique-border rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-antique-text-mute hover:text-antique-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <span className="text-3xl block mb-3">{platform.icon}</span>
          <h3 className="font-display font-bold text-antique-text text-lg">
            {platform.label} Integration
          </h3>
          <p className="text-sm text-antique-text-sec mt-1">
            Direct listing to {platform.label} is coming soon. Be the first to know when it launches.
          </p>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <div className="w-10 h-10 bg-antique-accent-lt rounded-full flex items-center justify-center mx-auto mb-3">
              <Bell className="w-5 h-5 text-antique-accent" />
            </div>
            <p className="text-sm font-medium text-antique-text">You&apos;re on the list!</p>
            <p className="text-xs text-antique-text-sec mt-1">
              We&apos;ll notify you at {email} when this feature launches.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-3 py-2 rounded-lg border border-antique-border bg-antique-bg text-antique-text text-sm focus:outline-none focus:ring-2 focus:ring-antique-accent"
            />
            <button
              type="submit"
              className="w-full bg-antique-accent text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-antique-accent-h transition-colors"
            >
              Notify me when it&apos;s ready
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 bg-antique-accent-lt rounded-xl flex items-center justify-center flex-shrink-0 text-antique-accent">
        {icon}
      </div>
      <div>
        <h3 className="font-display font-bold text-antique-text text-base">{title}</h3>
        <p className="text-sm text-antique-text-sec">{description}</p>
      </div>
    </div>
  );
}

export function ListAndShipTab({ items }: Props) {
  const [notifyPlatform, setNotifyPlatform] = useState<Platform | null>(null);

  return (
    <div className="py-8 space-y-10 max-w-2xl mx-auto">
      {/* ── Section 1: AI Listing Generator ── */}
      <section className="antique-card p-6">
        <SectionHeading
          icon={<Sparkles className="w-5 h-5" />}
          title="AI Listing Generator"
          description="Generate platform-optimized titles, descriptions, and pricing with one click."
        />
        <GenerateListingPanel items={items} />
      </section>

      {/* ── Section 2: Shipping Calculator ── */}
      <section className="antique-card p-6">
        <SectionHeading
          icon={<Package className="w-5 h-5" />}
          title="Shipping Rate Calculator"
          description="Compare USPS, UPS, and FedEx rates instantly. Enter weight and dimensions for the most accurate estimate."
        />
        <ShippingCalculator />
      </section>

      {/* ── Section 3: Platform Connections ── */}
      <section>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-9 h-9 bg-antique-accent-lt rounded-xl flex items-center justify-center flex-shrink-0 text-antique-accent">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-antique-text text-base">
              Cross-Platform Listing
            </h3>
            <p className="text-sm text-antique-text-sec">
              Connect your accounts to list directly from Estate Scout to multiple platforms at once.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLATFORMS.map((platform) => (
            <div
              key={platform.id}
              className={`antique-card p-4 bg-gradient-to-br ${platform.color}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{platform.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-antique-text text-sm">
                    {platform.label}
                  </p>
                  <p className="text-xs text-antique-text-sec mt-0.5 leading-relaxed">
                    {platform.description}
                  </p>
                  <button
                    onClick={() => setNotifyPlatform(platform)}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs border border-antique-accent text-antique-accent px-3 py-1.5 rounded-lg hover:bg-antique-accent hover:text-white transition-colors font-medium"
                  >
                    <Bell className="w-3 h-3" />
                    Connect Account
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notify modal */}
      {notifyPlatform && (
        <NotifyModal platform={notifyPlatform} onClose={() => setNotifyPlatform(null)} />
      )}
    </div>
  );
}
