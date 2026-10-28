const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const sharedPath = path.resolve(__dirname, "../lib/vtgxDatafeed.ts");
const source = fs.readFileSync(sharedPath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const sharedModule = new Module(sharedPath, module);
sharedModule.filename = sharedPath;
sharedModule.paths = Module._nodeModulePaths(path.dirname(sharedPath));
sharedModule._compile(compiled.outputText, sharedPath);
const {
  aggregateVtgxBars,
  alignUtcTime,
  createMarketDataProvider,
  normalizeMinuteBars,
} = sharedModule.exports;

const midnight = Date.UTC(2024, 0, 1) / 1000;
const makeBar = (time, open, close, volume = 1) => ({
  time,
  open,
  high: Math.max(open, close) + 1,
  low: Math.min(open, close) - 1,
  close,
  volume,
});

test("aggregates a complete UTC hour from sixty minute bars", () => {
  const minuteBars = Array.from({ length: 60 }, (_, index) =>
    makeBar(midnight + index * 60, 100 + index, 101 + index, index + 1)
  );
  const [hour] = aggregateVtgxBars(minuteBars, "1H", midnight + 3600);

  assert.equal(Number(hour.time), midnight);
  assert.equal(hour.open, minuteBars[0].open);
  assert.equal(hour.high, Math.max(...minuteBars.map((bar) => bar.high)));
  assert.equal(hour.low, Math.min(...minuteBars.map((bar) => bar.low)));
  assert.equal(hour.close, minuteBars.at(-1).close);
  assert.equal(hour.volume, minuteBars.reduce((sum, bar) => sum + bar.volume, 0));
  assert.equal(hour.isComplete, true);
});

test("preserves gaps without inventing bars and carries the previous close forward", () => {
  const bars = [
    makeBar(midnight, 100, 101),
    makeBar(midnight + 120, 95, 96),
  ];
  const normalized = normalizeMinuteBars(bars);
  const aggregated = aggregateVtgxBars(bars, "1m", midnight + 180);

  assert.deepEqual(aggregated.map((bar) => Number(bar.time)), [midnight, midnight + 120]);
  assert.equal(normalized[1].open, normalized[0].close);
  assert.equal(normalized[1].low, 94);
  assert.equal(normalized[1].high, normalized[1].open);
});

test("marks the active candle incomplete and aggregates across UTC midnight", () => {
  const [active] = aggregateVtgxBars(
    [makeBar(midnight, 10, 11), makeBar(midnight + 60, 11, 12)],
    "1H",
    midnight + 120
  );
  const dailyBars = aggregateVtgxBars(
    [
      makeBar(midnight + 86340, 10, 11),
      makeBar(midnight + 86400, 11, 12),
    ],
    "1D",
    midnight + 86460
  );

  assert.equal(active.isComplete, false);
  assert.equal(alignUtcTime(midnight + 86340, "1D"), midnight);
  assert.equal(alignUtcTime(midnight + 86400, "1D"), midnight + 86400);
  assert.deepEqual(dailyBars.map((bar) => Number(bar.time)), [midnight, midnight + 86400]);
  assert.equal(dailyBars[0].isComplete, true);
  assert.equal(dailyBars[1].isComplete, false);
});

test("keeps the latest close consistent across aggregated timeframes", () => {
  const minuteBars = Array.from({ length: 60 }, (_, index) =>
    makeBar(midnight + index * 60, 100 + index, 101 + index)
  );
  const timeframes = ["1m", "5m", "15m", "1H", "4H", "1D"];
  const closes = timeframes.map((timeframe) =>
    aggregateVtgxBars(minuteBars, timeframe, midnight + 3600).at(-1).close
  );

  assert.ok(closes.every((close) => close === minuteBars.at(-1).close));
});

test("aggregates live minute updates into the current timeframe bar", async () => {
  const initial = [makeBar(midnight, 100, 101, 5)];
  let emitMinute;
  const provider = createMarketDataProvider({
    mode: "minute-only",
    source: {
      async getBars() {
        return initial;
      },
      subscribeBars(callback) {
        emitMinute = callback;
        return () => {};
      },
    },
  });
  const loaded = await provider.getBars("1H", midnight, midnight + 3600);
  let updated;
  provider.subscribeBars("1H", (bar) => {
    updated = bar;
  });
  emitMinute(makeBar(midnight + 60, 101, 103, 7));

  assert.equal(loaded[0].close, 101);
  assert.equal(Number(updated.time), midnight);
  assert.equal(updated.open, 100);
  assert.equal(updated.close, 103);
  assert.equal(updated.high, 104);
  assert.equal(updated.volume, 12);
});
