"use client";
import { Plan } from "@/lib/usePlans";

const STYLES: Record<string, string> = {
  free:  "bg-slate-700/40 text-slate-300 border-slate-600/50",
  pro:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  elite: "bg-amber-500/15 text-amber-300 border-amber-500/40",
};

export default function PlanBadge({ plan }: { plan?: Plan | null }) {
  const code = plan?.code ?? "free";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[code] ?? STYLES.free}`}>
      {plan?.name ?? "Free"}
    </span>
  );
}