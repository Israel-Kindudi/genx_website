"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, Building2, Star, Zap } from "lucide-react";
import { usePlans, type Plan } from "@/lib/usePlans";
import BillingCycleToggle from "./BillingCycleToggle";

function theme(code: string) {
  switch (code) {
    case "trial":
      return {
        border: "border-slate-800",
        bg: "bg-[#0e1220]",
        accent: "text-slate-300",
        button:
          "border border-slate-700 text-slate-200 hover:border-slate-500",
        chip: null as null | { label: string; cls: string; icon: any },
      };
    case "starter":
      return {
        border: "border-emerald-500/25",
        bg: "bg-gradient-to-b from-emerald-500/[0.04] to-transparent",
        accent: "text-emerald-300",
        button:
          "border border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/10",
        chip: null,
      };
    case "pro":
      return {
        border: "border-cyan-500/50",
        bg: "bg-gradient-to-b from-cyan-500/[0.07] to-transparent",
        accent: "text-cyan-300",
        button: "bg-cyan-500 text-slate-900 hover:bg-cyan-400",
        chip: {
          label: "Most popular",
          cls: "bg-cyan-500 text-slate-900",
          icon: Star,
        },
      };
    case "firm":
      return {
        border: "border-violet-500/40",
        bg: "bg-gradient-to-b from-violet-500/[0.06] to-transparent",
        accent: "text-violet-300",
        button:
          "border border-violet-500/60 text-violet-200 hover:bg-violet-500/10",
        chip: {
          label: "For desks",
          cls: "bg-violet-500 text-slate-900",
          icon: Sparkles,
        },
      };
    case "firm_xl":
      return {
        border: "border-amber-500/50",
        bg: "bg-gradient-to-b from-amber-500/[0.07] to-transparent",
        accent: "text-amber-300",
        button: "bg-amber-500 text-slate-900 hover:bg-amber-400",
        chip: {
          label: "For prop firms",
          cls: "bg-amber-500 text-slate-900",
          icon: Building2,
        },
      };
    default:
      return {
        border: "border-slate-800",
        bg: "bg-[#111625]",
        accent: "text-slate-300",
        button:
          "border border-slate-700 text-slate-200 hover:border-slate-600",
        chip: null,
      };
  }
}

function PricingCard({
  plan,
  cycle,
}: {
  plan: Plan;
  cycle: "monthly" | "yearly";
}) {
  const t = theme(plan.code);
  const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  const suffix = cycle === "yearly" ? "/yr" : "/mo";
  const isFree = price === 0;

  const ctaHref =
    plan.code === "trial"
      ? "/login?next=/dashboard"
      : plan.code === "firm_xl"
      ? "mailto:sales@genx.trade?subject=GenX%20Firm%20XL"
      : `/checkout/${plan.code}?cycle=${cycle}`;

  const ctaLabel =
    plan.code === "trial"
      ? "Start free"
      : plan.code === "firm_xl"
      ? "Contact sales"
      : "Get started";

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-0.5 ${t.border} ${t.bg} ${
        plan.code === "pro"
          ? "shadow-[0_0_40px_-12px_rgba(6,182,212,0.45)] lg:scale-[1.03]"
          : ""
      }`}
    >
      {t.chip && (
        <div
          className={`absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${t.chip.cls}`}
        >
          <t.chip.icon className="h-3 w-3" /> {t.chip.label}
        </div>
      )}

      <div>
        <div
          className={`text-sm font-semibold uppercase tracking-wider ${t.accent}`}
        >
          {plan.name}
        </div>
        <div className="mt-1 min-h-[2.5rem] text-sm text-slate-400">
          {plan.description}
        </div>
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-slate-100">
          {isFree ? "$0" : `$${price.toLocaleString()}`}
        </span>
        {!isFree && <span className="text-sm text-slate-500">{suffix}</span>}
        {isFree && <span className="text-sm text-slate-500">forever</span>}
      </div>

      {plan.max_cycles != null && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Zap className={`h-3.5 w-3.5 ${t.accent}`} />
          <span className={`font-semibold ${t.accent}`}>
            {plan.max_cycles.toLocaleString()}
          </span>
          <span>
            cycles · {plan.cycles_expire ? "30-day expiry" : "never expire"}
          </span>
        </div>
      )}

      <div className="my-5 h-px w-full bg-slate-800" />

      <ul className="flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${t.accent}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`mt-6 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${t.button}`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

export default function PricingSection() {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const { plans, isLoading } = usePlans({ publicOnly: true });

  return (
    <section id="pricing" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Pricing
          </div>
          <h2 className="text-4xl font-bold text-slate-100 md:text-5xl">
            Choose your{" "}
            <span className="gradient-text">research engine</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400">
            Cycles are the currency of GenX. Every live trading iteration consumes
            one. Pick the plan that matches your scale.
          </p>
          <div className="mt-6 flex justify-center">
            <BillingCycleToggle cycle={cycle} onChange={setCycle} />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center text-slate-500">Loading plans…</div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {plans.map((p) => (
              <PricingCard key={p.code} plan={p} cycle={cycle} />
            ))}
          </div>
        )}

        <p className="mt-8 text-center text-xs text-slate-500">
          All paid plans include a 7-day money-back guarantee. Prices in USD.
          Cancel anytime.
        </p>
      </div>
    </section>
  );
}