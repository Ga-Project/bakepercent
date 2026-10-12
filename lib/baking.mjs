// @ts-check
// ベイクパーセント — 計算コア（純関数・UI とテストで共有する単一の正）。
// ここは端末内で完結する純粋な計算のみ。DOM・保存・副作用は持たない。
// 「計算で解ける部分だけ正直に解く」— モデルに基づく目安は目安として返す。

/**
 * 有限な数値か。空入力・NaN・Infinity を弾く共通ガード。
 * @param {unknown} x
 * @returns {x is number}
 */
export function isNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

/**
 * 表示用の丸め（値を step 単位に丸める）。計算そのものは丸めない（この関数は表示層専用）。
 * @param {number} value
 * @param {number} step 例: 1, 0.1
 * @returns {number}
 */
export function roundTo(value, step) {
  if (!isNum(value) || !isNum(step) || step <= 0) return NaN;
  return Math.round(value / step) * step;
}

// ---- ベーカーズ% ↔ 実重量 --------------------------------------------------

/**
 * 材料% → 実重量g。flourGrams は粉の合計g（=100% の基準量）。
 * @param {number} pct
 * @param {number} flourGrams
 * @returns {number} g（粉量未確定なら NaN）
 */
export function pctToGrams(pct, flourGrams) {
  if (!isNum(pct) || !isNum(flourGrams)) return NaN;
  return (pct / 100) * flourGrams;
}

/**
 * 実重量g → 材料%。flourGrams は 0 より大きいこと。
 * @param {number} grams
 * @param {number} flourGrams
 * @returns {number} %（粉量が 0 以下なら NaN）
 */
export function gramsToPct(grams, flourGrams) {
  if (!isNum(grams) || !isNum(flourGrams) || flourGrams <= 0) return NaN;
  return (grams / flourGrams) * 100;
}

/**
 * 総ベーカーズ%（粉 100 を含む全材料の % 合計）。
 * @param {ReadonlyArray<{ pct: number }>} items
 * @returns {number}
 */
export function sumPercent(items) {
  return items.reduce((s, it) => s + (isNum(it.pct) ? it.pct : 0), 0);
}

/**
 * 粉合計g → 総生地量g。sumPct は総%（粉を含む）。
 * @param {number} flourGrams
 * @param {number} sumPct
 * @returns {number}
 */
export function doughFromFlour(flourGrams, sumPct) {
  if (!isNum(flourGrams) || !isNum(sumPct)) return NaN;
  return flourGrams * (sumPct / 100);
}

/**
 * 総生地量g → 粉合計g。sumPct は 0 より大きいこと。
 * @param {number} doughGrams
 * @param {number} sumPct
 * @returns {number}
 */
export function flourFromDough(doughGrams, sumPct) {
  if (!isNum(doughGrams) || !isNum(sumPct) || sumPct <= 0) return NaN;
  return doughGrams / (sumPct / 100);
}

// ---- 仕込み水温（DDT 法） --------------------------------------------------

/**
 * 目標生地温度から仕込み水温を逆算する（摩擦係数法）。
 *
 *   仕込み水温 = 目標生地温度 × N − (室温 + 粉温 [+ 中種温]) − 摩擦係数
 *   N = 温度要素の数（室温・粉温・[中種温]・水温）。中種ありで 4、なしで 3。
 *
 * 摩擦係数はこね方で変わる目安値（呼び出し側でプリセット/入力）。
 * @param {{ ddt: number, roomTemp: number, flourTemp: number, prefermentTemp?: number | null, friction?: number }} p
 * @returns {number} 仕込み水温(℃)。必須値が欠けると NaN。
 */
export function waterTempForDDT({ ddt, roomTemp, flourTemp, prefermentTemp = null, friction = 0 }) {
  if (![ddt, roomTemp, flourTemp].every(isNum)) return NaN;
  const known = [roomTemp, flourTemp];
  if (isNum(prefermentTemp)) known.push(prefermentTemp);
  const n = known.length + 1; // + 水
  const fr = isNum(friction) ? friction : 0;
  return ddt * n - known.reduce((a, b) => a + b, 0) - fr;
}

// ---- 温度別の発酵時間（目安） ----------------------------------------------

/**
 * 温度別の発酵時間の目安。基準点（baseTemp のとき baseMinutes）から Q10 モデルで外挿する。
 *
 *   time(T) = baseMinutes × q10 ^ ((baseTemp − T) / 10)
 *
 * 生地温度が高いほど短く、低いほど長い。あくまで目安（酵母量・配合で実際は変わる）。
 * q10=2 は「+10℃ で発酵がおよそ2倍速＝時間が半分」を意味する。
 * @param {{ baseMinutes: number, baseTemp: number, targetTemp: number, q10?: number }} p
 * @returns {number} 目安の発酵時間(分)。必須値が欠けると NaN。
 */
export function fermentTimeAtTemp({ baseMinutes, baseTemp, targetTemp, q10 = 2 }) {
  if (![baseMinutes, baseTemp, targetTemp].every(isNum) || baseMinutes < 0) return NaN;
  const q = isNum(q10) && q10 > 1 ? q10 : 2;
  return baseMinutes * Math.pow(q, (baseTemp - targetTemp) / 10);
}

/**
 * 分 → 「_時間_分」表記の分解（表示用）。
 * @param {number} minutes
 * @returns {{ h: number, m: number }}
 */
export function splitHM(minutes) {
  if (!isNum(minutes) || minutes < 0) return { h: 0, m: 0 };
  const total = Math.round(minutes);
  return { h: Math.floor(total / 60), m: total % 60 };
}
