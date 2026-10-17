"use client";

import { Check, Sparkles, Building2, Star, Zap } from "lucide-react";
import type { Plan } from "@/lib/usePlans";

interface Props {
  plan: Plan;
  cycle: "monthly" | "yearly";
  current: boolean;
  onChoose: (code: string) => void;
  busy?: boolean;
}

interface Theme {
  border: string;
  bg: string;
  accent: string;
  button: string;
  chip: { label: string; cls: string; icon: any } | null;
}

function theme(code: string): Theme {
  switch (code) {
    case "trial":
      return {
        border: "border-slate-800",
        bg: "bg-[#0e1220]",
        accent: "text-slate-300",
        button: "border border-slate-700 text-slate-200 hover:border-slate-500",
        chip: null,
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
        chip: { label: "Most popular", cls: "bg-cyan-500 text-slate-900", icon: Star },
      };
    case "firm":
      return {
        border: "border-violet-500/40",
        bg: "bg-gradient-to-b from-violet-500/[0.06] to-transparent",
        accent: "text-violet-300",
        button:
          "border border-violet-500/60 text-violet-200 hover:bg-violet-500/10",
        chip: { label: "For desks", cls: "bg-violet-500 text-slate-900", icon: Sparkles },
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

export default function PlanCard({ plan, cycle, current, onChoose, busy }: Props) {
  const t = theme(plan.code);

  const price = cycle === "yearly" ? plan.price_yearly : plan.price_monthly;
  const suffix = cycle === "yearly" ? "/yr" : "/mo";
  const isFree = price === 0;
  const isEnterprise = plan.code === "firm_xl";

  const buttonClass = current
    ? "cursor-default bg-slate-800 text-slate-500"
    : t.button;

  const ctaLabel = current
    ? "Current plan"
    : isFree
    ? "Start trial"
    : isEnterprise
    ? "Contact sales"
    : "Choose plan";

  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-0.5 ${t.border} ${t.bg} ${
        plan.code === "pro"
          ? "shadow-[0_0_40px_-12px_rgba(6,182,212,0.45)] lg:scale-[1.03]"
          : ""
      }`}
    >
      {/* top chip */}
      {t.chip && !current && (
        <div
          className={`absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${t.chip.cls}`}
        >
          <t.chip.icon className="h-3 w-3" /> {t.chip.label}
        </div>
      )}
      {current && (
        <div className="absolute -top-3 right-6 inline-flex items-center rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          Current
        </div>
      )}

      {/* header */}
      <div>
        <div className={`text-sm font-semibold uppercase tracking-wider ${t.accent}`}>
          {plan.name}
        </div>
        <div className="mt-1 min-h-[2.5rem] text-sm text-slate-400">
          {plan.description}
        </div>
      </div>

      {/* price */}
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold text-slate-100">
          {isFree ? "$0" : `$${price.toLocaleString()}`}
        </span>
        {!isFree && <span className="text-sm text-slate-500">{suffix}</span>}
        {isFree && <span className="text-sm text-slate-500">forever</span>}
      </div>

      {/* cycles headline */}
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

      {/* divider */}
      <div className="my-5 h-px w-full bg-slate-800" />

      {/* features */}
      <ul className="flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
            <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 ${t.accent}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onChoose(plan.code)}
        disabled={current || busy}
        className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${buttonClass}`}
      >
        {busy ? "Processing…" : ctaLabel}
      </button>
    </div>
  );
}