"use client";

// ベイクパーセント — 計量の背骨（Measuring Spine）。
// 小麦粉=100% を不動の基準に、各材料が比率ぶんだけ横に伸びる筋で連なる配合台帳。
// 計算は lib/baking.mjs（UI とテストで共有する単一の正）に集約している。

import { useEffect, useMemo, useRef, useState } from "react";
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

type Ing = { id: string; name: string; pct: string; isFlour: boolean };
type DriverMode = "flour" | "dough" | "factor";
type Theme = "light" | "dark";

const STORE_KEY = "bakepercent:v1";
// 100% 基準線（背骨）をトラック幅の固定位置に据える。粉100%は常にこの線に届き、
// それ未満は手前で止まり、100%超は線を越えて伸びる＝全行で縦一本の背骨が通る。
const SPINE_POS = 62;
const FRICTION_PRESETS: ReadonlyArray<{ label: string; value: number }> = [
  { label: "手ごね", value: 1 },
  { label: "ミキサー(弱)", value: 3 },
  { label: "ミキサー(強)", value: 6 },
];

let uidSeq = 0;
// 動的追加行のみ実行時採番（ユーザー操作後＝マウント後なので SSR と衝突しない）。
const uid = () => `ing-${(uidSeq += 1)}`;

// 既定材料は固定IDにする（Math.random だと prerender と初回mountでIDが変わり
// id/htmlFor 属性が食い違って hydration mismatch を起こすため）。
function defaultIngredients(): Ing[] {
  return [
    { id: "flour", name: "強力粉", pct: "100", isFlour: true },
    { id: "water", name: "水", pct: "68", isFlour: false },
    { id: "salt", name: "塩", pct: "2", isFlour: false },
    { id: "yeast", name: "ドライイースト", pct: "1", isFlour: false },
  ];
}

