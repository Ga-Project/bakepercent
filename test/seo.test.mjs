// 公開メタ・basePath の回帰テスト。static export の出力（out/）を検査するので pnpm build 後に走る。
// 期待値は Pages 配信の実 URL。basePath 無しでビルドすると意図的に落ちる。
// out/ が無い場合、CI では失敗させる（検査せずに緑になるのを防ぐ）。ローカルのみ skip。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const BASE = "https://ga-project.github.io/bakepercent/";
const out = (p) => new URL(`../out/${p}`, import.meta.url);
const hasOut = existsSync(out("index.html"));
const opts = { skip: !hasOut && !process.env.CI };
const read = (p) => readFileSync(out(p), "utf8");

test("OGP 画像は 1200x630 の PNG", () => {
  const b = readFileSync(new URL("../public/og.png", import.meta.url));
  assert.equal(b.subarray(1, 4).toString(), "PNG");
  assert.equal(b.readUInt32BE(16), 1200);
  assert.equal(b.readUInt32BE(20), 630);
});

for (const page of ["index.html", "404.html"]) {
  test(`${page}: 全アセット参照が /bakepercent/ 配下（未付与だと本番で 404）`, opts, () => {
    const refs = [...read(page).matchAll(/(?:src|href)="([^"]*_next\/[^"]*)"/g)].map((m) => m[1]);
    assert.ok(refs.length > 0, "アセット参照が見つからない");
    for (const r of refs) assert.ok(r.startsWith("/bakepercent/_next/"), `basePath 欠落: ${r}`);
  });
}

test("index.html: canonical・og:image・JSON-LD が実 URL で出る", opts, () => {
  const h = read("index.html");
  assert.ok(h.includes(`<link rel="canonical" href="${BASE}"`));
  assert.ok(h.includes(`property="og:image" content="${BASE}og.png"`));
  assert.ok(h.includes(`name="twitter:image" content="${BASE}og.png"`));
  assert.match(h, /"@type":"WebApplication"/);
});

test("404.html: canonical と JSON-LD は出さない（表示内容と一致させる）", opts, () => {
  const h = read("404.html");
  assert.ok(!h.includes('rel="canonical"'));
  assert.ok(!h.includes("application/ld+json"));
});

test("sitemap.xml と robots.txt が実 URL を指す", opts, () => {
  assert.ok(read("sitemap.xml").includes(`<loc>${BASE}</loc>`));
  assert.ok(read("robots.txt").includes(`Sitemap: ${BASE}sitemap.xml`));
});

test("Pages ワークフローが build と test の両方に basePath を渡す", () => {
  const wf = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  const m = wf.match(/- run: pnpm build\n\s+env:\n\s+NEXT_PUBLIC_BASE_PATH: \/bakepercent\n[^\n]*\n\s+- run: pnpm test\n\s+env:\n\s+NEXT_PUBLIC_BASE_PATH: \/bakepercent/);
  assert.ok(m, "pnpm build / pnpm test の env に NEXT_PUBLIC_BASE_PATH: /bakepercent が無い");
});
