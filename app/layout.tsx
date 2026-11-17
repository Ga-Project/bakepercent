import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { SITE_URL, TITLE, DESC } from "./site";

const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "ベイクパーセント — ベーカーズ％の配合スケール・仕込み水温・発酵時間の計算ツール",
};

// SEO/OGP。metadataBase は OGP 画像の絶対 URL 解決と canonical の基準になる。
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITLE,
    description: DESC,
    type: "website",
    locale: "ja_JP",
    url: SITE_URL,
    siteName: "ベイクパーセント",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG_IMAGE] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* 保存済みテーマを描画前に適用して初回のちらつき（FOUC）を防ぐ。
            未保存なら prefers-color-scheme に従う（data-theme を付けない）。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var s=localStorage.getItem('bakepercent:v1');if(s){var t=JSON.parse(s).theme;if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;}}}catch(e){}",
          }}
        />
        {/* アクセス解析（cookieless・秘密キー不要）: 全プロダクト共通の単一 GoatCounter サイト
            「ga-project」に集約する。製品ごとの数値は path（/bakepercent/）で区別されるので、
            GoatCounter 側でサイトを新規作成しない＝新プロダクトは自動で ga-project の新パスとして計測される。 */}
        <script
          data-goatcounter="https://ga-project.goatcounter.com/count"
          async
          src="//gc.zgo.at/count.js"
        />
        {children}
      </body>
    </html>
  );
}
