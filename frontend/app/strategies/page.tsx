import Link from "next/link";

import Nav from "@/components/Nav";
const SCALPING = [
  { name: "Scalping RSI+VWMA", desc: "RSI + Volume Weighted MA + trend filter.", tags: ["M5", "M15"] },
  { name: "Scalping DMI+MACD", desc: "DMI + Stochastic + MACD confirmation.", tags: ["M5", "M30"] },
  { name: "Scalping BB+MACD+TM", desc: "Bollinger Bands + MACD + trade manager.", tags: ["M5", "M15"] },
  { name: "Scalping HMA+Stoch", desc: "Hull Moving Average + Stochastic.", tags: ["M1", "M5"] },
  { name: "Scalping VWAP+StochRSI", desc: "VWAP bands + Stochastic RSI.", tags: ["M5", "M15"] },
];

const TREND = [
  { name: "Trend Following", desc: "Rolling high/low breakout.", tags: ["H1", "H4"] },
  { name: "Trend Following ADX", desc: "ADX + fast/slow EMA crossover.", tags: ["H1", "H4"] },
  { name: "Trend VWMA+SOTT", desc: "VWMA crossover + Self-Optimizing Trend Tracker.", tags: ["H1", "H4"] },
  { name: "Trend PMax+NSM", desc: "Profit Maximizer + Normalized Smoothed Momentum.", tags: ["H1", "H4"] },
  { name: "Trend Aroon+RSI+SMA", desc: "Aroon + RSI + SMA confirmation.", tags: ["H1", "H4"] },
];

export default function StrategiesPage() {
  return (
     <main className="min-h-screen">
    <Nav />

      <section className="px-6 py-20 text-center">
        <span className="text-xs font-semibold text-[#00ff88] uppercase tracking-widest">
          Library
        </span>
        <h1 className="text-5xl font-bold mt-4 mb-6">Strategies</h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Ten-plus production-grade strategies, each parameterised, backtested, and
          optimised per symbol.
        </p>
      </section>

      <section className="px-6 py-12 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Scalping Strategies</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {SCALPING.map((s) => (
            <div key={s.name} className="card">
              <h3 className="text-lg font-semibold mb-3">{s.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{s.desc}</p>
              <div className="flex gap-2 flex-wrap">
                {s.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 py-12 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-8">Trend-Following Strategies</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {TREND.map((s) => (
            <div key={s.name} className="card">
              <h3 className="text-lg font-semibold mb-3">{s.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{s.desc}</p>
              <div className="flex gap-2 flex-wrap">
                {s.tags.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[#00ff88]/10 text-[#00ff88]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-[#2d3748] bg-[#11112a] px-6 py-12 mt-20">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          © {new Date().getFullYear()} GenX (SYNTHX). All rights reserved.
        </div>
      </footer>
    </main>
  );
}