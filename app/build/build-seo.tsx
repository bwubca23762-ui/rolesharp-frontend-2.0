import { Container, Section, Card, Button } from "@/components/ui/primitives";
import { env } from "@/lib/env";

const STEPS: [string, string][] = [
  ["Choose a company and role", "Select the employer, target role, and country so the resume is aimed at one real application."],
  ["Paste the job description", "Add the job post so the builder can identify the employer's language, requirements, and important keywords."],
  ["Add real evidence", "Enter your experience, skills, education, projects, and measurable results. RoleSharp does not invent qualifications."],
  ["Review and export", "Review the ATS score and live preview, then export a clean PDF or unlock DOCX on Premium."],
];

export default function BuildSeo() {
  return (
    <main>
      <section className="relative overflow-hidden border-b border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)]">
        <Container className="relative z-10 py-12 md:py-20">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--color-primary-50)] text-[var(--color-primary)] border border-[var(--color-primary-100)] mb-4">
            AI resume builder
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 max-w-3xl">
            Build an ATS resume for one exact job
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
            RoleSharp tailors your resume to a specific company, role, country, and job description. Add your real experience,
            review the keyword match and ATS guidance, then export an application-ready resume.
          </p>
          <Button as="a" href="/build" size="lg">
            Start building
          </Button>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <div className="grid gap-4">
            {STEPS.map(([title, text], index) => (
              <Card key={title} padding="md" variant="elevated">
                <div className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center font-bold text-sm" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-1">
                      {title}
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                      {text}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] text-center">
            Free users get {env.freeMonthlyLimit} tailored {env.freeMonthlyLimit === 1 ? "resume" : "resumes"} per month with PDF export, and earn credits for more by inviting others. You can also use the{" "}
            <a href="/checker" className="font-semibold underline">ATS checker</a>,{" "}
            <a href="/resume-fixer" className="font-semibold underline">resume fixer</a>, or{" "}
            <a href="/resume-maker" className="font-semibold underline">manual resume maker</a> first.
          </p>
        </Container>
      </Section>

    </main>
  );
}
