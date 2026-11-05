"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useMasterEquity } from "@/lib/useMasterEquity";

type MasterEquityState = ReturnType<typeof useMasterEquity>;

const MasterEquityContext = createContext<MasterEquityState | null>(null);

// One connection shared by the hero readout and the equity card, so the
// LIVE indicators stay perfectly in sync.
export function MasterEquityProvider({ children }: { children: ReactNode }) {
  const state = useMasterEquity();
  return <MasterEquityContext.Provider value={state}>{children}</MasterEquityContext.Provider>;
}

export function useSharedMasterEquity(): MasterEquityState {
  const ctx = useContext(MasterEquityContext);
  if (!ctx) throw new Error("useSharedMasterEquity must be used within MasterEquityProvider");
  return ctx;
}
