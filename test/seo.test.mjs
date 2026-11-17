// SEO / 公開メタの回帰テスト。static export の出力（out/）を検査するため pnpm build 後に走る。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const out = (p) => new URL(`../out/${p}`, import.meta.url);
const hasOut = existsSync(out("index.html"));

test("OGP 画像は 1200x630 の PNG", () => {
  const b = readFileSync(new URL("../public/og.png", import.meta.url));
  assert.equal(b.subarray(1, 4).toString(), "PNG");
  assert.equal(b.readUInt32BE(16), 1200);
  assert.equal(b.readUInt32BE(20), 630);
});

test("index.html に canonical・og:image・JSON-LD が絶対 URL で出る", { skip: !hasOut }, () => {
  const h = readFileSync(out("index.html"), "utf8");
  assert.match(h, /<link rel="canonical" href="https:\/\/ga-project\.github\.io\/[^"]*"/);
  assert.match(h, /property="og:image" content="https:\/\/ga-project\.github\.io\/[^"]*og\.png"/);
  assert.match(h, /application\/ld\+json/);
  assert.match(h, /"@type":"WebApplication"/);
});

test("sitemap.xml と robots.txt が出力され、同じ URL を指す", { skip: !hasOut }, () => {
  const sm = readFileSync(out("sitemap.xml"), "utf8");
  const rb = readFileSync(out("robots.txt"), "utf8");
  const loc = sm.match(/<loc>([^<]+)<\/loc>/)[1];
  assert.ok(loc.startsWith("https://ga-project.github.io/") && loc.endsWith("/"));
  assert.ok(rb.includes(`${loc}sitemap.xml`));
});

test("Pages ビルドは basePath を渡す（未設定だと全アセット 404）", () => {
  const wf = readFileSync(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
  assert.match(wf, /NEXT_PUBLIC_BASE_PATH:\s*\/bakepercent/);
});
