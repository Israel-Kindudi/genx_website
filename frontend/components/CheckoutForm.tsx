"use client";

import { useMemo, useState } from "react";
import { CreditCard, Smartphone, Lock, AlertTriangle, Eye, EyeOff, ChevronDown } from "lucide-react";
import {
  CheckoutPayload,
  PaymentMethod,
  validateCheckout,
  validateCard,
  validateExpiry,
  submitCheckout,
} from "@/lib/useCheckout";
import { COUNTRIES, MOBILE_MONEY_COUNTRIES, MOBILE_MONEY_PROVIDERS, findCountry } from "@/lib/countries";

interface Props {
  planCode: string;
  cycle: "monthly" | "yearly";
  email: string;
  onSuccess: () => void;
}

const MOBILE_PROVIDER_LABELS: Record<string, string> = {
  MPESA: "M-Pesa",
  AIRTEL: "Airtel Money",
  ORANGE: "Orange Money",
  MTN: "MTN MoMo",
  AFRIMONEY: "Afrimoney",
};

const MAX_E164_DIGITS = 15;

function groupDigits(value: string, size: number) {
  return value.match(new RegExp(`.{1,${size}}`, "g"))?.join(" ") ?? "";
}

function formatCardNumber(raw: string) {
  const amex = /^3[47]/.test(raw);
  const digits = raw.slice(0, amex ? 15 : 19);
  const sizes = amex ? [4, 6, 5] : [4, 4, 4, 4, 3];
  const groups: string[] = [];
  let offset = 0;
  for (const size of sizes) {
    if (offset < digits.length) {
      groups.push(digits.slice(offset, offset + size));
      offset += size;
    }
  }
  return groups.join(" ");
}

