import "@/components/marketing/public-growth.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui/primitives";
import { ResumeContent } from "@/lib/types";
import { publicProfile } from "@/lib/personal-site";
import { anonymizeForTalentMarketplace, optedInTalentRows, type TalentCard } from "@/lib/talent-marketplace";
import { getDevPublishedSite } from "@/lib/local-dev-store";
import { env } from "@/lib/env";
import TalentIntroForm from "./talent-intro-form";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Talent — Anonymized, Opt-in Only",
  description:
    "Browse anonymized, verified profiles of people who chose to be listed: role, skills, experience, and evidence — no names, no contact details. Intro requests go to the person, who decides.",
  alternates: { canonical: "/talent" },
  robots: { index: false, follow: false },
};

export default async function TalentPage() {
  const rows = env.localDevMode
    ? [await getDevPublishedSite("amina")].filter((site): site is NonNullable<typeof site> => Boolean(site?.published_at)).map((site) => ({
        id: "00000000-0000-4000-8000-00000000000a",
        ats_score: 82,
        verified_ats_score: 82,
        updated_at: new Date().toISOString(),
        content: site.content,
      }))
    : await optedInTalentRows().catch(() => []);

  const cards: TalentCard[] = [];
  for (const row of rows) {
    const parsed = ResumeContent.safeParse(row.content);
    if (!parsed.success) continue;
    const profile = publicProfile(parsed.data, {
      displayName: "Anonymized",
      showContact: false,
      caseStudies: (row as { case_studies?: unknown }).case_studies as never,
    });
    const card = anonymizeForTalentMarketplace(row.id, profile, {
      verifiedAtsScore: row.verified_ats_score ?? row.ats_score ?? null,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    });
    if (card) cards.push(card);
  }

  return (
    <main className="growth-page growth-talent min-h-screen py-10 md:py-16">
      <JsonLd data={breadcrumbLd([{ name: "Home", item: "/" }, { name: "Talent", item: "/talent" }])} />
      <div className="mx-auto max-w-4xl px-4">
        <p className="font-[family-name:var(--font-mono)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
          Anonymized · opt-in only
        </p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)] font-extrabold! leading-[1.05]! tracking-[-0.02em]!">
          Browse opt-in talent
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Browse skills, experience, and work samples from people who chose to be listed. Profiles hide names, contact details, and employer data. Each person decides whether to respond to an introduction request.
        </p>

        {cards.length === 0 ? (
          <Card className="growth-empty mt-10">
            <h2 className="text-lg font-bold!">No one is listed yet</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              The marketplace opens as members opt in from their page settings. If you published your page, you can add
              yourself under <Link href="/settings?tab=website" className="underline">Settings → Personal website</Link>.
            </p>
          </Card>
        ) : (
          <div className="mt-10 grid gap-4">
            {cards.map((card) => (
              <Card key={card.siteId} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="m-0 text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{card.headline}</h2>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                      {card.region ? `${card.region} · ` : ""}{card.yearsExperience > 0 ? `${card.yearsExperience}+ yrs · ` : ""}
                      {card.caseStudyCount > 0 ? `${card.caseStudyCount} case stud${card.caseStudyCount === 1 ? "y" : "ies"}` : "no public case studies"}
                    </p>
                  </div>
                  {card.verifiedAtsScore !== null && (
                    <Badge variant="outline">ATS {card.verifiedAtsScore}</Badge>
                  )}
                </div>
                {card.topSkills.length > 0 && (
                  <p className="mt-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    {card.topSkills.join(" · ")}
                  </p>
                )}
                <div className="mt-4">
                  <TalentIntroForm siteId={card.siteId} headline={card.headline} />
                </div>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-10 text-xs leading-5 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Listed by mistake or changed your mind? Turn the switch off in settings and the card disappears here
          immediately. ATS scores are the member&rsquo;s own resume scores — a rehearsal metric, not a ranking of people.
        </p>
      </div>
    </main>
  );
}
