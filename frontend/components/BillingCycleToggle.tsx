"use client";

interface Props {
  cycle: "monthly" | "yearly";
  onChange: (c: "monthly" | "yearly") => void;
}

export default function BillingCycleToggle({ cycle, onChange }: Props) {
  return (
    <div className="inline-flex items-center rounded-full border border-slate-700 bg-[#0a0d14] p-1">
      <button
        onClick={() => onChange("monthly")}
        className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
          cycle === "monthly"
            ? "bg-cyan-500 text-slate-900"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Monthly
      </button>
      <button
        onClick={() => onChange("yearly")}
        className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
          cycle === "yearly"
            ? "bg-cyan-500 text-slate-900"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Yearly
        <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
          −17%
        </span>
      </button>
    </div>
  );
}