"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// Static FAQ answers for navigation / site questions (no API needed)
const FAQ: Record<string, string> = {
  search:
    "To search for items, click **Search** in the navigation bar or use the search bar on the home page. You can filter by price, location, category, platform, and more.",
  "buyer's premium":
    "A buyer's premium is an additional charge (typically 18–25%) added on top of the winning bid. Estate Scout shows the estimated total cost including this premium where available.",
  "buyers premium":
    "A buyer's premium is an additional charge (typically 18–25%) added on top of the winning bid. Estate Scout shows the estimated total cost including this premium where available.",
  pricing:
    "Use the **Price Check** page to get an AI-powered valuation for any antique or collectible. Describe your item and we'll show comparable completed sales and an estimated price range.",
  "price check":
    "Use the **Price Check** page to get an AI-powered valuation for any antique or collectible. Describe your item and we'll show comparable completed sales and an estimated price range.",
  map:
    "The **Map** page lets you find estate sales and auctions near you. Enter your ZIP code and a search radius to see listings on an interactive map.",
  "estate sale":
    "Estate sales are multi-day in-person events where an estate's contents are sold, often at a house. They appear in the **Estate Sales** section. You can also filter for them on the Search page.",
  catalog:
    "Your **My Catalog** lets you photograph and track items you own or want to research. You can get AI-powered price estimates and information for anything in your catalog.",
  alert:
    "**Saved Searches & Alerts** let you get notified when new listings match your criteria — for example, 'Imari plates under $200 within 50 miles'. Set them up on the Saved page.",
  shipping:
    "Shipping availability varies by seller. Listings that ship nationally are marked on each card. For estate sales, items are typically pickup-only.",
  account:
    "You can create a free account to save searches, set alerts, and manage a personal catalog. Click **Sign In** in the top navigation to get started.",
};

function faqAnswer(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [key, answer] of Object.entries(FAQ)) {
    if (lower.includes(key)) return answer;
  }
  return null;
}

const SUGGESTIONS = [
  "How do I search for items?",
  "What is a buyer's premium?",
  "How does AI pricing work?",
  "Find estate sales near me",
];

export function ChatbotWidget() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to Estate Scout! I can help you navigate the site, explain auction terms, or guide you to what you're looking for. What can I help you with?",
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Check FAQ first
    const faq = faqAnswer(text);
    if (faq) {
      await new Promise((r) => setTimeout(r, 400)); // brief pause for realism
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: faq },
      ]);
      setLoading(false);
      return;
    }

    // Fall back to valuation API for item-related queries
    try {
      const res = await fetch("/api/v1/valuation/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_text: text }),
      });

      if (res.ok) {
        const data = await res.json();
        const narrative = data.narrative ?? "I found some information about that item.";
        const priceRange = data.price_range;
        let reply = narrative;
        if (priceRange?.mid) {
          reply += `\n\nEstimated value: **$${priceRange.low?.toLocaleString() ?? "—"} – $${priceRange.high?.toLocaleString() ?? "—"}** (median: $${priceRange.mid.toLocaleString()})`;
        }
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: reply },
        ]);
      } else {
        throw new Error("API error");
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            "I'm not sure about that one! You can try the **Search** page to browse listings, or the **Price Check** page for AI-powered item valuations.",
        },
      ]);
    }

    setLoading(false);
  }

  function renderContent(text: string) {
    // Simple bold markdown
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open chat assistant"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-antique-accent hover:bg-antique-accent-h text-white shadow-lg flex items-center justify-center transition-all hover:scale-105"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] rounded-xl shadow-2xl border border-antique-border bg-antique-surface flex flex-col overflow-hidden"
             style={{ height: "480px" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-antique-accent text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <span className="font-display font-bold text-sm">Estate Scout Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-antique-bg">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-antique-accent text-white rounded-br-sm"
                      : "bg-antique-surface border border-antique-border text-antique-text rounded-bl-sm"
                  }`}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-antique-surface border border-antique-border rounded-xl px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-antique-text-mute" />
                </div>
              </div>
            )}

            {/* Suggestions (only show when just the welcome message) */}
            {messages.length === 1 && !loading && (
              <div className="flex flex-col gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-antique-border bg-antique-surface text-antique-text-sec hover:border-antique-accent hover:text-antique-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-center gap-2 px-3 py-3 border-t border-antique-border bg-antique-surface"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={loading}
              className="flex-1 text-sm border border-antique-border rounded-lg px-3 py-2 bg-antique-bg text-antique-text placeholder:text-antique-text-mute focus:outline-none focus:border-antique-accent transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="p-2 bg-antique-accent text-white rounded-lg hover:bg-antique-accent-h transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
