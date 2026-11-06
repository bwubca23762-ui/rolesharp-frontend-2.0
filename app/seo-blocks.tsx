import JsonLd from "./json-ld";

type QA = [string, string];

/**
 * FAQ block, Ink & Signal style.
 *
 * Always emits FAQPage JSON-LD when faqs.length > 0, and renders the compact
 * 2-column card grid by default. (Default flipped to visible per the 2026-10
 * frontend audit: schema-only FAQs were invisible to readers while the search
 * audit's faq-answer-not-visible check correctly flagged them; pages that
 * genuinely want schema-only pass visible={false}.)
 */
export function FaqSection({
  id,
  heading,
  faqs,
  visible = true,
  className = "",
  headingClassName = "",
}: {
  id?: string;
  heading?: string;
  faqs: QA[];
  visible?: boolean;
  className?: string;
  headingClassName?: string;
}) {
  if (!faqs || faqs.length === 0) return null;

  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  if (!visible) {
    return <JsonLd data={ld} />;
  }

  return (
    <section id={id} className={`border-b border-[var(--hairline)] bg-[var(--surface)] py-8 md:py-10 ${className}`}>
      <JsonLd data={ld} />
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className={`${headingClassName || "text-xl md:text-2xl font-extrabold! leading-[1.15]! tracking-[-0.02em]!"} font-extrabold! text-[var(--fg)] mb-5 text-center`}>
          {heading ?? "Quick answers"}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <div
              key={q}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-colors hover:border-[var(--primary)]"
            >
              <h3 className="text-sm font-bold text-[var(--fg)]">{q}</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[var(--muted-fg)]">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
