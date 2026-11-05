"use client";

import { Check, Sparkles, Building2, Star, Zap } from "lucide-react";
import { getPlanDescription, type Plan } from "@/lib/usePlans";
import { formatCurrencyAmount } from "@/lib/formatCurrencyAmount";
import { getPlanDisplay } from "./PricingSection";

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
        border: "border-sky-500/30",
        bg: "bg-gradient-to-b from-sky-500/[0.05] to-transparent",
        accent: "text-sky-300",
        button:
          "border border-sky-500/50 text-sky-200 hover:bg-sky-500/10",
        chip: null,
      };
    case "pro":
      return {
        border: "border-emerald-500/50",
        bg: "bg-gradient-to-b from-emerald-500/[0.07] to-transparent",
        accent: "text-emerald-300",
        button: "bg-emerald-500 text-slate-900 hover:bg-emerald-400",
        chip: { label: "Most popular", cls: "bg-emerald-500 text-slate-900", icon: Star },
      };
    case "firm":
      return {
        border: "border-amber-500/40",
        bg: "bg-gradient-to-b from-amber-500/[0.06] to-transparent",
        accent: "text-amber-300",
        button:
          "border border-amber-500/60 text-amber-200 hover:bg-amber-500/10",
        chip: { label: "For desks", cls: "bg-amber-500 text-slate-900", icon: Sparkles },
      };
    case "firm_xl":
      return {
        border: "border-violet-500/50",
        bg: "bg-gradient-to-b from-violet-500/[0.07] to-transparent",
        accent: "text-violet-300",
        button: "bg-violet-500 text-slate-900 hover:bg-violet-400",
        chip: {
          label: "For prop firms",
          cls: "bg-violet-500 text-slate-900",
          icon: Building2,
        },
      };
    default:
      return {
        border: "border-slate-800",
        bg: "bg-[#111723]",
        accent: "text-slate-300",
        button:
          "border border-slate-700 text-slate-200 hover:border-slate-600",
        chip: null,
      };
  }
}

export default function PlanCard({ plan, cycle, current, onChoose, busy }: Props) {
  const t = theme(plan.code);

  const isFree = plan.code === "trial" || plan.price_monthly === 0;
  const isEnterprise = plan.code === "firm_xl";
  const yearlyTotal = plan.price_yearly;
  const price = cycle === "yearly"
    ? Math.round(yearlyTotal / 12)
    : plan.price_monthly;
  const { cycleCount, featureList } = getPlanDisplay(plan, cycle);
  const buttonClass = current && !isEnterprise
    ? "cursor-default bg-slate-800 text-slate-500"
    : t.button;

  const ctaLabel = isEnterprise
    ? "Contact Sales"
    : current
      ? "Current plan"
      : isFree
        ? "Start trial"
        : "Choose Plan";

  return (
    <div
      className={`pricing-card pricing-card--${plan.code} relative flex h-full flex-col rounded-2xl border p-6 ${t.border} ${t.bg} ${
        plan.code === "pro"
          ? "pricing-card--featured shadow-[0_0_40px_-12px_rgba(16,185,129,0.45)]"
          : ""
      }`}
    >
      {/* top chip */}
      {t.chip && (
        <div
          className={`absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${t.chip.cls}`}
        >
          <t.chip.icon className="h-3 w-3" /> {t.chip.label}
        </div>
      )}

      {/* header */}
      <div>
        <div className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-wider ${t.accent}`}>
          {plan.name}
          {current && (
            <span className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-300">
              Current
            </span>
          )}
        </div>
        <div className="mt-1 min-h-[2.5rem] text-sm text-slate-400">
          {getPlanDescription(plan)}
        </div>
      </div>

      {/* price */}
      <div className="mt-4 min-h-[4.5rem]">
        {isEnterprise && (
          <div className="text-xs font-medium text-slate-500">From</div>
        )}
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-slate-100">
            {isFree ? "$0" : `$${formatCurrencyAmount(price)}`}
          </span>
          {!isFree && <span className="text-sm text-slate-500">/mo</span>}
          {isFree && (
            <span className="text-sm text-slate-500">
              {plan.trial_days ? `${plan.trial_days}-day trial` : "Free"}
            </span>
          )}
        </div>
        <div className="min-h-5 text-xs text-slate-500">
          {cycle === "yearly" && !isFree
            ? `$${formatCurrencyAmount(yearlyTotal)} billed yearly`
            : "\u00a0"}
        </div>
      </div>

      {/* cycles headline */}
      {cycleCount != null && (
        <div className="-mt-1 flex items-baseline gap-1.5 text-xs text-slate-500">
          <Zap className={`relative top-[2px] h-3.5 w-3.5 shrink-0 ${t.accent}`} />
          <span className={`font-semibold ${t.accent}`}>
            {cycleCount.toLocaleString()}
          </span>
          <span>cycles{isFree ? "" : " · shared engine time"}</span>
        </div>
      )}
      {cycleCount == null && <div aria-hidden="true" className="-mt-1 h-4" />}

      {/* divider */}
      <div className="my-5 h-px w-full bg-slate-800" />

      {/* features */}
      <ul className="flex-1 space-y-2.5">
        {featureList.map((f) => (
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
        className={`pricing-cta mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${buttonClass}`}
      >
        <span className="relative z-10">{busy ? "Processing…" : ctaLabel}</span>
      </button>
    </div>
  );
}