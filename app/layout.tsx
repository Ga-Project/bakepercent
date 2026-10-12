import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// SEO/OGP の枠。各製品が title / description / openGraph を自分の内容に差し替える。
// metadataBase は公開 URL が決まったら設定する（OGP 画像の絶対 URL 解決に使う）。
export const metadata: Metadata = {
  title: "ベイクパーセント｜ベーカーズ％・仕込み水温・発酵時間の計算",
  description:
    "小麦粉を100%にしたベーカーズ％で配合をスケールし、目標の生地温度から仕込み水温を逆算、生地温度別の発酵時間の目安まで。登録不要・端末内で完結するベーキング計算ツール。",
  openGraph: {
    title: "ベイクパーセント｜ベーカーズ％・仕込み水温・発酵時間の計算",
    description:
      "小麦粉を100%にしたベーカーズ％で配合をスケール。目標生地温度から仕込み水温を逆算し、生地温度別の発酵時間の目安も。登録不要・端末内完結。",
    type: "website",
    locale: "ja_JP",
  },
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
