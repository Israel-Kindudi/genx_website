import Link from "next/link";
import Nav from "@/components/Nav";
import PricingSection from "@/components/PricingSection";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Nav />

      <section className="px-6 py-24 bg-gradient-to-br from-transparent via-transparent to-purple-900/10">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] mb-6">
              Quantitative Trading Platform
            </span>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Where Markets
              <br />
              Meet <span className="gradient-text">Genetics</span>
            </h1>
            <p className="text-lg text-gray-400 mb-8 max-w-lg">
              GenX models each market as a chromosome-like data structure — the
              Market DNA — and evolves strategy parameters with a genetic
              algorithm guided by statistical fitness.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/vision" className="btn-primary">
                Explore the vision
              </Link>
              <Link href="/dashboard" className="btn-ghost">
                View dashboard
              </Link>
            </div>
            <div className="flex gap-10 mt-12">
              <div>
                <div className="text-3xl font-bold gradient-text">8</div>
                <div className="text-xs text-gray-500">DNA chromosomes</div>
              </div>
              <div>
                <div className="text-3xl font-bold gradient-text">10+</div>
                <div className="text-xs text-gray-500">Strategies</div>
              </div>
              <div>
                <div className="text-3xl font-bold gradient-text">GA</div>
                <div className="text-xs text-gray-500">Optimisation</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex items-center gap-2 h-80 p-8 bg-[#1a1a2e] border border-[#2d3748] rounded-3xl">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3/5 rounded-md animate-pulse"
                  style={{
                    background: "linear-gradient(180deg, #00ff88, #a855f7)",
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: "2.4s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold text-[#00ff88] uppercase tracking-widest">
              The Framework
            </span>
            <h2 className="text-4xl font-bold mt-3 mb-4">
              Four pillars of GenX
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Every decision in GenX is driven by the intersection of market
              structure, statistical rigor, evolutionary search, and live
              execution.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: "🧬",
                title: "Market DNA",
                text: "Eight statistical chromosomes capture volatility, momentum, structure, and more.",
              },
              {
                icon: "📊",
                title: "Fast Backtester",
                text: "Vectorized backtests with pre-computed indicators — thousands of combos in minutes.",
              },
              {
                icon: "🎯",
                title: "Genetic Optimisation",
                text: "DNA-guided genetic algorithms evolve parameters using Sharpe, PnL, and win rate.",
              },
              {
                icon: "🚀",
                title: "Live Trading",
                text: "MT5 integration with regime detection, breakeven logic, and ML filtering.",
              },
            ].map((c) => (
              <div key={c.title} className="card">
                <div className="text-4xl mb-4">{c.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
                <p className="text-sm text-gray-400">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
               <PricingSection />
      <footer className="border-t border-[#2d3748] bg-[#11112a] px-6 py-12">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span>🧬</span>
            <span className="gradient-text">GenX</span>
          </div>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} GenX (SYNTHX). All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}