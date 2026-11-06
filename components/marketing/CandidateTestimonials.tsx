import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/primitives";

const USE_CASES = [
  {
    title: "Before you apply",
    description: "Check your resume against a job description and review missing skills before tailoring it.",
    label: "Check job fit",
    href: "/resume-match",
  },
  {
    title: "When you change roles",
    description: "Identify transferable skills and gaps for the role you want next.",
    label: "Explore skill gaps",
    href: "/skill-gap",
  },
  {
    title: "Before your interview",
    description: "Practise explaining your work with role-specific questions and structured feedback.",
    label: "Prepare for interviews",
    href: "/interview-prep",
  },
] as const;

// Keep the existing export so landing compositions remain compatible. The
// section describes verifiable product uses rather than unsubstantiated outcomes.
export function CandidateTestimonials() {
  return (
    <section id="testimonials" className="border-b border-[var(--hairline)] bg-[var(--surface-2)] py-6 md:py-8">
      <Container size="large">
        <h2 className="text-xl font-extrabold! tracking-tight text-[var(--fg)]">A useful next step at every stage.</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-3 md:gap-8">
          {USE_CASES.map((item) => (
            <article key={item.href} className="border-t border-[var(--border)] pt-3">
              <h3 className="text-base font-semibold text-[var(--fg)]">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-fg)]">{item.description}</p>
              <a href={item.href} className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]">
                {item.label}<ArrowRight size={15} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
