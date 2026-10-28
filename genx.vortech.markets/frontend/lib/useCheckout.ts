"use client";
import { api } from "./api";

export interface CheckoutPayload {
  plan_code: string;
  billing_cycle: "monthly" | "yearly";
  // billing details (stubbed — real gateway will use these)
  card_number: string;
  card_expiry: string;
  card_cvc: string;
  card_name: string;
  email: string;
}

export interface CheckoutResult {
  ok: boolean;
  subscription_id?: number;
  error?: string;
}

export function validateCard(p: Partial<CheckoutPayload>) {
  const errors: Record<string, string> = {};

  if (!p.card_number || p.card_number.replace(/\s/g, "").length < 13) {
    errors.card_number = "Card number looks too short";
  }

  if (!p.card_expiry || !/^\d{2}\/\d{2}$/.test(p.card_expiry)) {
    errors.card_expiry = "Use MM/YY format";
  } else {
    const [mm, yy] = p.card_expiry.split("/").map((s) => parseInt(s, 10));
    if (mm < 1 || mm > 12) errors.card_expiry = "Invalid month";
    const now = new Date();
    const currentYY = now.getFullYear() % 100;
    const currentMM = now.getMonth() + 1;
    if (yy < currentYY || (yy === currentYY && mm < currentMM)) {
      errors.card_expiry = "Card is expired";
    }
  }

  if (!p.card_cvc || p.card_cvc.length < 3) {
    errors.card_cvc = "CVC must be at least 3 digits";
  }

  if (!p.card_name || p.card_name.trim().length < 2) {
    errors.card_name = "Name on card is required";
  }

  if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) {
    errors.email = "Enter a valid email";
  }

  return errors;
}

export async function submitCheckout(
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  const errors = validateCard(payload);
  if (Object.keys(errors).length > 0) {
    return { ok: false, error: "Please fix the highlighted fields" };
  }

  try {
    // Billing is stubbed — this simply calls /change.
    // When you wire Stripe/Paystack, replace with a real payment intent +
    // confirm flow before calling /change.
    const r = await api.post("/api/subscriptions/change", {
      plan_code: payload.plan_code,
      billing_cycle: payload.billing_cycle,
    });
    return { ok: true, subscription_id: r.data?.id };
  } catch (e: any) {
    return {
      ok: false,
      error: e?.response?.data?.detail ?? "Checkout failed",
    };
  }
}