/**
 * ベイクパーセント 受入E2E — コンソール check_items の機械実行版。
 * キーは check_items.key と一致させること（scale-recipe / water-temp /
 * ferment-by-temp / restore-autosave）。
 *
 * 方針: 実装内部を覗かず、利用者と同じ操作だけで判定する。
 * 既定の配合（強力粉300 / 水68% / 塩2% / ドライイースト1% ＝ 総171%）を前提にする。
 */

/** 各項目を独立させるため、保存済み状態を消してから既定配合で開き直す。 */
async function fresh(h) {
  await h.goto("/");
  await h.page.evaluate(() => {
    try {
      localStorage.clear();
    } catch (e) {
      /* noop */
    }
  });
  await h.goto("/");
}

export const items = {
  /** 粉量を変えると % は不変のまま各材料の g と総生地量が比率で追従する */
  "scale-recipe": async (h) => {
    await fresh(h);
    // 「粉量から」モード（既定）の粉量を 300 → 600 に倍化
    await h.fill("#scale-flour", "600");
    await h.wait(200);
    // 総生地量が倍化（300×1.71=513 → 600×1.71=1026）
    await h.expectText("1026");
    // 総ベーカーズ% は不変
    await h.expectText("171%");
    // 各材料の g も比率で追従（水 68% → 600×0.68=408g）
    const hasWater = await h.page.evaluate(() =>
      [...document.querySelectorAll("input.inp.num")].some((i) => i.value === "408"),
    );
    if (!hasWater) throw new Error("水の重さが 408g に追従していない（比率スケール失敗）");
    h.note("粉600gで総生地量1026g・%不変171%・水408gに追従");
  },

  /** 目標の生地温度・室温・粉温・摩擦係数から仕込み水温を逆算する */
  "water-temp": async (h) => {
    await fresh(h);
    await h.fill("#ddt-target", "26");
    await h.fill("#ddt-room", "20");
    await h.fill("#ddt-flour", "20");
    await h.fill("#ddt-friction", "2");
    await h.wait(200);
    // 26×3 − (20+20) − 2 = 36℃
    await h.expectText("36");
    h.note("目標26/室温20/粉温20/摩擦2 → 仕込み水温 36℃");
  },

  /** 生地温度によって発酵時間の目安が変わる（高温ほど短い） */
  "ferment-by-temp": async (h) => {
    await fresh(h);
    // 基準 60分@24℃ の既定で、参照表に温度別の異なる時間が出る（時分表記）
    await h.expectText("40分"); // 30℃ の目安（60×2^-0.6 ≈ 39.6分 → 40分）
    await h.expectText("1時間19分"); // 20℃ の目安（60×2^0.4 ≈ 79.2分 → 1時間19分）
    h.note("同じ基準でも 30℃=40分 / 20℃=1時間19分 と温度で発酵時間が変わる");
  },

  /** 入力は自動保存され、再読み込み後に復元される */
  "restore-autosave": async (h) => {
    await fresh(h);
    await h.fill("#ddt-target", "27");
    await h.wait(500); // 自動保存を待つ
    await h.goto("/"); // 再読み込み
    await h.expectText("前回の配合を復元しました");
    const restored = await h.page.$eval("#ddt-target", (e) => e.value);
    if (restored !== "27") throw new Error(`目標生地温度が復元されていない（欄の値: ${restored || "空"}）`);
    h.note("再読込後も目標生地温度27℃を保持・復元通知あり");
  },
};

/**
 * デザイン確認用の画面（受入の合否には関与しない）。
 */
export const designStates = {
  // 既定の配合が入り、水温・発酵時間まで結果が出ている状態
  "main-populated": async (h) => {
    await h.goto("/");
    await h.wait(300);
  },
  // 暗い配色へ切り替える（明→暗）
  dark: async (h) => {
    await h.goto("/");
    await h.wait(200);
    await h.click(".theme-toggle");
    await h.wait(300);
  },
};
