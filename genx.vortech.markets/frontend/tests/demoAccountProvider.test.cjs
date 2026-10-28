const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const demoPath = path.resolve(__dirname, "../lib/datafeed/demo/demoAccountProvider.tsx");
const compiled = ts.transpileModule(fs.readFileSync(demoPath, "utf8"), {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
});
const demoModule = new Module(demoPath, module);
demoModule.filename = demoPath;
demoModule.paths = Module._nodeModulePaths(path.dirname(demoPath));
demoModule._compile(compiled.outputText, demoPath);

const { createDemoAccountProvider } = demoModule.exports;

test("demo fixtures adapt capital, history, trade and flow data to account size", () => {
  for (const capital of [500, 2500000]) {
    const provider = createDemoAccountProvider(String(capital));
    try {
      const snapshot = provider.getSnapshot();
      const first = snapshot.equityPoints[0];
      const last = snapshot.equityPoints.at(-1);

      assert.equal(snapshot.initialCapital, capital);
      assert.equal(snapshot.currency, "USD");
      assert.equal(snapshot.equityPoints.length > 90 * 24, true);
      assert.equal(snapshot.trades.length, 20);
      assert.equal(snapshot.capitalFlows.length, 2);
      assert.equal(first.equity, capital);
      assert.notEqual(last.equity, capital);
      assert.ok(snapshot.equityPoints.every((point) =>
        Number.isFinite(point.equity) && Number.isFinite(point.balance)
      ));
    } finally {
      provider.dispose();
    }
  }
});

test("empty fixture provides no capital, chart points, trades or flows", () => {
  const provider = createDemoAccountProvider("empty");
  try {
    const snapshot = provider.getSnapshot();

    assert.equal(snapshot.initialCapital, null);
    assert.equal(snapshot.isDemonstration, true);
    assert.deepEqual(snapshot.equityPoints, []);
    assert.deepEqual(snapshot.trades, []);
    assert.deepEqual(snapshot.capitalFlows, []);
  } finally {
    provider.dispose();
  }
});
