"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChatInterface } from "@/components/valuation/chat-interface";
import { CompGrid } from "@/components/valuation/comp-grid";
import { getValuation } from "@/lib/api-client";
import type { ChatMessage, ValuationResult } from "@/types";

let messageCounter = 0;

export default function ValuationPage() {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [latestResult, setLatestResult] = useState<ValuationResult | null>(null);
  const autoSentRef = useRef(false);

  // If ?q= is in the URL (e.g. from listing detail "Check Price" button), auto-send
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      handleSend(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend(text: string) {
    const userMsg: ChatMessage = {
      id: String(++messageCounter),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setIsLoading(true);

    try {
      const result = await getValuation({ query_text: text });
      setLatestResult(result);

      const assistantMsg: ChatMessage = {
        id: String(++messageCounter),
        role: "assistant",
        content: result.narrative,
        result,
        timestamp: new Date().toISOString(),
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: String(++messageCounter),
        role: "assistant",
        content: "Sorry, I couldn't get a valuation right now. Make sure the backend is running.",
        timestamp: new Date().toISOString(),
      };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Price Check</h1>
      <p className="text-gray-600 mb-8">
        Describe an item to see what similar pieces sold for — and get an estimated value.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chat */}
        <div className="flex flex-col">
          <ChatInterface
            messages={messages}
            onSend={handleSend}
            isLoading={isLoading}
            placeholder='Try: "Haviland Limoges plate, pink roses, no chips"'
          />

          {/* Example queries */}
          {messages.length === 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase">Try these:</p>
              {[
                "Imari porcelain bowl 8 inch blue and red",
                "Fornasetti plate architectural design",
                "Royal Doulton figurine excellent condition",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => handleSend(example)}
                  className="w-full text-left text-sm bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Comp results */}
        <div>
          {latestResult ? (
            <CompGrid
              comps={latestResult.comparable_sales}
              priceRange={latestResult.price_range}
            />
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
              <div className="text-5xl mb-4">📊</div>
              <p className="font-medium">Comparable sales will appear here</p>
              <p className="text-sm mt-2">
                We search our database of completed auction results to find similar items.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
