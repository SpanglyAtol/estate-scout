"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/cn";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInterface({
  messages,
  onSend,
  isLoading,
  placeholder = "Describe the item...",
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-[300px] max-h-[500px] border border-antique-border rounded-xl bg-antique-muted">
        {messages.length === 0 && (
          <div className="text-center text-antique-text-mute py-12 text-sm">
            <p className="text-3xl mb-3">🏺</p>
            <p>Describe an item to get a price estimate.</p>
            <p className="mt-1">
              Example: &quot;Haviland Limoges dinner plate, pink roses, no chips&quot;
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-antique-accent text-white rounded-br-sm"
                  : "bg-antique-surface border border-antique-border text-antique-text rounded-bl-sm"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-antique-surface border border-antique-border rounded-2xl rounded-bl-sm px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-antique-text-mute" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 border border-antique-border bg-antique-surface text-antique-text rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-antique-accent disabled:bg-antique-muted"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="bg-antique-accent text-white rounded-xl px-4 py-2.5 hover:bg-antique-accent-h disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
