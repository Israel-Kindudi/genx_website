"use client";

import { useRouter } from "next/navigation";

export const SALES_WHATSAPP_URL = "https://wa.me/243832082287";

export function openSalesWhatsApp() {
  window.open(SALES_WHATSAPP_URL, "_blank", "noopener,noreferrer");
}

export function usePlanRedirect() {
  const router = useRouter();

  const handlePlanSelect = (planCode: string, cycle: "monthly" | "yearly" = "monthly") => {
    // The Starter trial is provisioned as the free trial account after sign-up.
    if (planCode === "trial") {
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("genx_token") || sessionStorage.getItem("genx_token")
          : null;
      router.push(token ? "/dashboard" : "/register");
      return;
    }
    if (planCode === "firm_xl") {
      openSalesWhatsApp();
      return;
    }

    // 2. Check if the user is logged in
    const token = 
      typeof window !== "undefined" 
        ? localStorage.getItem("genx_token") || sessionStorage.getItem("genx_token")
        : null;

    if (token) {
      // Logged in: go straight to checkout
      router.push(`/checkout/${planCode}?cycle=${cycle}`);
    } else {
      // Not logged in: save intent, then go to login
      localStorage.setItem("pending_plan", planCode);
      localStorage.setItem("pending_cycle", cycle);
      router.push("/login?redirect=checkout");
    }
  };

  return { handlePlanSelect };
}