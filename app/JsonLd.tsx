// 構造化データ（JSON-LD）を 1 か所で安全に書き出すための小さな部品。
//
// 置き場所の原則: 「そのページに実際に表示されている内容」だけを載せる。
// FAQPage をルートレイアウトに置くと、FAQ を表示していないページにも
// 同じ構造化データが出てしまい、表示とマークアップが食い違う。
// そのためレイアウトにはサイト全体で真である WebApplication だけを置き、
// ページ固有のものは各ページからこの部品で出す。

/** JSON-LD の 1 ノード。schema.org の型は多岐にわたるため構造は縛らない。 */
export type JsonLdNode = Record<string, unknown>;

export default function JsonLd({ nodes }: { nodes: JsonLdNode[] }) {
  const graph = nodes.length === 1 ? nodes[0] : { "@graph": nodes };
  const json = JSON.stringify({ "@context": "https://schema.org", ...graph });
  return (
    <script
      type="application/ld+json"
      // `<` をエスケープして、本文に将来 `</script>` 相当が混ざっても
      // script 要素が途中で閉じられないようにする。
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, "\\u003c") }}
    />
  );
}
