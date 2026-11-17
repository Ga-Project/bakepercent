// 公開 URL の単一の出どころ。canonical・OGP 画像の絶対 URL・sitemap・robots が
// すべて同じ URL を指すよう、ここ一箇所で組み立てる。
// GitHub Pages のプロジェクトページ配信では basePath ぶんがパスに乗る。
// basePath は next.config.mjs と同じ NEXT_PUBLIC_BASE_PATH を使う（pages.yml が渡す）。

const ORIGIN = "https://ga-project.github.io";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** 公開サイトのルート URL（末尾スラッシュ付き。trailingSlash: true の出力に合わせる）。 */
export const SITE_URL = `${ORIGIN}${BASE_PATH}/`;
