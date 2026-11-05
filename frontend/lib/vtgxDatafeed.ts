import type { UTCTimestamp } from "lightweight-charts";

export type VtgxTimeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1H"
  | "4H"
  | "8H"
  | "12H"
  | "1D"
  | "1W"
  | "1M"
  | "ALL";

export const ALL_TIMEFRAMES: VtgxTimeframe[] = [
  "1m", "3m", "5m", "15m", "30m", "1H", "4H", "8H", "12H", "1D", "1W", "1M", "ALL",
];

export type VtgxBar = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  trades?: number;
  isComplete?: boolean;
};

export type MarketChange = {
  value: number;
  percent: number;
};

export type Market24hStats = {
  high: number;
  low: number;
  volume: number;
  quoteVolume: number;
};

export interface MarketDataProvider {
  get24hStats(): Promise<Market24hStats | null>;
  getBars(
    timeframe: VtgxTimeframe,
    from: UTCTimestamp,
    to: UTCTimestamp
  ): Promise<VtgxBar[]>;
  subscribeBars(
    timeframe: VtgxTimeframe,
    callback: (bar: VtgxBar) => void
  ): () => void;
  getLastPrice(): Promise<number | null>;
  get24hChange(): Promise<MarketChange | null>;
}

export interface MinuteMarketSource {
  getBars(from: UTCTimestamp, to: UTCTimestamp): Promise<VtgxBar[]>;
  subscribeBars(callback: (bar: VtgxBar) => void): () => void;
}

export interface TimeframeMarketSource {
  getBars(
    timeframe: VtgxTimeframe,
    from: UTCTimestamp,
    to: UTCTimestamp
  ): Promise<VtgxBar[]>;
  subscribeBars(
    timeframe: VtgxTimeframe,
    callback: (bar: VtgxBar) => void
  ): () => void;
}

export type MarketSource =
  | { mode: "minute-only"; source: MinuteMarketSource }
  | { mode: "timeframe-bars"; source: TimeframeMarketSource };

// Nominal length; 1M is calendar-based, use timeframeEnd for exact bucket bounds.
// ALL shows the whole history in daily bars.
export const TIMEFRAME_SECONDS: Record<VtgxTimeframe, number> = {
  "1m": 60,
  "3m": 3 * 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "30m": 30 * 60,
  "1H": 60 * 60,
  "4H": 4 * 60 * 60,
  "8H": 8 * 60 * 60,
  "12H": 12 * 60 * 60,
  "1D": 24 * 60 * 60,
  "1W": 7 * 24 * 60 * 60,
  "1M": 30 * 24 * 60 * 60,
  ALL: 24 * 60 * 60,
};

const DAY_SECONDS = 24 * 60 * 60;

export function isIntradayTimeframe(timeframe: VtgxTimeframe) {
  return TIMEFRAME_SECONDS[timeframe] < DAY_SECONDS;
}

// Buckets are UTC: weeks start on Monday, months on the 1st.
export function alignUtcTime(time: number, timeframe: VtgxTimeframe) {
  if (timeframe === "1M") {
    const date = new Date(time * 1000);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000;
  }
  if (timeframe === "1W") {
    const offset = 3 * DAY_SECONDS; // 1970-01-01 is a Thursday
    const interval = TIMEFRAME_SECONDS["1W"];
    return Math.floor((time + offset) / interval) * interval - offset;
  }
  const interval = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(time / interval) * interval;
}

// First second after the bucket that starts at `start`.
export function timeframeEnd(start: number, timeframe: VtgxTimeframe) {
  if (timeframe === "1M") {
    const date = new Date(start * 1000);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000;
  }
  return start + TIMEFRAME_SECONDS[timeframe];
}

export function aggregateVtgxBars(
  minuteBars: VtgxBar[],
  timeframe: VtgxTimeframe,
  nowSeconds = Math.floor(Date.now() / 1000)
): VtgxBar[] {
  const buckets = new Map<number, VtgxBar>();
  const orderedBars = normalizeMinuteBars(minuteBars);

  for (const bar of orderedBars) {
    const time = alignUtcTime(Number(bar.time), timeframe);
    const existing = buckets.get(time);
    if (!existing) {
      buckets.set(time, {
        ...bar,
        time: time as UTCTimestamp,
        isComplete: timeframeEnd(time, timeframe) <= nowSeconds,
      });
    } else {
      existing.high = Math.max(existing.high, bar.high);
      existing.low = Math.min(existing.low, bar.low);
      existing.close = bar.close;
      existing.isComplete = timeframeEnd(time, timeframe) <= nowSeconds;
      if (existing.volume !== undefined && bar.volume !== undefined) {
        existing.volume += bar.volume;
      } else {
        existing.volume = undefined;
      }
      if (existing.trades !== undefined && bar.trades !== undefined) {
        existing.trades += bar.trades;
      } else {
        existing.trades = undefined;
      }
    }
  }

  return Array.from(buckets.values());
}

export function normalizeMinuteBars(bars: VtgxBar[]) {
  const sorted = [...bars].sort((a, b) => Number(a.time) - Number(b.time));
  const barsByTime = new Map<number, VtgxBar>();
  for (const bar of sorted) barsByTime.set(Number(bar.time), bar);
  const ordered = Array.from(barsByTime.values());
  let previous: VtgxBar | undefined;

  return ordered.map((sourceBar) => {
    let bar = sourceBar;
    if (previous && Number(sourceBar.time) > Number(previous.time)) {
      const open = previous.close;
      bar = {
        ...sourceBar,
        open,
        high: Math.max(sourceBar.high, open),
        low: Math.min(sourceBar.low, open),
      };
    }
    previous = bar;
    return bar;
  });
}

