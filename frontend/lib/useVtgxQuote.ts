"use client";

import { useEffect, useState } from "react";
import { createMarketDataProvider } from "@/lib/marketDataProviderFactory";
import type { MarketChange } from "@/lib/vtgxDatafeed";

// Same provider as the dashboard VTGX chart: until the listing venue is wired
// in realProvider, price is null and the UI shows "pre-launch".
export function useVtgxQuote(mock = false) {
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<MarketChange | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    setPrice(null);
    setChange(null);
    setReady(false);

    createMarketDataProvider(mock ? "mock" : "real")
      .then((provider) => {
        if (!mounted) return;
        const refresh = () => {
          Promise.all([provider.getLastPrice(), provider.get24hChange()])
            .then(([p, c]) => {
              if (!mounted) return;
              setPrice(p);
              setChange(c);
              setReady(true);
            })
            .catch(() => {
              if (mounted) setReady(true);
            });
        };
        refresh();
        // Throttled: a bar update triggers at most one refresh every 5 s.
        unsubscribe = provider.subscribeBars("1m", () => {
          if (refreshTimer) return;
          refreshTimer = setTimeout(() => {
            refreshTimer = undefined;
            refresh();
          }, 5000);
        });
      })
      .catch(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [mock]);

  return { price, change, ready, preLaunch: ready && price === null };
}
