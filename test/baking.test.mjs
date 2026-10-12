// ベイクパーセント — 計算コアのテスト（node:test 標準ランナー・追加依存なし）。
// 実行: pnpm test (= node --test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isNum,
  roundTo,
  pctToGrams,
  gramsToPct,
  sumPercent,
  doughFromFlour,
  flourFromDough,
  waterTempForDDT,
  fermentTimeAtTemp,
  splitHM,
} from "../lib/baking.mjs";

const approx = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("isNum は有限数のみ受け付ける", () => {
  assert.equal(isNum(0), true);
  assert.equal(isNum(-3.5), true);
  assert.equal(isNum(NaN), false);
  assert.equal(isNum(Infinity), false);
  assert.equal(isNum("3"), false);
  assert.equal(isNum(null), false);
  assert.equal(isNum(undefined), false);
});

test("roundTo は step 単位に丸める", () => {
  assert.equal(roundTo(194.6, 1), 195);
  assert.equal(roundTo(6.24, 0.1), 6.2);
  assert.ok(Number.isNaN(roundTo(5, 0)));
});

test("pctToGrams: 65% × 300g 粉 = 195g", () => {
  assert.equal(pctToGrams(65, 300), 195);
  assert.equal(pctToGrams(100, 300), 300);
  assert.ok(Number.isNaN(pctToGrams(65, NaN)));
});

test("gramsToPct: 195g / 300g 粉 = 65%（粉0以下は NaN）", () => {
  assert.ok(approx(gramsToPct(195, 300), 65));
  assert.ok(Number.isNaN(gramsToPct(195, 0)));
  assert.ok(Number.isNaN(gramsToPct(195, -1)));
});

test("% ↔ g は往復で一致する", () => {
  const flour = 280;
  for (const pct of [1.8, 2, 65, 72.5, 100]) {
    assert.ok(approx(gramsToPct(pctToGrams(pct, flour), flour), pct));
  }
});

test("sumPercent は不正値を 0 として合算する", () => {
  assert.equal(sumPercent([{ pct: 100 }, { pct: 65 }, { pct: 2 }, { pct: 1.5 }]), 168.5);
  assert.equal(sumPercent([{ pct: 100 }, { pct: NaN }]), 100);
  assert.equal(sumPercent([]), 0);
});

test("doughFromFlour / flourFromDough は逆関数", () => {
  // 粉100 + 水65 + 塩2 + 酵母1 = 168%
  assert.ok(approx(doughFromFlour(300, 168), 504));
  assert.ok(approx(flourFromDough(504, 168), 300));
  assert.ok(Number.isNaN(flourFromDough(504, 0)));
});

test("waterTempForDDT: 中種なし N=3", () => {
  // 目標25 室温22 粉温22 摩擦0 → 25×3 − 44 = 31
  assert.equal(waterTempForDDT({ ddt: 25, roomTemp: 22, flourTemp: 22 }), 31);
  // 摩擦3 → 28
  assert.equal(waterTempForDDT({ ddt: 25, roomTemp: 22, flourTemp: 22, friction: 3 }), 28);
});

test("waterTempForDDT: 中種あり N=4", () => {
  // 25×4 − (22+22+24) − 0 = 100 − 68 = 32
  assert.equal(
    waterTempForDDT({ ddt: 25, roomTemp: 22, flourTemp: 22, prefermentTemp: 24 }),
    32,
  );
});

test("waterTempForDDT: 必須値欠けで NaN", () => {
  assert.ok(Number.isNaN(waterTempForDDT({ ddt: NaN, roomTemp: 22, flourTemp: 22 })));
});

test("fermentTimeAtTemp: q10=2 で +10℃ ごとに半減", () => {
  const base = { baseMinutes: 60, baseTemp: 24, q10: 2 };
  assert.ok(approx(fermentTimeAtTemp({ ...base, targetTemp: 24 }), 60));
  assert.ok(approx(fermentTimeAtTemp({ ...base, targetTemp: 34 }), 30));
  assert.ok(approx(fermentTimeAtTemp({ ...base, targetTemp: 14 }), 120));
});

test("fermentTimeAtTemp: 不正 q10 は 2 にフォールバック", () => {
  assert.ok(approx(fermentTimeAtTemp({ baseMinutes: 60, baseTemp: 24, targetTemp: 34, q10: 0 }), 30));
  assert.ok(Number.isNaN(fermentTimeAtTemp({ baseMinutes: -1, baseTemp: 24, targetTemp: 24 })));
});

test("splitHM: 分を時分に分解", () => {
  assert.deepEqual(splitHM(90), { h: 1, m: 30 });
  assert.deepEqual(splitHM(59.6), { h: 1, m: 0 });
  assert.deepEqual(splitHM(0), { h: 0, m: 0 });
  assert.deepEqual(splitHM(-5), { h: 0, m: 0 });
});