export function createMarketDataProvider(
  marketSource: MarketSource
): MarketDataProvider {
  const recentMinuteBars = new Map<number, VtgxBar>();
  const recentBarsByTimeframe = new Map<VtgxTimeframe, Map<number, VtgxBar>>();

  function remember(timeframe: VtgxTimeframe, bars: VtgxBar[]) {
    let cache = recentBarsByTimeframe.get(timeframe);
    if (!cache) {
      cache = new Map();
      recentBarsByTimeframe.set(timeframe, cache);
    }
    for (const bar of bars) cache.set(Number(bar.time), bar);
  }

  function orderedCache(timeframe: VtgxTimeframe) {
    return Array.from(recentBarsByTimeframe.get(timeframe)?.values() ?? [])
      .sort((a, b) => Number(a.time) - Number(b.time));
  }

  let latestMinute: VtgxBar | null = null;

  function trackLatestMinute(bar: VtgxBar | undefined) {
    if (bar && (!latestMinute || Number(bar.time) >= Number(latestMinute.time))) {
      latestMinute = bar;
    }
  }

  function getBars(
    timeframe: VtgxTimeframe,
    from: UTCTimestamp,
    to: UTCTimestamp
  ) {
    if (marketSource.mode === "timeframe-bars") {
      return marketSource.source.getBars(timeframe, from, to).then((bars) => {
        const normalized = normalizeTimeframeBars(bars, timeframe);
        remember(timeframe, normalized);
        return normalized;
      });
    }

    // Start at the bucket boundary so the first aggregated bar is complete.
    const alignedFrom = alignUtcTime(Number(from), timeframe) as UTCTimestamp;
    return marketSource.source.getBars(alignedFrom, to).then((bars) => {
      const minutes = normalizeMinuteBars(bars);
      for (const bar of minutes) recentMinuteBars.set(Number(bar.time), bar);
      trackLatestMinute(minutes.at(-1));
      const aggregated = aggregateVtgxBars(minutes, timeframe);
      remember(timeframe, aggregated);
      return aggregated.filter(
        (bar) => Number(bar.time) <= Number(to) &&
          timeframeEnd(Number(bar.time), timeframe) > Number(from)
      );
    });
  }

  function subscribeBars(
    timeframe: VtgxTimeframe,
    callback: (bar: VtgxBar) => void
  ) {
    if (marketSource.mode === "timeframe-bars") {
      return marketSource.source.subscribeBars(timeframe, (bar) => {
        const [normalized] = normalizeTimeframeBars([bar], timeframe);
        if (!normalized) return;
        remember(timeframe, [normalized]);
        callback(normalized);
      });
    }

    return marketSource.source.subscribeBars((sourceBar) => {
      const sourceTime = Number(sourceBar.time);
      const previousBar =
        recentMinuteBars.get(sourceTime - 60) ??
        (latestMinute && Number(latestMinute.time) < sourceTime ? latestMinute : undefined);
      const [bar] = normalizeMinuteBars(
        previousBar ? [previousBar, sourceBar] : [sourceBar]
      ).slice(-1);
      recentMinuteBars.set(Number(bar.time), bar);
      trackLatestMinute(bar);
      const bucketStart = alignUtcTime(Number(bar.time), timeframe);
      const currentMinutes: VtgxBar[] = [];
      for (let time = bucketStart; time <= Number(bar.time); time += 60) {
        const minute = recentMinuteBars.get(time);
        if (minute) currentMinutes.push(minute);
      }
      const [aggregated] = aggregateVtgxBars(currentMinutes, timeframe);
      if (!aggregated) return;
      remember(timeframe, [aggregated]);
      callback(aggregated);
    });
  }

  return {
    getBars,
    subscribeBars,
    async getLastPrice() {
      const end = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const start = (Number(end) - 24 * 60 * 60) as UTCTimestamp;
      await getBars("1m", start, end);
      return latestMinute?.close ?? null;
    },
    async get24hStats() {
      const end = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const start = (Number(end) - 24 * 60 * 60) as UTCTimestamp;
      const bars = await getBars("1m", start, end);
      if (bars.length === 0) return null;
      let high = -Infinity;
      let low = Infinity;
      let volume = 0;
      let quoteVolume = 0;
      for (const bar of bars) {
        high = Math.max(high, bar.high);
        low = Math.min(low, bar.low);
        const barVolume = bar.volume ?? 0;
        volume += barVolume;
        quoteVolume += barVolume * ((bar.open + bar.high + bar.low + bar.close) / 4);
      }
      return { high, low, volume, quoteVolume };
    },
    async get24hChange() {
      const end = Math.floor(Date.now() / 1000) as UTCTimestamp;
      const start = (Number(end) - 25 * 60 * 60) as UTCTimestamp;
      const bars = await getBars("1H", start, end);
      const ordered = [...bars].sort((a, b) => Number(a.time) - Number(b.time));
      const last = ordered.at(-1);
      if (!last) return null;
      const targetTime = Number(last.time) - 24 * 60 * 60;
      const reference = [...ordered]
        .reverse()
        .find((bar) => Number(bar.time) <= targetTime);
      if (!reference || reference.close === 0) return null;
      const value = last.close - reference.close;
      return { value, percent: (value / reference.close) * 100 };
    },
  };
}

function normalizeTimeframeBars(
  bars: VtgxBar[],
  timeframe: VtgxTimeframe
): VtgxBar[] {
  const ordered = [...bars].sort((a, b) => Number(a.time) - Number(b.time));
  return ordered.map((bar) => {
    const time = alignUtcTime(Number(bar.time), timeframe);
    return {
      ...bar,
      time: time as UTCTimestamp,
      isComplete: bar.isComplete ?? timeframeEnd(time, timeframe) <= Date.now() / 1000,
    };
  });
}
