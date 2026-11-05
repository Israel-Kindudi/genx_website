"use client";
import useSWR from "swr";
import { api } from "./api";

// One cycle = 45 seconds of active engine runtime, shared across all connected accounts.
export const SECONDS_PER_CYCLE = 45;

export interface FuelPack {
  code: string;
  cycles: number;
}

// The backend derives the refill quantity and charge from the user's active plan.
export const PLAN_REFUEL_CODE = "plan_refuel";

export interface FuelBalance {
  // Cycles granted by the subscription for the current period (reset on renewal).
  plan_cycles: number;
  // Cycles bought as top-ups (never expire, no cap).
  purchased_cycles: number;
  // Cycles the plan grants per period.
  plan_allowance: number;
  // Optional undiscounted subscription rate. Required for custom-negotiated plans.
  refuel_cycle_rate?: number;
}

export interface FuelActionResponse {
  status: "succeeded" | "pending" | "checkout_required";
  checkout_url?: string;
  message?: string;
}

const fetcher = (url: string) => api.get(url).then((r) => r.data as FuelBalance);

export function useFuel() {
  const { data, error, isLoading, mutate } = useSWR<FuelBalance>("/api/fuel/me", fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const topUp = async (pack: FuelPack) => {
    const response = await api.post<FuelActionResponse>("/api/fuel/topup", {
      pack_code: pack.code,
    });
    return response.data;
  };

  const renewNow = async () => {
    const response = await api.post<FuelActionResponse>("/api/subscriptions/renew");
    return response.data;
  };

  return {
    balance: data ?? null,
    error,
    isLoading,
    unavailable: !!error,
    refresh: mutate,
    topUp,
    renewNow,
  };
}
