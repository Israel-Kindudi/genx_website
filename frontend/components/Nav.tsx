"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isAuthenticated, clearToken, isAdmin } from "@/lib/auth";

export default function Nav() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setLoggedIn(isAuthenticated());
    setAdmin(isAdmin());
  }, [pathname]);

  const links = [
    { href: "/vision", label: "Vision" },
    { href: "/strategies", label: "Strategies" },
    { href: "/research", label: "Research" },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="sticky top-0 z-50 bg-[#0a0a1a]/85 backdrop-blur-md border-b border-[#2d3748]">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">🧬</span>
          <span className="gradient-text">GenX</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                isActive(l.href)
                  ? "text-white"
                  : "text-gray-400 hover:text-white transition-colors"
              }
            >
              {l.label}
            </Link>
          ))}

          {loggedIn ? (
            <>
              <Link href="/dashboard" className="btn-primary text-sm py-2">
                Dashboard →
              </Link>
              <Link
                href="/dashboard/billing"
                className={
                  isActive("/dashboard/billing")
                    ? "text-white"
                    : "text-sm text-gray-400 hover:text-white transition-colors"
                }
              >
                Billing
              </Link>
              {admin && (
                <Link
                  href="/dashboard/users"
                  className={
                    isActive("/dashboard/users")
                      ? "text-white"
                      : "text-sm text-gray-400 hover:text-white transition-colors"
                  }
                >
                  Users
                </Link>
              )}
              <button
                onClick={() => {
                  clearToken();
                  setLoggedIn(false);
                  window.location.href = "/";
                }}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link href="/login" className="btn-primary text-sm py-2">
                Get started →
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-2xl"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? "✕" : "☰"}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#2d3748] bg-[#11112a] px-6 py-4 space-y-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-gray-300 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          {loggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="block text-[#00ff88]"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard →
              </Link>
              <Link
                href="/dashboard/billing"
                className="block text-gray-300 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                Billing
              </Link>
              {admin && (
                <Link
                  href="/dashboard/users"
                  className="block text-gray-300 hover:text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  Users
                </Link>
              )}
              <button
                onClick={() => {
                  clearToken();
                  setLoggedIn(false);
                  window.location.href = "/";
                }}
                className="block text-gray-400 hover:text-white"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="block text-gray-400 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="block text-[#00ff88]"
                onClick={() => setMobileOpen(false)}
              >
                Get started →
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}