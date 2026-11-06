// Safe JSON-LD serializer for `<script type="application/ld+json">` blocks.
//
// JSON.stringify does NOT escape `<`, so a value containing `</script>` (e.g.
// from a user-controllable URL slug rendered into the graph) can break out of
// the script element and inject markup. We escape the characters that are
// dangerous inside a <script> context. Output is still valid JSON-LD.
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
