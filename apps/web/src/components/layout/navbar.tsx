"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Search, BookMarked, MessageSquare, MapPin,
  LogIn, LogOut, Menu, X, BarChart3, User, BookOpen, TrendingUp, LayoutGrid, Library,
} from "lucide-react";
import { isLoggedIn, logout } from "@/lib/auth";
import { getConnectedAccounts } from "@/lib/connected-accounts";
import { ThemeToggle } from "./theme-toggle";

export function Navbar() {
  const [loggedIn, setLoggedIn]     = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);
  const [isAdmin, setIsAdmin]       = useState(false);

  useEffect(() => {
    const check = () => {
      setLoggedIn(isLoggedIn());
      setConnectedCount(getConnectedAccounts().length);
    };
    check();
    window.addEventListener("focus", check);
    // Check admin session cookie (httpOnly — must go via API)
    fetch("/api/admin/auth")
      .then((r) => r.json())
      .then((d: { isAdmin?: boolean }) => setIsAdmin(Boolean(d.isAdmin)))
      .catch(() => {});
    return () => window.removeEventListener("focus", check);
  }, []);

  const navLinks = [
    { href: "/search",       label: "Search",        icon: <Search        className="w-4 h-4" /> },
    { href: "/categories",   label: "Categories",    icon: <LayoutGrid    className="w-4 h-4" /> },
    { href: "/estate-sales", label: "Estate Sales",  icon: <MapPin        className="w-4 h-4" /> },
    { href: "/library",      label: "Library",       icon: <Library       className="w-4 h-4" /> },
    { href: "/valuation",    label: "Price Check",   icon: <MessageSquare className="w-4 h-4" /> },
    { href: "/pricing-guide", label: "Market Data",   icon: <TrendingUp    className="w-4 h-4" /> },
    { href: "/saved",          label: "Saved",          icon: <BookMarked className="w-4 h-4" /> },
    ...(loggedIn ? [{ href: "/catalog", label: "My Catalog", icon: <BookOpen className="w-4 h-4" /> }] : []),
    ...(isAdmin  ? [{ href: "/admin",   label: "Admin",      icon: <BarChart3 className="w-4 h-4" /> }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 bg-antique-surface border-b border-antique-border shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-antique-accent">
            <Search className="w-5 h-5" />
          </span>
          <span className="font-display font-bold text-lg text-antique-text tracking-wide group-hover:text-antique-accent transition-colors">
            Estate Scout
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-5 text-sm font-body text-antique-text-sec">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-antique-accent transition-colors flex items-center gap-1.5 py-1"
            >
              {l.icon}
              {l.label}
            </Link>
          ))}

          <span className="text-antique-border">|</span>

          <ThemeToggle />

          {loggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="relative flex items-center gap-1.5 hover:text-antique-accent transition-colors"
                title="My Profile"
              >
                <User className="w-4 h-4" />
                Profile
                {connectedCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-antique-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                    {connectedCount}
                  </span>
                )}
              </Link>

              <span className="text-antique-border">|</span>

              <button
                onClick={() => { logout(); setLoggedIn(false); }}
                className="flex items-center gap-1.5 text-antique-text-mute hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-1.5 hover:text-antique-accent transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile controls */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            className="p-2 text-antique-text-sec hover:text-antique-accent transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-antique-surface border-t border-antique-border px-4 py-4 space-y-1">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 text-sm font-medium text-antique-text-sec hover:text-antique-accent transition-colors py-2.5 border-b border-antique-border last:border-0"
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
          <div className="pt-2">
            {loggedIn ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 text-sm font-medium text-antique-text-sec hover:text-antique-accent transition-colors py-2.5"
                >
                  <User className="w-4 h-4" />
                  My Profile
                  {connectedCount > 0 && (
                    <span className="ml-auto bg-antique-accent-lt text-antique-accent text-xs font-semibold px-2 py-0.5 rounded-full">
                      {connectedCount} connected
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => { logout(); setLoggedIn(false); setMobileOpen(false); }}
                  className="flex items-center gap-3 text-sm font-medium text-red-600 py-2.5"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 text-sm font-medium text-antique-accent py-2.5"
              >
                <LogIn className="w-4 h-4" />
                Sign In / Sign Up
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
