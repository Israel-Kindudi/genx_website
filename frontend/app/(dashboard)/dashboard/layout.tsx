"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getToken, clearToken, isAdmin } from "@/lib/auth";
import { useLiveSocket } from "@/lib/useLiveSocket";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  const { connected, updateCount } = useLiveSocket(() => {
    // The dashboard pages will handle their own refresh.
    // Here we just track the count for the sidebar indicator.
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const timer = setTimeout(() => {
      const token = getToken();
      if (!token) {
        console.log("[layout] no token, redirecting");
        window.location.replace("/login");
      } else {
        console.log("[layout] token OK");
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [isClient, pathname]);

  if (!isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Loading dashboard…
      </div>
    );
  }

  const links = [
    { href: "/dashboard", label: "Overview", adminOnly: false },
    { href: "/dashboard/live", label: "Live Sessions", adminOnly: false },
    { href: "/dashboard/mining", label: "Mining", adminOnly: false },
    { href: "/dashboard/audit", label: "Audit", adminOnly: false },
    { href: "/dashboard/users", label: "Users", adminOnly: true },
  ];

  const role = isAdmin() ? "Admin" : "User";

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-[#11112a] border-r border-[#2d3748] p-6 relative">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold mb-10"
        >
          <span className="text-2xl">🧬</span>
          <span className="gradient-text">GenX</span>
        </Link>

        <nav className="space-y-2">
          {links
            .filter((l) => !l.adminOnly || isAdmin())
            .map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`block px-4 py-2 rounded-lg transition-colors ${
                  pathname === l.href
                    ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a2e]"
                }`}
              >
                {l.label}
              </Link>
            ))}
        </nav>

        {/* Live status indicator */}
        <div className="absolute bottom-28 left-6 right-6 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-[#00ff88] animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-gray-400">
              {connected ? "Live" : "Disconnected"}
            </span>
            {updateCount > 0 && (
              <span className="text-[#00ff88] ml-auto">
                {updateCount} updates
              </span>
            )}
          </div>
        </div>

        <div className="absolute bottom-16 left-6 right-6 text-xs text-gray-500">
          Signed in as <span className="text-[#00ff88]">{role}</span>
        </div>

        <button
          onClick={() => {
            clearToken();
            window.location.replace("/login");
          }}
          className="absolute bottom-6 left-6 right-6 px-4 py-2 text-sm text-gray-400 hover:text-white border border-[#2d3748] rounded-lg"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}