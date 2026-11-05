const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const analyticsPath = path.resolve(__dirname, "../lib/dashboardAnalytics.ts");
const compiled = ts.transpileModule(fs.readFileSync(analyticsPath, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const analyticsModule = new Module(analyticsPath, module);
analyticsModule.filename = analyticsPath;
analyticsModule.paths = Module._nodeModulePaths(path.dirname(analyticsPath));
analyticsModule._compile(compiled.outputText, analyticsPath);

const {
  calculateFlowAdjustedEquity,
  calculateDashboardMetrics,
  getEquityDomain,
  getPercentDomain,
} = analyticsModule.exports;

const formatAccountCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const equityPoint = (timestamp, equity, balance = equity) => ({
  timestamp: new Date(timestamp).toISOString(),
  session_id: "test-account",
  equity,
  balance,
  open_positions: 0,
  cycle: 0,
});

for (const initialCapital of [500, 100000, 2500000]) {
  test(`uses ${formatAccountCurrency(initialCapital)} as the baseline`, () => {
    const series = calculateFlowAdjustedEquity(
      [
        equityPoint(0, initialCapital),
        equityPoint(86400000, initialCapital * 1.01),
      ],
      initialCapital
    );
    const [minimum, maximum] = getEquityDomain([initialCapital], initialCapital);
    const [minimumPercent, maximumPercent] = getPercentDomain([0]);
    const minimumSpan = initialCapital * 0.005;
    const formattedBaseline = `$${initialCapital.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const formattedEquity = `$${(initialCapital * 1.01).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    assert.equal(series[0].timeWeightedReturn, 0);
    assert.ok(Math.abs(series[1].timeWeightedReturn - 1) < 1e-10);
    assert.equal(series[1].timeWeightedEquity, initialCapital * 1.01);
    assert.equal(formatAccountCurrency(initialCapital), formattedBaseline);
    assert.equal(`Start ${formatAccountCurrency(initialCapital)}`, `Start ${formattedBaseline}`);
    assert.equal(formatAccountCurrency(series[1].equity), formattedEquity);
    assert.equal(
      `${formatAccountCurrency(series[1].timeWeightedEquity - initialCapital)} (+${series[1].timeWeightedReturn.toFixed(2)}%)`,
      `${formatAccountCurrency(initialCapital * 0.01)} (+1.00%)`
    );
    assert.ok(Math.abs(minimum - (initialCapital - minimumSpan)) < 0.01);
    assert.ok(Math.abs(maximum - (initialCapital + minimumSpan)) < 0.01);
    assert.deepEqual([minimumPercent, maximumPercent], [-0.5, 0.5]);
  });
}

test("excludes an intraperiod deposit from performance returns", () => {
  const initialCapital = 500;
  const series = calculateFlowAdjustedEquity(
    [
      equityPoint(0, 500),
      equityPoint(86400000, 1500),
      equityPoint(2 * 86400000, 1530),
    ],
    initialCapital,
    [{ timestamp: new Date(86400000).toISOString(), amount: 1000 }]
  );

  assert.equal(series[1].timeWeightedReturn, 0);
  assert.equal(series[1].timeWeightedEquity, initialCapital);
  assert.ok(Math.abs(series[2].timeWeightedReturn - 2) < 1e-10);
  assert.equal(series[2].timeWeightedEquity, 510);
  assert.equal(series[2].equity, 1530);
});

test("excludes withdrawals from returns and drawdown", () => {
  const initialCapital = 500;
  const points = [
    equityPoint(0, 500),
    equityPoint(86400000, 300),
    equityPoint(2 * 86400000, 294),
  ];
  const flows = [{ timestamp: new Date(86400000).toISOString(), amount: -200 }];
  const series = calculateFlowAdjustedEquity(points, initialCapital, flows);
  const metrics = calculateDashboardMetrics([], points, initialCapital, flows);

  assert.equal(series[1].timeWeightedReturn, 0);
  assert.ok(Math.abs(series[2].timeWeightedReturn + 2) < 1e-10);
  assert.ok(Math.abs(metrics.maxDrawdown - 2) < 1e-10);
});

test("does not create a curve or returns without a positive initial deposit", () => {
  assert.deepEqual(calculateFlowAdjustedEquity([equityPoint(0, 1000)], 0), []);
  assert.deepEqual(calculateFlowAdjustedEquity([equityPoint(0, 1000)], null), []);
  const metrics = calculateDashboardMetrics([], [equityPoint(0, 1000)], null, []);
  assert.ok(Object.values(metrics).every((value) =>
    typeof value !== "number" || Number.isFinite(value)
  ));
});
