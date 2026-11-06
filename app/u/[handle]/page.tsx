import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publishedSiteByHandle } from "@/lib/db/personal-sites";
import { env } from "@/lib/env";
import { getDevPublishedSite } from "@/lib/local-dev-store";
import { normalizeHandle, publicProfile, type PublicProfile } from "@/lib/personal-site";
import JsonLd from "../../json-ld";
import { ResumeContent } from "@/lib/types";
import { Container, MarketingShell, Section } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

async function load(rawHandle: string) {
  const handle = normalizeHandle(decodeURIComponent(rawHandle));
  const row = env.localDevMode
    ? await getDevPublishedSite(handle).catch(() => null)
    : await publishedSiteByHandle(handle).catch(() => null);
  if (!row) return null;
  // The stored content is parsed rather than trusted: this is the one route
  // that renders a document to strangers, and a row written by an older shape
  // must not blow up the page or render half of itself.
  const parsed = ResumeContent.safeParse(row.content);
  if (!parsed.success) return null;
  return {
    row,
    profile: publicProfile(parsed.data, {
      displayName: row.display_name,
      showContact: row.show_contact,
      portfolio: row.portfolio,
      caseStudies: row.case_studies,
    }),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const site = await load(handle);
  if (!site) return { title: "Not found", robots: { index: false, follow: false } };
  return {
    title: `${site.profile.displayName} — ${site.profile.headline}`,
    description: site.profile.summary.slice(0, 160),
    alternates: { canonical: `/u/${site.row.handle}` },
    // Reachable and findable are separate decisions, and only the owner makes
    // the second one. Default is no.
    robots: site.row.indexable ? undefined : { index: false, follow: false },
  };
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold! uppercase tracking-widest text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Profile({ profile }: { profile: PublicProfile }) {
  const contact = [profile.contact.location, profile.contact.email, profile.contact.phone, profile.contact.linkedin]
    .filter(Boolean) as string[];

  return (
    <>
      <h1 className="text-3xl md:text-4xl font-extrabold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
        {profile.displayName}
      </h1>
      <p className="mt-2 text-lg text-[var(--color-primary)] font-medium">{profile.headline}</p>
      {contact.length > 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          {contact.join(" — ")}
        </p>
      ) : null}
      {profile.summary ? (
        <p className="mt-6 max-w-2xl leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
          {profile.summary}
        </p>
      ) : null}

      {profile.skills.length > 0 ? (
        <Group title="Skills">
          <ul className="flex flex-wrap gap-2">
            {profile.skills.map((skill) => (
              <li
                key={skill}
                className="rounded-full border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] px-3 py-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]"
              >
                {skill}
              </li>
            ))}
          </ul>
        </Group>
      ) : null}

      {profile.portfolio.length > 0 ? (
        <Group title="Portfolio">
          <div className="grid gap-4 sm:grid-cols-2">
            {profile.portfolio.map((item, i) => (
              <article
                key={`${item.title}-${i}`}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] p-4"
              >
                <h3 className="font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {item.url ? (
                    // Owner-entered outbound links carry rel="ugc nofollow
                    // noopener": RoleSharp does not vouch for pages it has not
                    // reviewed, and a site that passes ranking signal to
                    // unvetted URLs becomes a link farm.
                    <a href={item.url} rel="ugc nofollow noopener" target="_blank" className="text-[var(--color-primary)] underline">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h3>
                {item.description ? (
                  <p className="mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">
                    {item.description}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </Group>
      ) : null}

      {profile.caseStudies.length > 0 ? (
        <Group title="Case studies">
          <div className="grid gap-6">
            {profile.caseStudies.map((study, i) => (
              <article
                key={`${study.title}-${i}`}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5 dark:border-[var(--color-dark-border)]"
              >
                <h3 className="font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {study.url ? (
                    <a href={study.url} rel="ugc nofollow noopener" target="_blank" className="text-[var(--color-primary)] underline">
                      {study.title}
                    </a>
                  ) : (
                    study.title
                  )}
                </h3>
                <dl className="mt-3 space-y-3">
                  {study.problem ? (
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Problem</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{study.problem}</dd>
                    </div>
                  ) : null}
                  {study.approach ? (
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Approach</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{study.approach}</dd>
                    </div>
                  ) : null}
                  {study.result ? (
                    <div>
                      <dt className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">Result</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{study.result}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </Group>
      ) : null}

      {profile.experiences.length > 0 ? (
        <Group title="Experience">
          <div className="space-y-8">
            {profile.experiences.map((role, i) => (
              <article key={`${role.company}-${role.title}-${i}`}>
                <h3 className="font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {role.title} — {role.company}
                </h3>
                {role.period ? (
                  <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{role.period}</p>
                ) : null}
                <ul className="mt-2 space-y-1.5">
                  {role.bullets.map((bullet, j) => (
                    <li key={j} className="flex gap-3 text-[var(--color-text)] dark:text-[var(--color-dark-text)] leading-relaxed">
                      <span aria-hidden="true" className="text-[var(--color-primary)]">—</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Group>
      ) : null}

      {profile.projects.length > 0 ? (
        <Group title="Projects">
          <div className="space-y-4">
            {profile.projects.map((project, i) => (
              <article key={`${project.name}-${i}`}>
                <h3 className="font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{project.name}</h3>
                <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">{project.detail}</p>
              </article>
            ))}
          </div>
        </Group>
      ) : null}

      {profile.education.length > 0 ? (
        <Group title="Education">
          <div className="space-y-3">
            {profile.education.map((item, i) => (
              <article key={`${item.school}-${i}`}>
                <h3 className="font-semibold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  {item.degree} — {item.school}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  {[item.year, item.detail].filter(Boolean).join(" — ")}
                </p>
              </article>
            ))}
          </div>
        </Group>
      ) : null}

      {profile.certifications.length > 0 ? (
        <Group title="Certifications">
          <ul className="space-y-1 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            {profile.certifications.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Group>
      ) : null}

      {profile.achievements.length > 0 ? (
        <Group title="Achievements">
          <ul className="space-y-1 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            {profile.achievements.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Group>
      ) : null}

      {profile.languages.length > 0 ? (
        <Group title="Languages">
          <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{profile.languages.join(" — ")}</p>
        </Group>
      ) : null}
    </>
  );
}

export default async function PersonalSitePage({ params }: Params) {
  const { handle } = await params;
  const site = await load(handle);
  // An unpublished or unknown handle is the same 404. Distinguishing them would
  // tell a stranger which handles exist but are private.
  if (!site) notFound();

  return (
    <MarketingShell>
      {/* Person schema only when the owner asked to be findable. Handing a
          crawler structured data about somebody who chose noindex is the same
          disclosure by another route. */}
      {site.row.indexable ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              name: site.profile.displayName,
              jobTitle: site.profile.headline,
              description: site.profile.summary,
              // Absolute, for the same reason breadcrumbLd() is: Search
              // Console reports a relative URL here as an invalid item.
              url: new URL(`/u/${site.row.handle}`, `${env.siteUrl}/`).toString(),
              knowsAbout: site.profile.skills,
            },
          }}
        />
      ) : null}
      <Section asContainer={false} size="sm">
        <Container size="small">
          <Profile profile={site.profile} />
          <p className="mt-16 border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)] pt-6 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Published with <Link href="/" className="text-[var(--color-primary)] underline">RoleSharp</Link>.
          </p>
        </Container>
      </Section>
    </MarketingShell>
  );
}
