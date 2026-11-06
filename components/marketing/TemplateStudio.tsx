import Image from "next/image";
import { ChevronRight } from "@/app/icons";
import { SampleProvenance } from "@/components/marketing/ProductDemo";
import { Button, Container, Section, SectionHeader } from "@/components/ui/primitives";

/**
 * Act 04 — the templates, as the documents they actually produce.
 *
 * These are not illustrations. Every image is a render of lib/pdf.tsx output,
 * produced by scripts/render-template-shots.ts from the same code path as a
 * user's real export, so the marketing imagery cannot drift from the product.
 * That script's own comment names the problem it was written for: the old
 * TemplateThumb was grey bars, "which is why their pages look like products
 * and ours looks like a wireframe".
 *
 * The names here are the real template ids the export engine accepts. The
 * /resume-templates catalogue still advertises six invented names (Clarity,
 * Momentum, Ledger, Studio, First Step, Borderless) that exist in no other file
 * in the repo and map to nothing. That is filed as a claim-integrity defect
 * needing a product decision; it is deliberately not hidden behind these real
 * renders, because a genuine screenshot under an invented name is a stronger
 * false claim than a grey box under one.
 */
const templates = [
  { id: "executive", title: "Executive", note: "Credential-led, for leadership and finance scope." },
  { id: "technical", title: "Technical", note: "Skills and systems forward, compact enough to scan." },
  { id: "minimal", title: "Minimal", note: "One column, standard headings, maximum parser reliability." },
  { id: "elegant", title: "Elegant", note: "A stronger header without costing ATS readability." },
] as const;

export function TemplateStudio() {
  return (
    <Section asContainer={false} alt>
      <Container size="large">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <SectionHeader
            eyebrow="Every template is a real export"
            title="Different visual voices. The same ATS-safe foundation."
            description="Switch layouts without rewriting your content. Each one below is rendered by the same code that produces your download, so what you see is what the employer opens."
          />
          <Button as="a" href="/resume-templates" variant="outline" className="w-fit" rightIcon={<ChevronRight size={16} />}>
            Browse templates
          </Button>
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {templates.map((template) => (
            <li key={template.id}>
              <a
                href="/resume-templates"
                className="group block rounded-[var(--radius-lg)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ring)]"
              >
                {/* Intrinsic 760x1023 keeps the tall page box reserved; without
                    it four of these landing at once shift the whole section. */}
                <Image
                  src={`/templates/${template.id}.webp`}
                  alt={`The ${template.title} resume template, rendered from a real export`}
                  width={760}
                  height={1023}
                  sizes="(min-width: 1024px) 22vw, 45vw"
                  className="block h-auto w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-white shadow-[var(--shadow-md)] transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transform-none"
                />
                <strong className="mt-4 block text-base text-[var(--fg)]">{template.title}</strong>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-fg)]">{template.note}</p>
              </a>
            </li>
          ))}
        </ul>

        <SampleProvenance
          className="mt-8"
          status="fictional"
          detail="Preview of actual export layouts. The people and employers shown are invented."
        />
      </Container>
    </Section>
  );
}
