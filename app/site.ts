// 公開 URL と公開メタの単一の出どころ。canonical・OGP 画像の絶対 URL・sitemap・robots・
// 構造化データがすべて同じ値を指すよう、ここ一箇所で組み立てる。
// GitHub Pages のプロジェクトページ配信では basePath ぶんがパスに乗る。
// basePath は next.config.mjs と同じ NEXT_PUBLIC_BASE_PATH を使う（pages.yml が渡す）。

const ORIGIN = "https://ga-project.github.io";
// 末尾スラッシュを除いて正規化する（"/bakepercent/" と渡されても "//" が混じらない）。
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

// CI のビルドは Pages へ公開される。basePath 無しだと canonical / sitemap が別サイトの
// ルートを自称し、全アセットも 404 になるため、静かに進めず失敗させる。
if (process.env.CI && !BASE_PATH) {
  throw new Error("NEXT_PUBLIC_BASE_PATH が未設定です（Pages 配信には /bakepercent が必要）");
}

/** 公開サイトのルート URL（末尾スラッシュ付き。trailingSlash: true の出力に合わせる）。 */
export const SITE_URL = `${ORIGIN}${BASE_PATH}/`;

export const TITLE = "ベイクパーセント｜ベーカーズ％・仕込み水温・発酵時間の計算";
export const DESC =
  "小麦粉を100%にしたベーカーズ％で配合をスケールし、目標の生地温度から仕込み水温を逆算、生地温度別の発酵時間の目安まで。登録不要・端末内で完結するベーキング計算ツール。";

/** トップページの構造化データ。表示しているページ（トップ）からだけ出す。 */
export const WEB_APP_JSON_LD = {
  "@type": "WebApplication",
  name: "ベイクパーセント",
  url: SITE_URL,
  description: DESC,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  inLanguage: "ja",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
};
