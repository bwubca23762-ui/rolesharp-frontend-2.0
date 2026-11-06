import { jsonLd } from "@/lib/jsonld";

// Renders safely-escaped JSON-LD structured data. Safe because jsonLd() escapes
// `<` `>` `&` (the three characters that could break out of a <script> tag).
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLd(data) }}
    />
  );
}
