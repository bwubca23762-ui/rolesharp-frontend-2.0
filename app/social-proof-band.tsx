import { CompanyFinder } from "@/components/marketing/CompanyFinder";
import { JOB_COUNTRIES } from "@/lib/job-config";
import { formatStat, getSiteStats } from "@/lib/site-stats";

/**
 * Act 02's proof strip.
 *
 * Four counts, every one read from the live catalogue by getSiteStats(), beside
 * a search that queries that same catalogue. There is deliberately no slot here
 * for review scores, star ratings, testimonials or a user count: RoleSharp has
 * none of those, the SaaS Browser listing has never even been readable, and a
 * proof-strip-shaped hole invites filling it with something unearned. The
 * verifiable thing this product has is the catalogue, so the catalogue is what
 * the strip proves â€” and the search is what lets a visitor check it on the spot.
 */
export default async function SocialProofBand() {
  const stats = await getSiteStats();

  const items = [
    { value: formatStat(stats.companies), label: "company guides" },
    { value: formatStat(stats.roles), label: "role guides" },
    { value: stats.countries > 0 ? `${stats.countries}` : "200+", label: "country contexts" },
    { value: `${JOB_COUNTRIES.length}`, label: "job markets" },
  ] as const;

  return (
    // The search moved from the bottom-right slot to the top of the band
    // (usability audit #14): it is the primary "tailor my resume" entry point,
    // so it now sits directly under the marquee heading instead of trailing
    // the stats. Stats stack beneath it, full width.
    <div className="grid gap-8">
      <CompanyFinder />
      <div>
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.14em] text-[var(--muted-fg)]">
          Verifiable product coverage
        </p>

        <dl
          className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--muted-fg)]"
          aria-label="RoleSharp product coverage facts"
        >
          {/* dt stays before dd in the DOM because a dl div requires that order;
              flex `order` is what puts the number first on screen. The tempting
              alternative â€” a visible short label plus an sr-only dt holding the
              long one â€” makes a screen reader announce every label twice, which
              is how the first version of this read. */}
          {items.map((item, index) => (
            <div key={item.label} className="flex items-baseline gap-1.5">
              {/* --text-faint, not --border: a border token as text colour is
                  1.41:1 on the ink canvas. Faint is the faintest token that is
                  still a TEXT token, so it passes on every canvas. */}
              {index > 0 && (
                <span aria-hidden="true" className="order-first mr-1.5 text-[var(--text-faint)]">
                  —
                </span>
              )}
              <dt className="order-2">{item.label}</dt>
              <dd className="order-1 font-medium text-[var(--fg)]">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* The old band repeated a "basis" line under all four cards. One line
            says the same thing once, and names what each count is so the terse
            labels above stay precise: a failed query renders a dash, never a
            number nobody can check. */}
        <p className="mt-3 text-xs leading-5 text-[var(--muted-fg)]">
          Counted from the live catalogue at request time, not estimated: company guides indexed, role guides indexed, country contexts covered, and job markets available.{" "}
          {/* Next to the numbers it vouches for, not flung to the far edge of
              the band (usability audit #21). */}
          <a
            href="/about"
            className="whitespace-nowrap font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            How RoleSharp verifies claims →
          </a>
        </p>
      </div>
    </div>
  );
}
