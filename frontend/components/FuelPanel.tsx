"use client";

import { useState } from "react";
import { isAxiosError } from "axios";
import { AlertTriangle, CheckCircle2, Fuel, Loader2, Plus, RefreshCw, X, Zap } from "lucide-react";
import { PLAN_REFUEL_CODE, useFuel, type FuelActionResponse, type FuelPack } from "@/lib/useFuel";
import { formatCurrencyAmount } from "@/lib/formatCurrencyAmount";

export default function FuelPanel({
  planName,
  planAllowance,
  canRefuel,
  periodEnd,
  billingCycle,
  monthlyPrice,
  yearlyPrice,
  customRate,
}: {
  planName: string;
  planAllowance: number;
  canRefuel: boolean;
  periodEnd?: string | null;
  billingCycle?: "monthly" | "yearly";
  monthlyPrice: number;
  yearlyPrice: number;
  customRate?: boolean;
}) {
  const { balance, error, isLoading, unavailable, refresh, topUp, renewNow } = useFuel();
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"refuel" | "renew" | null>(null);
  const [message, setMessage] = useState<{
    kind: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const remaining = balance ? balance.plan_cycles + balance.purchased_cycles : null;
  const effectiveAllowance = balance?.plan_allowance ?? planAllowance;
  const ratePerCycle = customRate
    ? balance?.refuel_cycle_rate ?? null
    : effectiveAllowance > 0
      ? (billingCycle === "yearly" ? yearlyPrice : monthlyPrice) / effectiveAllowance
      : null;
  const planShare = balance && effectiveAllowance > 0
    ? Math.min(100, (balance.plan_cycles / effectiveAllowance) * 100)
    : 0;
  const low = remaining !== null && effectiveAllowance > 0 && remaining < effectiveAllowance * 0.1;
  const empty = remaining === 0;
  const canAct = !!balance && !isLoading && !unavailable;
  const renewalPrice = billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
  const getErrorText = (value: unknown) =>
    isAxiosError<{ detail?: string; message?: string }>(value)
      ? value.response?.data?.detail ?? value.response?.data?.message ?? value.message
      : value instanceof Error
        ? value.message
        : "Something went wrong. Please try again.";

  const quote = (pack: FuelPack) => {
    if (ratePerCycle === null || !Number.isFinite(ratePerCycle) || ratePerCycle <= 0) return null;
    const regularPrice = pack.cycles * ratePerCycle;
    return {
      regularPrice,
      discountedPrice: Math.round(regularPrice * 50) / 100,
    };
  };
  const refillPack: FuelPack = {
    code: PLAN_REFUEL_CODE,
    cycles: effectiveAllowance,
  };
  const refillPrices = quote(refillPack);
  const startCheckout = (result: FuelActionResponse) => {
    if (!result.checkout_url) {
      throw new Error("The payment service did not return a checkout link. Please try again.");
    }
    const checkoutUrl = new URL(result.checkout_url, window.location.origin);
    if (checkoutUrl.protocol !== "https:" && checkoutUrl.origin !== window.location.origin) {
      throw new Error("The payment service returned an invalid checkout link.");
    }
    window.location.assign(checkoutUrl.toString());
  };
  const confirmAction = async () => {
    if (!pendingAction || !canAct) return;
    const action = pendingAction;
    setBusy(action);
    setMessage(null);
    try {
      const result = action === "refuel"
        ? await topUp(refillPack)
        : await renewNow();

      if (result.status === "checkout_required") {
        startCheckout(result);
        return;
      }
      if (result.status === "pending") {
        setPendingAction(null);
        setMessage({
          kind: "info",
          text: result.message ?? "Payment is processing. Your fuel balance will update when it is confirmed.",
        });
        await refresh();
        return;
      }
      if (result.status !== "succeeded") {
        throw new Error("The payment service returned an unrecognized result. No cycles were added.");
      }

      await refresh();
      setPendingAction(null);
      setMessage({
        kind: "success",
        text: action === "refuel"
          ? `${effectiveAllowance.toLocaleString("en-US")} purchased cycles added.`
          : "Your plan renewal is complete.",
      });
    } catch (e: unknown) {
      setMessage({ kind: "error", text: getErrorText(e) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-[#111723] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
            <Fuel className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Fuel</div>
            <div className="flex items-baseline gap-2">
              <span className={`font-mono text-2xl font-semibold ${empty ? "text-rose-300" : low ? "text-amber-300" : "text-slate-100"}`}>
                {remaining === null ? "—" : remaining.toLocaleString("en-US")}
              </span>
              <span className="text-sm text-slate-500">cycles</span>
              {remaining !== null && <span className="text-xs text-slate-400">shared active engine time</span>}
            </div>
          </div>
        </div>
        {canRefuel && (
          <button
            type="button"
            disabled={!canAct || !!busy}
            onClick={() => {
              setMessage(null);
              setPendingAction("renew");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:border-slate-500 disabled:opacity-50"
          >
            {busy === "renew"
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />}
            Renew now
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-5 space-y-3" aria-label="Loading fuel balance">
          <div className="h-2 animate-pulse rounded-full bg-slate-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
        </div>
      ) : balance && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${low ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ width: `${planShare}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-400">
            <span>
              {planName} cycles: {balance.plan_cycles.toLocaleString("en-US")} / {effectiveAllowance.toLocaleString("en-US")}
              {periodEnd
                ? ` · ${billingCycle === "yearly" ? "valid through annual term" : "reset on renewal"}`
                : ""}
            </span>
            <span>Purchased: {balance.purchased_cycles.toLocaleString("en-US")} (never expire)</span>
          </div>
        </div>
      )}

      {(empty || low) && (
        <div className={`mt-4 rounded-lg border px-3 py-2 text-xs ${empty ? "border-rose-500/30 bg-rose-500/5 text-rose-300" : "border-amber-500/30 bg-amber-500/5 text-amber-300"}`}>
          {empty
            ? "Fuel is empty. New trades are stopped; existing positions remain open. Refuel or renew to resume."
            : "Your fuel is running low. Refuel now to avoid interrupting your live sessions."}
        </div>
      )}

      <div className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          <Zap className="h-3.5 w-3.5 text-amber-300" /> Refuel
        </div>
        {canRefuel && refillPrices && effectiveAllowance > 0 ? (
          <div className="max-w-sm">
            <button
              type="button"
              disabled={!canAct || !!busy}
              onClick={() => {
                setMessage(null);
                setPendingAction("refuel");
              }}
              className="group w-full rounded-lg border border-slate-800 bg-[#0B0F17] p-4 text-left transition hover:border-amber-500/50 disabled:opacity-50"
            >
              <div className="font-mono text-xl font-semibold text-slate-100">
                {effectiveAllowance.toLocaleString("en-US")} cycles
              </div>
              <div className="text-xs text-slate-500">Shared active engine time · same allowance as {planName}</div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-slate-500 line-through">${formatCurrencyAmount(refillPrices.regularPrice)}</span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">50% off plan price</span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-lg font-semibold text-amber-300">${formatCurrencyAmount(refillPrices.discountedPrice)}</span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400 group-hover:text-amber-200">
                  {busy === "refuel"
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Plus className="h-3.5 w-3.5" />}
                  {busy === "refuel" ? "Processing…" : "Refuel"}
                </span>
              </div>
            </button>
            <p className="mt-2 text-[10px] text-slate-500">
              This refuel adds the full cycle allowance for your current billing term. Purchased refuel cycles never expire.
            </p>
          </div>
        ) : canRefuel ? (
          <p className="text-sm text-slate-500">
            {unavailable
              ? "The refuel quote is unavailable until your fuel balance reconnects."
              : "Your contracted refuel rate is being loaded. Refueling will be available once the quote is confirmed."}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Refueling is available on paid plans. Upgrade to top up your cycles at any time.</p>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Fuel is shared across all accounts on your plan. Running accounts in parallel does not multiply consumption; cycles are used only while the engine is active. Annual plan fuel is credited upfront and is valid through the annual term. Purchased cycles never expire, are kept when you change plan, and are used after your plan fuel. Renewing early keeps your unused cycles.
        </p>
        {canRefuel && (
          <p className="mt-2 text-xs text-emerald-300/80">
            Every refuel is 50% off your plan&apos;s per-cycle rate, including future refuels.
          </p>
        )}
      </div>

      {message && (
        <div
          className={`mt-4 flex items-start gap-2 text-sm ${
            message.kind === "success"
              ? "text-emerald-300"
              : message.kind === "error"
                ? "text-rose-300"
                : "text-amber-300"
          }`}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.kind === "success"
            ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}
      {unavailable && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-300" role="alert">
          <span>
            Fuel balance could not be loaded: {getErrorText(error)}
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-rose-500/30 px-3 py-1 text-xs hover:bg-rose-500/10"
          >
            Retry
          </button>
        </div>
      )}
      {pendingAction && (
        <>
          <button
            type="button"
            aria-label="Close confirmation"
            className="fixed inset-0 z-40 cursor-default bg-black/70"
            onClick={() => !busy && setPendingAction(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fuel-action-title"
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-700 bg-[#111723] p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="fuel-action-title" className="text-lg font-semibold text-slate-100">
                  {pendingAction === "refuel" ? "Confirm refuel" : "Confirm plan renewal"}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {pendingAction === "refuel"
                    ? "This one-time purchase adds purchased cycles to your balance. They never expire."
                    : "This starts a new billing period today and adds the plan allowance. Existing plan and purchased cycles are preserved."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={!!busy}
                onClick={() => setPendingAction(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800 bg-[#0B0F17] p-4 text-sm">
              <div className="flex justify-between gap-3 text-slate-300">
                <span>Cycles</span>
                <span className="font-medium text-slate-100">
                  {effectiveAllowance.toLocaleString("en-US")} {pendingAction === "refuel" ? "purchased" : "plan"}
                </span>
              </div>
              <div className="flex justify-between gap-3 text-slate-300">
                <span>
                  {pendingAction === "refuel"
                    ? "One-time charge · 50% off"
                    : `Billed ${billingCycle === "yearly" ? "yearly" : "monthly"}`}
                </span>
                <span className="font-semibold text-slate-100">
                  ${formatCurrencyAmount(pendingAction === "refuel" ? refillPrices?.discountedPrice ?? 0 : renewalPrice)}
                </span>
              </div>
              {pendingAction === "refuel" && (
                <div className="text-right text-xs text-slate-500 line-through">
                  Regular price ${formatCurrencyAmount(refillPrices?.regularPrice ?? 0)}
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setPendingAction(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canAct || !!busy || (pendingAction === "refuel" && !refillPrices)}
                onClick={() => void confirmAction()}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Processing…" : pendingAction === "refuel" ? "Continue to payment" : "Confirm renewal"}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