function formatExpiry(raw: string) {
  const digits = raw.slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function formatCardName(value: string) {
  return value
    .replace(/[^\p{L}\p{M}\s.'’-]/gu, "")
    .replace(/(^|\s)\p{L}/gu, (l) => l.toUpperCase());
}

export default function CheckoutForm({ planCode, cycle, email, onSuccess }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [countryCode, setCountryCode] = useState("CD");
  const [nationalNumber, setNationalNumber] = useState("");
  const [momoProvider, setMomoProvider] = useState("MPESA");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [showCvc, setShowCvc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);

  const country = useMemo(() => findCountry(countryCode), [countryCode]);
  const dialCode = country?.dialCode ?? "";
  const maxNational = MAX_E164_DIGITS - dialCode.length;
  const providers = MOBILE_MONEY_PROVIDERS[countryCode] ?? [];
  const activeProvider = providers.includes(momoProvider) ? momoProvider : providers[0] ?? "";

  const selectMethod = (next: PaymentMethod) => {
    // Mobile Money only exists in some countries; fall back to the default supported one.
    if (next === "mobile_money" && !MOBILE_MONEY_PROVIDERS[countryCode]) {
      setCountryCode("CD");
      setNationalNumber("");
    }
    setMethod(next);
  };

  const handlePhoneChange = (value: string) => {
    let digits = value.replace(/\D/g, "");
    // Pasted full international numbers: drop the calling code already shown in the prefix.
    if (dialCode && digits.startsWith(dialCode) && digits.length > maxNational) {
      digits = digits.slice(dialCode.length);
    }
    if (digits.length > 1 && digits.startsWith("0")) digits = digits.slice(1);
    setNationalNumber(digits.slice(0, maxNational));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGlobalError(null);

    const payload: CheckoutPayload = {
      plan_code: planCode,
      billing_cycle: cycle,
      payment_method: method,
      provider: method === "card" ? "stripe" : "flutterwave",
      email,
      ...(method === "card" && { country_code: countryCode }),
      ...(method === "mobile_money" && {
        phone_number: nationalNumber ? `+${dialCode}${nationalNumber}` : "",
        country_code: countryCode,
        dial_code: dialCode,
        mobile_money_provider: activeProvider,
      }),
    };

    const v = validateCheckout(payload);
    if (method === "card") {
      Object.assign(v, validateCard({ name: cardName, number: cardNumber, expiry: cardExpiry, cvc: cardCvc }));
    }
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }

    setBusy(true);
    const res = await submitCheckout(payload);
    setBusy(false);

    if (!res.ok) {
      setGlobalError(res.error ?? "Checkout failed");
      return;
    }

    if (res.checkout_url) {
      window.location.href = res.checkout_url;
    } else {
      onSuccess();
    }
  };

  const methodClass = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium transition ${
      active
        ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
        : "border-slate-700 bg-[#0B0F17] text-slate-400 hover:border-slate-600"
    }`;

  const countryField = (label: string) => (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">{label}</label>
      <SelectShell flagCode={countryCode}>
        <select
          value={countryCode}
          onChange={(e) => {
            setCountryCode(e.target.value);
            setNationalNumber("");
          }}
          autoComplete="country"
          className={`${SELECT_CLASS} !pl-11 ${errors.country_code ? "!border-red-500/60" : ""}`}
        >
          {(method === "mobile_money" ? MOBILE_MONEY_COUNTRIES : COUNTRIES).map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}{method === "mobile_money" ? ` (+${c.dialCode})` : ""}
            </option>
          ))}
        </select>
      </SelectShell>
      {errors.country_code && <div className="mt-1 text-xs text-red-400">{errors.country_code}</div>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Choose a payment method">
        <button
          type="button"
          aria-pressed={method === "card"}
          onClick={() => selectMethod("card")}
          className={methodClass(method === "card")}
        >
          <CreditCard className="h-4 w-4" /> Card
        </button>
        <button
          type="button"
          aria-pressed={method === "mobile_money"}
          onClick={() => selectMethod("mobile_money")}
          className={methodClass(method === "mobile_money")}
        >
          <Smartphone className="h-4 w-4" /> Mobile Money
        </button>
      </div>

      {method === "card" ? (
        <div className="space-y-4">
          <Field
            label="Name on card"
            value={cardName}
            onChange={(v) => setCardName(formatCardName(v))}
            placeholder="Jane Doe"
            autoComplete="cc-name"
            error={errors.card_name}
          />
          <Field
            label="Card number"
            value={cardNumber}
            onChange={(v) => setCardNumber(formatCardNumber(v.replace(/\D/g, "")))}
            placeholder="1234 5678 9012 3456"
            inputMode="numeric"
            autoComplete="cc-number"
            error={errors.card_number}
            trailing={<CreditCard className="h-4 w-4 text-slate-500" />}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Expiry date"
              value={cardExpiry}
              onChange={(v) => setCardExpiry(formatExpiry(v.replace(/\D/g, "")))}
              placeholder="MM/YY"
              inputMode="numeric"
              autoComplete="cc-exp"
              error={validateExpiry(cardExpiry, true) ?? (cardExpiry ? undefined : errors.card_expiry)}
              valid={cardExpiry.length === 5 && !validateExpiry(cardExpiry)}
            />
            <Field
              label="Security code"
              value={cardCvc}
              onChange={(v) => setCardCvc(v.replace(/\D/g, "").slice(0, 4))}
              placeholder="•••"
              type={showCvc ? "text" : "password"}
              inputMode="numeric"
              autoComplete="cc-csc"
              error={errors.card_cvc}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowCvc((s) => !s)}
                  aria-label={showCvc ? "Hide security code" : "Show security code"}
                  aria-pressed={showCvc}
                  className="mr-1 flex h-5 w-5 shrink-0 items-center justify-center text-slate-500 transition hover:text-slate-300"
                >
                  {showCvc ? <EyeOff className="h-4 w-4 shrink-0" /> : <Eye className="h-4 w-4 shrink-0" />}
                </button>
              }
            />
          </div>
          {countryField("Billing country")}
          <p className="text-xs text-slate-500">
            Card details are checked in your browser only and are never sent to our servers.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {countryField("Country")}

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
              Mobile Money provider
            </label>
            <SelectShell>
              <select
                value={activeProvider}
                onChange={(e) => setMomoProvider(e.target.value)}
                className={SELECT_CLASS}
              >
                {providers.map((code) => (
                  <option key={code} value={code}>
                    {MOBILE_PROVIDER_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
            </SelectShell>
          </div>

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">
              Mobile Money number
            </label>
            <div
              className={`flex h-[42px] items-stretch overflow-hidden rounded-lg border bg-[#0B0F17] transition ${
                errors.phone_number ? "border-red-500/60" : "border-slate-700 focus-within:border-emerald-500"
              }`}
            >
              <span
                className="flex h-full shrink-0 items-center gap-1.5 border-r border-slate-700 px-3 text-sm leading-none text-slate-300"
                aria-label={`${country?.name ?? ""} calling code plus ${dialCode}`}
              >
                <span aria-hidden="true" className="flex items-center"><Flag code={countryCode} /></span>
                <span className="leading-none">+{dialCode}</span>
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                value={groupDigits(nationalNumber, 3)}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="812 345 678"
                className="w-full min-w-0 bg-transparent px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
              />
            </div>
            {errors.phone_number && <div className="mt-1 text-xs text-red-400">{errors.phone_number}</div>}
          </div>

          <p className="text-xs text-slate-500">
            You will receive a prompt on your phone to authorize the payment.
          </p>
        </div>
      )}

      {errors.email && (
        <div className="text-xs text-red-400">{errors.email}</div>
      )}

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
        {busy ? "Processing…" : <><Lock className="h-4 w-4" /> {method === "card" ? "Pay by card" : "Continue to payment"}</>}
      </button>

      <p className="text-center text-xs text-slate-500">
        Secured by Stripe & Flutterwave. No card details are stored on our servers.
      </p>
    </form>
  );
}

const SELECT_CLASS =
  "h-[42px] w-full cursor-pointer appearance-none rounded-lg border border-slate-700 bg-[#0B0F17] pl-3 pr-10 text-sm leading-none text-slate-100 focus:border-emerald-500 focus:outline-none";

// Windows has no flag emoji, so flags are loaded as images; falls back to the ISO code if the image fails.
function Flag({ code }: { code: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (failed === code) {
    return <span className="text-[10px] font-semibold leading-none text-slate-400">{code}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w80/${code.toLowerCase()}.png 2x`}
      width={20}
      height={15}
      alt=""
      aria-hidden="true"
      onError={() => setFailed(code)}
      className="block h-[15px] w-5 rounded-[2px] object-cover"
    />
  );
}

// Custom chevron so it sits further from the edge than the native arrow; optional flag on the left.
function SelectShell({ children, flagCode }: { children: React.ReactNode; flagCode?: string }) {
  return (
    <div className="relative">
      {flagCode && (
        <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">
          <Flag code={flagCode} />
        </span>
      )}
      {children}
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function Field({
  label, value, onChange, error, valid, placeholder, type = "text", inputMode, autoComplete, trailing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  valid?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "numeric" | "email" | "tel";
  autoComplete?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs uppercase tracking-wide text-slate-500">{label}</label>
      <div className={`flex items-center gap-2 rounded-lg border bg-[#0B0F17] px-3 py-2.5 transition ${error ? "border-red-500/60" : valid ? "border-emerald-500/60" : "border-slate-700 focus-within:border-emerald-500"}`}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          className="w-full min-w-0 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
        />
        {trailing}
      </div>
      {error && <div className="mt-1 text-xs text-red-400">{error}</div>}
    </div>
  );
}
