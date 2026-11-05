import { api } from "./api";

export type PaymentMethod = "card" | "mobile_money";

export interface CheckoutPayload {
  plan_code: string;
  billing_cycle: "monthly" | "yearly";
  payment_method: PaymentMethod;
  provider: "stripe" | "flutterwave";
  email: string;
  phone_number?: string; // E.164, e.g. +243812345678
  country_code?: string; // ISO 3166-1 alpha-2
  dial_code?: string; // calling code digits, e.g. 243
  mobile_money_provider?: string;
}

export interface CardDetails {
  name: string;
  number: string;
  expiry: string;
  cvc: string;
}

export function validateExpiry(expiry: string, partial = false): string | null {
  const exp = expiry.replace(/\D/g, "");
  if (exp.length >= 2) {
    const month = Number(exp.slice(0, 2));
    if (month < 1 || month > 12) return "Invalid month";
  }
  if (exp.length !== 4) return partial ? null : "Use MM/YY";
  const month = Number(exp.slice(0, 2));
  const year = 2000 + Number(exp.slice(2));
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return "Card expired";
  if (year > now.getFullYear() + 20) return "Invalid year";
  return null;
}

// Card details are validated in the browser only and never added to the checkout payload.
export function validateCard(card: CardDetails): Record<string, string> {
  const errors: Record<string, string> = {};
  const digits = card.number.replace(/\D/g, "");
  const amex = /^3[47]/.test(digits);

  if (!card.name.trim()) errors.card_name = "Name on card required";

  if (!digits) {
    errors.card_number = "Card number required";
  } else if (
    (amex ? digits.length !== 15 : digits.length < 12 || digits.length > 19) ||
    !passesLuhn(digits)
  ) {
    errors.card_number = "Invalid card number";
  }

  const expiryError = validateExpiry(card.expiry);
  if (expiryError) errors.card_expiry = expiryError;

  const cvc = card.cvc.replace(/\D/g, "");
  if (cvc.length !== (amex ? 4 : 3)) errors.card_cvc = amex ? "4 digits" : "3 digits";

  return errors;
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export interface CheckoutResult {
  ok: boolean;
  error?: string;
  checkout_url?: string;
}

export async function submitCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  try {
    const res = await api.post("/api/payments/checkout", payload);
    return { ok: true, checkout_url: res.data.checkout_url };
  } catch (err: any) {
    return {
      ok: false,
      error: err.response?.data?.detail || err.message || "Checkout failed",
    };
  }
}

export function validateCheckout(payload: CheckoutPayload): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    errors.email = "Valid email required";
  }

  if (payload.payment_method === "card" && !payload.country_code) {
    errors.country_code = "Billing country required";
  }

  if (payload.payment_method === "mobile_money") {
    if (!payload.country_code) {
      errors.country_code = "Country required";
    }
    if (!payload.phone_number) {
      errors.phone_number = "Phone number required";
    } else if (!/^\+\d{8,15}$/.test(payload.phone_number)) {
      errors.phone_number = "Invalid phone number";
    }
  }

  return errors;
}