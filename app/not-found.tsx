// ベイクパーセント — 404。static export では out/404.html に書き出される（GitHub Pages 404）。
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 — ベイクパーセント",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="shell">
      <main id="main" style={{ paddingTop: "18vh", textAlign: "center" }}>
        <p className="eyebrow" style={{ color: "var(--bp-accent)" }}>
          404
        </p>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, marginTop: 8 }}>
          ページが見つかりません
        </h1>
        <p
          className="lead"
          style={{ color: "var(--bp-muted)", margin: "12px auto 24px" }}
        >
          お探しのページは移動または削除された可能性があります。
        </p>
        <Link
          className="btn btn-accent"
          href="/"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          配合ツールへ戻る
        </Link>
      </main>
    </div>
  );
}
