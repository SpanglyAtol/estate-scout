"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, BookMarked, MessageSquare, MapPin, LogIn, LogOut, Menu, X, BarChart3 } from "lucide-react";
import { isLoggedIn, logout } from "@/lib/auth";

export function Navbar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Read auth state client-side (token is in localStorage)
  useEffect(() => {
    setLoggedIn(isLoggedIn());
    // Re-check on focus (handles login in another tab)
    const handleFocus = () => setLoggedIn(isLoggedIn());
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const navLinks = [
    { href: "/search",      label: "Search",      icon: <Search    className="w-4 h-4" /> },
    { href: "/estate-sales",label: "Estate Sales", icon: <MapPin    className="w-4 h-4" /> },
    { href: "/valuation",   label: "Price Check",  icon: <MessageSquare className="w-4 h-4" /> },
    { href: "/saved",       label: "Saved",        icon: <BookMarked className="w-4 h-4" /> },
    { href: "/admin",       label: "Admin",        icon: <BarChart3  className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <Search className="w-5 h-5" />
          Estate Scout
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
            >
              {l.icon}
              {l.label}
            </Link>
          ))}

          {loggedIn ? (
            <button
              onClick={() => { logout(); setLoggedIn(false); }}
              className="flex items-center gap-1.5 text-gray-500 hover:text-red-500 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 text-sm font-medium text-gray-700 py-2"
            >
              {l.icon}
              {l.label}
            </Link>
          ))}
          <hr className="border-gray-100" />
          {loggedIn ? (
            <button
              onClick={() => { logout(); setLoggedIn(false); setMobileOpen(false); }}
              className="flex items-center gap-3 text-sm font-medium text-red-500 py-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <Link
              href="/auth"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 text-sm font-medium text-blue-600 py-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In / Sign Up
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
