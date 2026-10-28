"use client";

import { useState } from "react";
import { CreditCard, Lock, AlertTriangle } from "lucide-react";
import {
  CheckoutPayload,
  validateCard,
  submitCheckout,
} from "@/lib/useCheckout";

interface Props {
  planCode: string;
  cycle: "monthly" | "yearly";
  email: string;
  onSuccess: () => void;
}

export default function CheckoutForm({
  planCode,
  cycle,
  email,
  onSuccess,
}: Props) {
  const [form, setForm] = useState<CheckoutPayload>({
    plan_code: planCode,
    billing_cycle: cycle,
    card_number: "",
    card_expiry: "",
    card_cvc: "",
    card_name: "",
    email,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const set = (k: keyof CheckoutPayload, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setGlobalError(null);
  };

  const formatCard = (v: string) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();

  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    if (d.length <= 2) return d;
    return `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateCard(form);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setBusy(true);
    const res = await submitCheckout(form);
    setBusy(false);
    if (!res.ok) {
      setGlobalError(res.error ?? "Checkout failed");
      return;
    }
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* email */}
      <Field
        label="Email"
        value={form.email}
        onChange={(v) => set("email", v)}
        error={errors.email}
        placeholder="you@example.com"
        type="email"
      />

      {/* card number */}
      <Field
        label="Card number"
        value={form.card_number}
        onChange={(v) => set("card_number", formatCard(v))}
        error={errors.card_number}
        placeholder="4242 4242 4242 4242"
        icon={<CreditCard className="h-4 w-4 text-slate-500" />}
        inputMode="numeric"
      />

      {/* expiry + cvc */}
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Expiry"
          value={form.card_expiry}
          onChange={(v) => set("card_expiry", formatExpiry(v))}
          error={errors.card_expiry}
          placeholder="MM/YY"
          inputMode="numeric"
        />
        <Field
          label="CVC"
          value={form.card_cvc}
          onChange={(v) => set("card_cvc", v.replace(/\D/g, "").slice(0, 4))}
          error={errors.card_cvc}
          placeholder="123"
          inputMode="numeric"
        />
      </div>

      {/* name */}
      <Field
        label="Name on card"
        value={form.card_name}
        onChange={(v) => set("card_name", v)}
        error={errors.card_name}
        placeholder="Jane Trader"
      />

      {globalError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <AlertTriangle className="h-4 w-4" /> {globalError}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60"
      >
        {busy ? (
          "Processing…"
        ) : (
          <>
            <Lock className="h-4 w-4" /> Confirm & pay
          </>
        )}
      </button>

      <p className="text-center text-xs text-slate-500">
        Billing is stubbed — no real charge occurs. Stripe/Paystack coming soon.
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  icon,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  inputMode?: "text" | "numeric" | "email";
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <div
        className={`flex items-center gap-2 rounded-lg border bg-[#0B0F17] px-3 py-2.5 transition ${
          error
            ? "border-red-500/60"
            : "border-slate-700 focus-within:border-emerald-500"
        }`}
      >
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
      </div>
      {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
    </div>
  );
}