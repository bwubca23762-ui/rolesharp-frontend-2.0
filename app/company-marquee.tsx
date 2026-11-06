import { listSeoCompanies } from "@/lib/db";
import { env } from "@/lib/env";
import { listDevCompanies } from "@/lib/local-dev-store";
import { TickerPause } from "./ticker-pause";
import "./company-marquee.css";

/**
 * The company wall on the landing page.
 *
 * Every name is a company RoleSharp actually publishes a guide for, pulled from
 * the same catalog /companies renders, and every pill is a real link to that
 * guide. Nothing here is decorative filler: if the catalog is empty or the
 * database is briefly unavailable the band renders nothing at all rather than
 * showing logos we cannot back up.
 */
export default async function CompanyMarquee() {
  const companies = env.localDevMode
    ? await listDevCompanies(48).catch(() => [])
    : await listSeoCompanies(48).catch(() => []);
  if (companies.length < 8) return null;

  // A short catalog split across two rows reads as two sparse strips with an
  // obvious repeat. Only split once there is enough to fill both.
  const rows = companies.length >= 16
    ? [companies.slice(0, Math.ceil(companies.length / 2)), companies.slice(Math.ceil(companies.length / 2))]
    : [companies];

  return (
    <section className="py-9" aria-labelledby="company-wall-heading">
      {/* Same axis the SocialProofBand below uses (Container size="large"):
          the marquee heading, the coverage stats, and every other section
          heading on this page now share one vertical line instead of each
          band picking its own gutter (usability audit #8/#10). */}
      <div className="mx-auto mb-5 flex w-full max-w-[1280px] flex-wrap items-baseline justify-between gap-x-4 gap-y-2 px-4 sm:px-6 lg:px-8">
        {/* --muted-fg, not the raw palette token: this band sits inside a
            data-canvas="ink" section, and the canvas remaps the alias to
            #9FB0C7 for exactly that reason. Reaching past it for
            --color-text-muted (#52647A) kept the light value on #0A1220 —
            3.09:1, under the 4.5:1 this 12px bold text needs. */}
        {/* Sentence case at heading size: a 44-character all-caps line is a
            paragraph shouting, not a label (usability audit #6/#10). The
            audit also flagged it hugging the viewport edge — the px-4 above
            keeps it inside the band's own gutter on small screens. */}
        <h2
          id="company-wall-heading"
          className="text-sm font-bold tracking-[-0.01em] text-[var(--muted-fg)]"
        >
          Tailor your resume to any of these employers
        </h2>
        <div className="flex items-center gap-4">
          <a
            href="/companies"
            className="text-xs font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            Browse every company guide →
          </a>
          {/* Visible pause for the drift (usability audit #13): hover-to-pause
              never covered touch users. One button holds both rows. */}
          <TickerPause />
        </div>
      </div>

      {rows.map((row, rowIndex) => (
        <div className="rs-ticker" key={rowIndex}>
          {/* One track holding the list twice. Translating it by -50% moves it
              by exactly one copy, so the second half is already in position
              when the first wraps -- that is what makes the loop seamless.
              The duplicate is aria-hidden and untabbable so assistive tech and
              keyboard users meet each company once. */}
          <div
            className="rs-ticker-track"
            data-direction={rowIndex % 2 === 1 ? "reverse" : undefined}
            style={{ ["--rs-ticker-duration" as string]: `${52 + rowIndex * 14}s` }}
          >
            {[false, true].map((isClone) => (
              <div
                key={String(isClone)}
                className="rs-ticker-group"
                data-clone={isClone ? "true" : undefined}
                aria-hidden={isClone || undefined}
              >
                {row.map((company) => (
                  <a
                    key={`${company.slug}-${isClone}`}
                    className="rs-ticker-item"
                    href={`/companies/${company.slug}`}
                    tabIndex={isClone ? -1 : undefined}
                  >
                    {company.name}
                    {company.sector && <span>{company.sector}</span>}
                  </a>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
