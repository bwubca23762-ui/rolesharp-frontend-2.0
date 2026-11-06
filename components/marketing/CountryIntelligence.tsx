import { Check, Globe, Info } from "@/app/icons";
import { Badge, Button, Card, Container, Notice, Section, SectionHeader } from "@/components/ui/primitives";

const markets = [
  { name: "United States", guidance: "No photo — no date of birth — concise early-career format" },
  { name: "United Kingdom", guidance: "No photo — personal statement common — two pages can be acceptable" },
  { name: "Germany", guidance: "CV conventions vary — photos may be optional — verify employer guidance" },
  { name: "India", guidance: "Skills-forward structure — one to two pages — no photo needed by default" },
  { name: "UAE", guidance: "Employer conventions vary — photos are sometimes used — check the posting" },
  { name: "France", guidance: "Concise CV common — photos can be optional — role context matters" },
] as const;

export function CountryIntelligence() {
  return (
    <Section asContainer={false}>
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start lg:gap-14">
          <div>
            <SectionHeader
              eyebrow="Country intelligence"
              title="Resume conventions change when the market changes."
              description="RoleSharp uses the target country to explain photo, page-length, section, and formatting conventions across 200+ countries and territories."
            />
            <ul className="mt-6 grid gap-3 text-sm text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
              <li className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-emerald-700" /> ATS-safe defaults stay consistent.</li>
              <li className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-emerald-700" /> Guidance is explained, not silently enforced.</li>
              <li className="flex gap-3"><Check size={16} className="mt-0.5 shrink-0 text-emerald-700" /> You remain in control of every local choice.</li>
            </ul>
            <Button as="a" href="/resume-translator" variant="outline" className="mt-7" leftIcon={<Globe size={17} />}>
              Adapt for a country
            </Button>
          </div>
          <div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {markets.map((market) => (
                <Card key={market.name} padding="sm" className="h-full">
                  <Badge variant="neutral">{market.name}</Badge>
                  <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{market.guidance}</p>
                </Card>
              ))}
            </div>
            <Notice variant="neutral" icon={<Info size={18} />} className="mt-4">
              These are general conventions, not legal or employer-specific rules. Always follow the job posting and current local guidance when they differ.
            </Notice>
          </div>
        </div>
      </Container>
    </Section>
  );
}