function num(s: string): number {
  if (s.trim() === "") return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

// 表示用の数値整形。二進小数の裾（例 5.1000000000000005）を出さずに丸めて文字列化する。
function fmt(value: number, decimals = 1): string {
  if (!isNum(value)) return "";
  return String(Number(value.toFixed(decimals)));
}

type Persisted = {
  ingredients: Ing[];
  flourStr: string;
  ddt: {
    target: string;
    room: string;
    flour: string;
    preferment: string;
    friction: string;
    usePre: boolean;
  };
  ferm: { baseMin: string; baseTemp: string; target: string };
  theme: Theme | null;
};

export default function Home() {
  const [ingredients, setIngredients] = useState<Ing[]>(defaultIngredients);
  const [flourStr, setFlourStr] = useState("300");
  const [driver, setDriver] = useState<DriverMode>("flour");
  const factorBase = useRef<number>(300);
  const [factorStr, setFactorStr] = useState("1");
  const [doughStr, setDoughStr] = useState(""); // 「総生地量から」入力で打った値をそのまま保持

  const [ddtTarget, setDdtTarget] = useState("25");
  const [ddtRoom, setDdtRoom] = useState("22");
  const [ddtFlour, setDdtFlour] = useState("22");
  const [ddtPre, setDdtPre] = useState("24");
  const [ddtUsePre, setDdtUsePre] = useState(false);
  const [ddtFriction, setDdtFriction] = useState("3");

  const [fBaseMin, setFBaseMin] = useState("60");
  const [fBaseTemp, setFBaseTemp] = useState("24");
  const [fTarget, setFTarget] = useState("26");

  const [theme, setTheme] = useState<Theme | null>(null);
  const [restored, setRestored] = useState(false);
  const [tallyPulse, setTallyPulse] = useState(false);
  const mounted = useRef(false);
  const firstSave = useRef(true); // 既定/復元直後の状態を自動保存しない（偽の「復元」通知を防ぐ）

  // ---- 復元（マウント後にのみ localStorage を読む＝SSR と一致させる） ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<Persisted>;
        if (Array.isArray(p.ingredients) && p.ingredients.length > 0) {
          setIngredients(p.ingredients);
          setRestored(true);
        }
        if (typeof p.flourStr === "string") setFlourStr(p.flourStr);
        if (p.ddt) {
          setDdtTarget(p.ddt.target ?? "25");
          setDdtRoom(p.ddt.room ?? "22");
          setDdtFlour(p.ddt.flour ?? "22");
          setDdtPre(p.ddt.preferment ?? "24");
          setDdtFriction(p.ddt.friction ?? "3");
          setDdtUsePre(Boolean(p.ddt.usePre));
        }
        if (p.ferm) {
          setFBaseMin(p.ferm.baseMin ?? "60");
          setFBaseTemp(p.ferm.baseTemp ?? "24");
          setFTarget(p.ferm.target ?? "26");
        }
        if (p.theme === "light" || p.theme === "dark") setTheme(p.theme);
      }
    } catch {
      /* 壊れた保存は無視して既定で開始 */
    }
    mounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- テーマ適用 ----
  useEffect(() => {
    const root = document.documentElement;
    if (theme) root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme]);

  // ---- 保存（マウント後・かつ実際のユーザー変更が起きてから） ----
  useEffect(() => {
    if (!mounted.current) return;
    // 初回（＝既定 or 復元直後の状態）は保存しない。純粋な閲覧で保存が走り、
    // 次回訪問に偽の「復元しました」通知が出るのを防ぐ。
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    const payload: Persisted = {
      ingredients,
      flourStr,
      ddt: {
        target: ddtTarget,
        room: ddtRoom,
        flour: ddtFlour,
        preferment: ddtPre,
        friction: ddtFriction,
        usePre: ddtUsePre,
      },
      ferm: { baseMin: fBaseMin, baseTemp: fBaseTemp, target: fTarget },
      theme,
    };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch {
      /* 保存不可(プライベートモード等)でもツールは動く */
    }
  }, [
    ingredients,
    flourStr,
    ddtTarget,
    ddtRoom,
    ddtFlour,
    ddtPre,
    ddtFriction,
    ddtUsePre,
    fBaseMin,
    fBaseTemp,
    fTarget,
    theme,
  ]);

  const flourGrams = num(flourStr);
  const flourValid = isNum(flourGrams) && flourGrams > 0;
  // 合計・派生には妥当な（有限かつ非負の）% のみ入れる。不正/負値は下流へ流さない。
  const totalPct = useMemo(
    () =>
      sumPercent(
        ingredients.map((i) => {
          const v = num(i.pct);
          return { pct: isNum(v) && v >= 0 ? v : 0 };
        }),
      ),
    [ingredients],
  );
  const doughGrams = flourValid ? doughFromFlour(flourGrams, totalPct) : NaN;

  // ---- 材料の編集 ----
  function updatePct(id: string, pct: string) {
    setIngredients((list) =>
      list.map((i) => (i.id === id ? { ...i, pct } : i)),
    );
  }
  function updateName(id: string, name: string) {
    setIngredients((list) =>
      list.map((i) => (i.id === id ? { ...i, name } : i)),
    );
  }
  // g を打つと % を逆算して格納（% を正とする）
  function updateGrams(id: string, gStr: string) {
    if (!flourValid) return;
    const g = num(gStr);
    if (!isNum(g)) {
      updatePct(id, "");
      return;
    }
    const pct = gramsToPct(g, flourGrams);
    updatePct(id, fmt(pct, 1));
  }
  function addRow() {
    setIngredients((list) => [
      ...list,
      { id: uid(), name: "", pct: "", isFlour: false },
    ]);
  }
  function removeRow(id: string) {
    setIngredients((list) => list.filter((i) => i.id !== id));
  }
  function clearAll() {
    setIngredients(defaultIngredients());
    setFlourStr("300");
    setRestored(false);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {
      /* noop */
    }
  }

  // ---- バッチスケーラー ----
  function setDoughInput(dStr: string) {
    setDoughStr(dStr); // 打った値をそのまま欄に残す（丸めた粉量からの再導出で書き換えない）
    const d = num(dStr);
    if (!isNum(d) || totalPct <= 0) return;
    setFlourStr(fmt(flourFromDough(d, totalPct), 0));
    pulse();
  }
  function applyFactor(fStr: string) {
    setFactorStr(fStr);
    const k = num(fStr);
    if (!isNum(k) || k <= 0) return;
    setFlourStr(fmt(factorBase.current * k, 0));
    pulse();
  }
  function switchDriver(mode: DriverMode) {
    setDriver(mode);
    if (mode === "factor") {
      factorBase.current = flourValid ? flourGrams : 300;
      setFactorStr("1");
    }
    if (mode === "dough") {
      setDoughStr(flourValid ? fmt(doughGrams, 0) : "");
    }
  }
  function pulse() {
    setTallyPulse(true);
    window.setTimeout(() => setTallyPulse(false), 420);
  }

  // ---- DDT ----
  const waterTemp = waterTempForDDT({
    ddt: num(ddtTarget),
    roomTemp: num(ddtRoom),
    flourTemp: num(ddtFlour),
    prefermentTemp: ddtUsePre ? num(ddtPre) : null,
    friction: num(ddtFriction),
  });
  const waterValid = isNum(waterTemp);
  const waterOutOfRange = waterValid && (waterTemp < 1 || waterTemp > 60);
  const tempColor = (t: number) => {
    if (!isNum(t)) return "var(--bp-muted)";
    if (t < 10) return "var(--bp-temp-cold)";
    if (t < 18) return "var(--bp-temp-cool)";
    if (t < 26) return "var(--bp-temp-mid)";
    if (t < 34) return "var(--bp-temp-warm)";
    return "var(--bp-temp-hot)";
  };

  // ---- 発酵 ----
  const fTargetNum = num(fTarget);
  const fermMinutes = fermentTimeAtTemp({
    baseMinutes: num(fBaseMin),
    baseTemp: num(fBaseTemp),
    targetTemp: fTargetNum,
  });
  const fermHM = splitHM(fermMinutes);
  const refTemps = [20, 22, 24, 26, 28, 30, 32];
  const refRows = refTemps.map((t) => ({
    t,
    min: fermentTimeAtTemp({
      baseMinutes: num(fBaseMin),
      baseTemp: num(fBaseTemp),
      targetTemp: t,
    }),
  }));

  // 発酵カーブの SVG 座標（20〜32℃ を x、時間を y にマップ）
  const curve = useMemo(() => {
    const w = 320;
    const h = 120;
    const pad = 8;
    const times = refRows.map((r) => r.min).filter(isNum);
    const maxT = times.length ? Math.max(...times) : 1;
    const xFor = (t: number) => pad + ((t - 20) / 12) * (w - pad * 2);
    const yFor = (m: number) =>
      pad + (1 - (isNum(m) && maxT > 0 ? m / maxT : 0)) * (h - pad * 2);
    const pts = refRows.map(
      (r) => `${xFor(r.t).toFixed(1)},${yFor(r.min).toFixed(1)}`,
    );
    return { w, h, path: `M ${pts.join(" L ")}`, xFor, yFor, maxT };
  }, [refRows]);

  const showEmpty = ingredients.filter((i) => !i.isFlour).length === 0;

  return (
    <>
      <a className="skip-link" href="#main">
        本文へスキップ
      </a>

      <div className="shell">
        <header className="masthead">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              %
            </span>
            <span className="brand-name">ベイクパーセント</span>
          </div>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="配色を切り替える"
          >
            {theme === "dark" ? "☀ ライト" : "☾ ダーク"}
          </button>
        </header>

        <section className="hero">
          <p className="eyebrow">ベーカーズ％ ・ 仕込み水温 ・ 発酵時間</p>
          <h1>粉を100%に。配合も水温も、比率で決める。</h1>
          <p className="lead">
            小麦粉を基準にした配合をそのままスケールし、目標の生地温度から仕込み水温を逆算、
            生地温度ごとの発酵時間の目安まで。端末内だけで動く、登録不要のベーキング計算ツールです。
          </p>
        </section>

        <main id="main">
          {restored && (
            <div className="banner" role="status">
              <span className="grow">前回の配合を復元しました。</span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={clearAll}
              >
                消して新規
              </button>
            </div>
          )}

          <div className="cols">
            {/* ===== 材料台帳 ===== */}
            <section className="section" aria-labelledby="ledger-h">
              <div className="section-head">
                <h2 id="ledger-h">配合（ベーカーズ％）</h2>
                <span className="hint">
                  粉＝100％を基準に各材料の％を入れる
                </span>
              </div>

              <div className="ledger">
                <div className="spine-legend">
                  <span className="notch" aria-hidden="true" />
                  <span>縦の基準線 ＝ 粉100％。横筋は各材料の対粉比。</span>
                </div>

                {ingredients.map((ing) => {
                  const pctN = num(ing.pct);
                  const pctBad =
                    ing.pct.trim() !== "" && (!isNum(pctN) || pctN < 0);
                  // 100% を SPINE_POS に写像。粉(100%)は背骨に届き、超過はそれを越える。
                  const fillW =
                    isNum(pctN) && pctN > 0
                      ? Math.min(100, (pctN / 100) * SPINE_POS)
                      : 0;
                  const gramsText = ing.isFlour
                    ? flourStr
                    : flourValid && isNum(pctN) && pctN >= 0
                      ? fmt(pctToGrams(pctN, flourGrams), 1)
                      : "";
                  return (
                    <div
                      className={`row${ing.isFlour ? " is-flour" : ""}`}
                      key={ing.id}
                    >
                      <div className="row-main">
                        <input
                          className="ing-name"
                          type="text"
                          value={ing.name}
                          placeholder="材料名"
                          aria-label="材料名"
                          onChange={(e) => updateName(ing.id, e.target.value)}
                        />
                        {ing.isFlour && (
                          <span className="pin-tag">基準 100%</span>
                        )}
                      </div>

                      <div className="row-fields">
                        {!ing.isFlour && (
                          <div className="field">
                            <label htmlFor={`pct-${ing.id}`}>％</label>
                            <div
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              <input
                                id={`pct-${ing.id}`}
                                className={`inp num${pctBad ? " is-error" : ""}`}
                                inputMode="decimal"
                                value={ing.pct}
                                placeholder="0"
                                aria-invalid={pctBad}
                                onChange={(e) =>
                                  updatePct(ing.id, e.target.value)
                                }
                              />
                              <span className="unit">%</span>
                            </div>
                          </div>
                        )}
                        <div className="field">
                          <label htmlFor={`g-${ing.id}`}>
                            {ing.isFlour ? "粉量" : "重さ"}
                          </label>
                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            <input
                              id={`g-${ing.id}`}
                              className="inp num"
                              inputMode="decimal"
                              value={ing.isFlour ? flourStr : gramsText}
                              placeholder={
                                ing.isFlour ? "300" : flourValid ? "0" : "—"
                              }
                              disabled={!ing.isFlour && !flourValid}
                              aria-label={`${ing.name || "材料"}の重さ(g)`}
                              onChange={(e) =>
                                ing.isFlour
                                  ? setFlourStr(e.target.value)
                                  : updateGrams(ing.id, e.target.value)
                              }
                            />
                            <span className="unit">g</span>
                          </div>
                        </div>
                        {!ing.isFlour ? (
                          <button
                            className="icon-btn"
                            type="button"
                            aria-label={`${ing.name || "材料"}を削除`}
                            onClick={() => removeRow(ing.id)}
                          >
                            ✕
                          </button>
                        ) : (
                          <span style={{ width: 44 }} aria-hidden="true" />
                        )}
                      </div>

                      <div
                        className={`reach${pctBad ? " is-danger" : ""}`}
                        aria-hidden="true"
                      >
                        <div
                          className="reach-fill"
                          style={{ width: `${fillW}%` }}
                        />
                        <div
                          className="reach-hundred"
                          style={{ left: `${SPINE_POS}%` }}
                        />
                      </div>

                      {pctBad && (
                        <p className="row-error" role="alert">
                          ⚠ 0以上の数値を入れてください
                        </p>
                      )}
                    </div>
                  );
                })}

                {showEmpty && (
                  <div className="ghost">
                    <p>
                      <strong>材料はまだ粉だけ</strong>です。
                    </p>
                    <p>
                      「材料を追加」で水・塩・酵母などを比率で足していきましょう。
                    </p>
                  </div>
                )}

                <div className="ledger-actions">
                  <button className="btn" type="button" onClick={addRow}>
                    ＋ 材料を追加
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={clearAll}
                  >
                    リセット
                  </button>
                </div>
              </div>

              {/* バッチスケーラー */}
              <div
                className="section-head"
                style={{ marginTop: "var(--step-5)" }}
              >
                <h2>バッチスケール</h2>
                <span className="hint">％は不変・g だけが伸縮</span>
              </div>
              <div className="panel">
                <div className="panel-body">
                  <div className="seg" role="group" aria-label="スケールの基準">
                    {(["flour", "dough", "factor"] as DriverMode[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={driver === m}
                        onClick={() => switchDriver(m)}
                      >
                        {m === "flour"
                          ? "粉量から"
                          : m === "dough"
                            ? "総生地量から"
                            : "倍率で"}
                      </button>
                    ))}
                  </div>
                  <div
                    className="grid-inputs"
                    style={{ marginTop: "var(--step-3)" }}
                  >
                    {driver === "flour" && (
                      <div className="stack">
                        <label htmlFor="scale-flour">粉の合計 (g)</label>
                        <input
                          id="scale-flour"
                          className="inp num"
                          inputMode="decimal"
                          value={flourStr}
                          onChange={(e) => {
                            setFlourStr(e.target.value);
                            pulse();
                          }}
                        />
                      </div>
                    )}
                    {driver === "dough" && (
                      <div className="stack">
                        <label htmlFor="scale-dough">
                          作りたい総生地量 (g)
                        </label>
                        <input
                          id="scale-dough"
                          className="inp num"
                          inputMode="decimal"
                          value={doughStr}
                          placeholder="例: 900"
                          onChange={(e) => setDoughInput(e.target.value)}
                        />
                      </div>
                    )}
                    {driver === "factor" && (
                      <div className="stack">
                        <label htmlFor="scale-factor">
                          倍率（現在の粉量に対して）
                        </label>
                        <input
                          id="scale-factor"
                          className="inp num"
                          inputMode="decimal"
                          value={factorStr}
                          placeholder="例: 2"
                          onChange={(e) => applyFactor(e.target.value)}
                        />
                      </div>
                    )}
                    <div className="stack">
                      <label>総生地量（自動）</label>
                      <div
                        className="num"
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 700,
                          paddingTop: 8,
                        }}
                      >
                        {flourValid ? `${fmt(doughGrams, 0)} g` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ===== 温度パネル ===== */}
            <section className="section panel-sticky" aria-labelledby="temp-h">
              <div className="section-head">
                <h2 id="temp-h">仕込み水温（DDT）</h2>
                <span className="hint">目標の生地温度から逆算</span>
              </div>
              <div className="panel">
                <div className="panel-ramp" aria-hidden="true" />
                <div className="panel-body">
                  <div className="grid-inputs">
                    <NumField
                      id="ddt-target"
                      label="目標生地温度 ℃"
                      value={ddtTarget}
                      set={setDdtTarget}
                    />
                    <NumField
                      id="ddt-room"
                      label="室温 ℃"
                      value={ddtRoom}
                      set={setDdtRoom}
                    />
                    <NumField
                      id="ddt-flour"
                      label="粉温 ℃"
                      value={ddtFlour}
                      set={setDdtFlour}
                    />
                    <div className="stack">
                      <label htmlFor="ddt-friction">摩擦係数 ℃</label>
                      <input
                        id="ddt-friction"
                        className="inp num"
                        inputMode="decimal"
                        value={ddtFriction}
                        onChange={(e) => setDdtFriction(e.target.value)}
                      />
                      <div
                        className="preset-row"
                        role="group"
                        aria-label="こね方から摩擦係数を選ぶ"
                      >
                        {FRICTION_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            className="preset"
                            aria-pressed={ddtFriction === String(p.value)}
                            onClick={() => setDdtFriction(String(p.value))}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 12,
                      minHeight: 44,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={ddtUsePre}
                      onChange={(e) => setDdtUsePre(e.target.checked)}
                      style={{ width: 20, height: 20 }}
                    />
                    <span>中種／ルヴァンを使う</span>
                  </label>
                  {ddtUsePre && (
                    <div className="grid-inputs" style={{ marginTop: 8 }}>
                      <NumField
                        id="ddt-pre"
                        label="中種の温度 ℃"
                        value={ddtPre}
                        set={setDdtPre}
                      />
                    </div>
                  )}

                  <div
                    className={`result${waterOutOfRange ? " is-danger" : ""}`}
                    role="group"
                    aria-label="仕込み水温の結果"
                  >
                    <svg
                      className="thermo"
                      width="64"
                      height="64"
                      viewBox="0 0 64 64"
                      aria-hidden="true"
                    >
                      <path
                        d="M8 40 A24 24 0 0 1 56 40"
                        fill="none"
                        stroke="var(--bp-sunk)"
                        strokeWidth="8"
                        strokeLinecap="round"
                      />
                      {waterValid && (
                        <path
                          d="M8 40 A24 24 0 0 1 56 40"
                          fill="none"
                          stroke={tempColor(waterTemp)}
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray="75.4"
                          strokeDashoffset={
                            75.4 *
                            (1 - Math.min(1, Math.max(0, waterTemp / 60)))
                          }
                        />
                      )}
                    </svg>
                    <div>
                      {/* 数値は常に高コントラストの本文色で表示（温度の色符号化は下のアークが担う）。
                          温度ランプ色を数値の文字色に使うと light 背景で AA を割るため使わない。 */}
                      <div className="big num" aria-live="polite">
                        {waterValid ? roundTo(waterTemp, 0.5) : "—"}
                        <span className="unit"> ℃</span>
                      </div>
                      <p className="caption">
                        {!waterValid
                          ? "温度をすべて入れると水温が出ます"
                          : waterOutOfRange
                            ? waterTemp < 1
                              ? "氷水が必要な低温です。材料を冷やすか目標温度を見直しましょう。"
                              : "高すぎます。粉・室温や目標温度を見直しましょう。"
                            : "この温度の水で仕込むと目標の生地温度に近づきます。"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 発酵時間 */}
              <div
                className="section-head"
                style={{ marginTop: "var(--step-5)" }}
              >
                <h2>発酵時間の目安</h2>
                <span className="hint">生地温度で伸び縮みする</span>
              </div>
              <div className="panel">
                <div className="panel-ramp" aria-hidden="true" />
                <div className="panel-body">
                  <div className="grid-inputs">
                    <NumField
                      id="f-basemin"
                      label="基準の発酵時間 (分)"
                      value={fBaseMin}
                      set={setFBaseMin}
                    />
                    <NumField
                      id="f-basetemp"
                      label="そのときの生地温度 ℃"
                      value={fBaseTemp}
                      set={setFBaseTemp}
                    />
                  </div>

                  <div className="curve-wrap">
                    <svg
                      className="curve"
                      viewBox={`0 0 ${curve.w} ${curve.h}`}
                      role="img"
                      aria-label={`生地温度と発酵時間のカーブ。${fBaseTemp}℃で${fBaseMin}分を基準に外挿。`}
                    >
                      <path
                        d={curve.path}
                        fill="none"
                        stroke="var(--bp-accent)"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      {isNum(fTargetNum) && (
                        <circle
                          cx={curve.xFor(
                            Math.min(32, Math.max(20, fTargetNum)),
                          )}
                          cy={curve.yFor(fermMinutes)}
                          r="5"
                          fill="var(--bp-accent)"
                          stroke="var(--bp-surface)"
                          strokeWidth="2"
                        />
                      )}
                    </svg>
                    <input
                      className="slider"
                      type="range"
                      min={20}
                      max={32}
                      step={1}
                      value={isNum(fTargetNum) ? fTargetNum : 26}
                      aria-label="目標の生地温度"
                      onChange={(e) => setFTarget(e.target.value)}
                    />
                    <div className="ferment-readout">
                      <span className="num big" aria-live="polite">
                        {isNum(fermMinutes)
                          ? fermHM.h > 0
                            ? `${fermHM.h}時間${fermHM.m}分`
                            : `${fermHM.m}分`
                          : "—"}
                      </span>
                      <span className="caption">
                        生地温度 {isNum(fTargetNum) ? fTargetNum : "—"}℃
                        のとき（目安）
                      </span>
                    </div>
                  </div>

                  <table className="ref">
                    <thead>
                      <tr>
                        <th scope="col">生地温度</th>
                        <th scope="col">発酵時間の目安</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refRows.map((r) => {
                        const hm = splitHM(r.min);
                        return (
                          <tr
                            key={r.t}
                            className={
                              isNum(fTargetNum) &&
                              Math.round(fTargetNum) === r.t
                                ? "is-current"
                                : ""
                            }
                          >
                            <td>{r.t} ℃</td>
                            <td className="num">
                              {isNum(r.min)
                                ? hm.h > 0
                                  ? `${hm.h}時間${hm.m}分`
                                  : `${hm.m}分`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="caption" style={{ marginTop: 8 }}>
                    ＊
                    発酵は酵母量や配合でも変わります。この表はあなたの基準点からの目安です。
                  </p>
                </div>
              </div>
            </section>
          </div>

          <footer className="foot">
            <p>
              すべての計算はこの端末の中だけで行われます。入力内容はサーバーに送信されません。
            </p>
            <p>配合はこのブラウザに自動保存され、次回そのまま開けます。</p>
          </footer>
        </main>
      </div>

      {/* 総量サマリ（sticky） */}
      <div className="tally" aria-hidden={false}>
        <div className="tally-inner">
          <div className={`metric${tallyPulse ? " pulse" : ""}`}>
            <span className="k">総ベーカーズ％</span>
            <span className="v num">{fmt(totalPct, 1)}%</span>
          </div>
          <div className={`metric${tallyPulse ? " pulse" : ""}`}>
            <span className="k">粉の合計</span>
            <span className="v num">
              {flourValid ? `${fmt(flourGrams, 0)} g` : "—"}
            </span>
          </div>
          <div className={`metric${tallyPulse ? " pulse" : ""}`}>
            <span className="k">総生地量</span>
            <span className="v num">
              {flourValid ? `${fmt(doughGrams, 0)} g` : "—"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function NumField(props: {
  id: string;
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <div className="stack">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className="inp num"
        inputMode="decimal"
        value={props.value}
        onChange={(e) => props.set(e.target.value)}
      />
    </div>
  );
}
