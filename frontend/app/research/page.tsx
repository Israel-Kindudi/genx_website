import Link from "next/link";
import Nav from "@/components/Nav";
const CARDS = [
  { icon: "🔧", title: "Feature Engineering", desc: "60+ features from OHLC and trade logs: volatility, trend, regime, DNA, and strategy parameters." },
  { icon: "🌊", title: "Regime Detection", desc: "Five market regimes classified per cycle: strong trend up/down, weak trend, ranging, and high volatility." },
  { icon: "🧠", title: "Win Predictor", desc: "Random Forest classifiers trained per symbol predict win probability before trade execution." },
  { icon: "🔍", title: "SHAP Explanations", desc: "Every rejected trade has a SHAP breakdown showing which features drove the decision." },
  { icon: "📈", title: "Surrogate Models", desc: "ML surrogates on GA logs predict fitness, cutting optimisation time up to 5×." },
  { icon: "🛡️", title: "Audit Suite", desc: "Every session audited for execution integrity, data quality, and risk constraints." },
];

export default function ResearchPage() {
  return (
    <main className="min-h-screen">
     < Nav />

      <section className="px-6 py-20 text-center">
        <span className="text-xs font-semibold text-[#00ff88] uppercase tracking-widest">
          Research
        </span>
        <h1 className="text-5xl font-bold mt-4 mb-6">Data Mining & Machine Learning</h1>
        <p className="text-xl text-gray-400 max-w-3xl mx-auto">
          Feature engineering, regime detection, win prediction, and SHAP-based
          explanations — all running on the GenX trade database.
        </p>
      </section>

      <section className="px-6 py-12 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-6">
          {CARDS.map((c) => (
            <div key={c.title} className="card">
              <div className="text-4xl mb-4">{c.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-gray-400">{c.desc}</p>
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