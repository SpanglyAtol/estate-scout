"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-antique-bg px-4">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-antique-accent-s border border-antique-accent-lt mb-4">
            <Lock className="w-6 h-6 text-antique-accent" />
          </div>
          <h1 className="font-display text-2xl font-bold text-antique-text">Admin Access</h1>
          <p className="text-sm text-antique-text-mute mt-1">Estate Scout Operations Dashboard</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="antique-card p-6 space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-antique-text-sec mb-1.5">
              Admin password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                required
                autoFocus
                className="w-full bg-antique-surface border border-antique-border rounded-lg px-3 py-2.5 pr-10 text-sm text-antique-text placeholder:text-antique-text-mute focus:ring-2 focus:ring-antique-accent focus:border-transparent outline-none transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-antique-text-mute hover:text-antique-text-sec transition-colors"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-antique-accent text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-antique-accent-h transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-antique-text-mute mt-6">
          Set <code className="bg-antique-subtle px-1 rounded">ADMIN_PASSWORD</code> in your environment variables to enable this dashboard.
        </p>
      </div>
    </div>
  );
}
