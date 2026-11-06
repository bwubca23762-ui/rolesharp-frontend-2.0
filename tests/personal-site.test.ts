import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanPortfolio, HANDLE_MESSAGES, handleError, normalizeHandle, PORTFOLIO_MAX, publicProfile, safeUrl, SITE_DEFAULTS } from "../lib/personal-site";

const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const RESUME = {
  headline: "Senior Product Designer",
  contact: {
    email: "amina@example.com",
    phone: "+49 30 000000",
    location: "Berlin, Germany",
    linkedin: "linkedin.com/in/amina",
    links: ["https://portfolio.example.com"],
  },
  summary: "Product designer working on billing and onboarding.",
  skills: ["Design systems"],
  experiences: [{ title: "Senior Product Designer", company: "Northwind", period: "2023 — present", bullets: ["Cut failed renewals by 18%."] }],
  education: [{ degree: "BA Interaction Design", school: "University of Leeds", year: "2018" }],
  projects: [],
  certifications: [],
  languages: ["English — native"],
  achievements: [],
};

test("contact details are withheld unless the owner switched them on", () => {
  // The single most important assertion in this file. A resume carries an
  // email, a phone number and a home city, and this is the one route that puts
  // them where a stranger can read them.
  const profile = publicProfile(RESUME, { displayName: "Amina Osei", showContact: false });
  assert.deepEqual(profile.contact, {});
  const serialised = JSON.stringify(profile);
  for (const secret of ["amina@example.com", "+49 30 000000", "Berlin, Germany", "linkedin.com/in/amina", "portfolio.example.com"]) {
    assert.ok(!serialised.includes(secret), `${secret} reached the public profile`);
  }
});

test("the work history is public either way — that is what the page is for", () => {
  const profile = publicProfile(RESUME, { displayName: "Amina Osei", showContact: false });
  assert.equal(profile.experiences[0].company, "Northwind");
  assert.equal(profile.summary, RESUME.summary);
  assert.equal(profile.displayName, "Amina Osei");
});

test("switching contact on shows exactly the contact fields", () => {
  const profile = publicProfile(RESUME, { displayName: "Amina Osei", showContact: true });
  assert.equal(profile.contact.email, "amina@example.com");
  assert.equal(profile.contact.location, "Berlin, Germany");
});

test("a contact field added later is hidden by default, not leaked", () => {
  // publicProfile rebuilds the contact object instead of deleting from it, so
  // extending the resume shape cannot quietly publish a new field.
  const withExtra = { ...RESUME, contact: { ...RESUME.contact, homeAddress: "12 Somewhere St" } } as typeof RESUME;
  const profile = publicProfile(withExtra, { displayName: "Amina Osei", showContact: true });
  assert.ok(!JSON.stringify(profile).includes("12 Somewhere St"));
});

test("every default is the private one", () => {
  assert.deepEqual(SITE_DEFAULTS, { showContact: false, indexable: false, published: false });
  const migration = source("db/migrations/052_personal_sites.sql");
  assert.match(migration, /show_contact boolean not null default false/);
  assert.match(migration, /indexable boolean not null default false/);
});

test("handles are validated, and the route table is not claimable", () => {
  assert.equal(handleError("amina"), null);
  assert.equal(handleError("amina-osei"), null);
  assert.equal(handleError("ab"), "too_short");
  assert.equal(handleError("a".repeat(31)), "too_long");
  assert.equal(handleError("amina osei"), "bad_characters");
  assert.equal(handleError("amina.osei"), "bad_characters");
  assert.equal(handleError("-amina"), "bad_edges");
  assert.equal(handleError("amina--osei"), "bad_edges");
  // Claiming /u/admin or /u/support is impersonation with a tidy URL.
  for (const reserved of ["admin", "api", "settings", "support", "login", "rolesharp"]) {
    assert.equal(handleError(reserved), "reserved", `${reserved} was claimable`);
  }
  for (const key of Object.keys(HANDLE_MESSAGES)) assert.ok(HANDLE_MESSAGES[key as keyof typeof HANDLE_MESSAGES].length > 0);
});

test("handles fold to one case, so two people cannot hold the same name", () => {
  assert.equal(normalizeHandle("  Amina  "), "amina");
  assert.equal(handleError("AMINA"), null);
});

test("the public query filters on published in the WHERE, not after the fetch", () => {
  const db = source("lib/db/personal-sites.ts");
  assert.match(db, /where s\.handle = \$1 and s\.published_at is not null/);
  // The upsert selects the resume by id AND owner, so another account's resume
  // id matches no row rather than being published under this handle.
  assert.match(db, /from resumes r where r\.id = \$3 and r\.user_id_text = \$1/);
});

test("an unpublished handle is the same 404 as an unknown one", () => {
  // Two different responses would tell a stranger which handles exist privately.
  const page = source("app/u/[handle]/page.tsx");
  assert.match(page, /if \(!site\) notFound\(\)/);
  assert.match(page, /robots: site\.row\.indexable \? undefined : \{ index: false, follow: false \}/);
});

test("the page renders only what publicProfile returned", () => {
  // If the page reached into row.content directly, every redaction above would
  // be advisory. It must render the returned profile and nothing else.
  const page = source("app/u/[handle]/page.tsx");
  assert.ok(!/row\.content\./.test(page), "the page reads stored content directly");
  // The property, not the formatting: publicProfile is handed the parsed
  // resume and the owner's own switches, and the page renders its return.
  const call = page.match(/publicProfile\(parsed\.data, \{[\s\S]*?\}\)/)?.[0] ?? "";
  assert.match(call, /showContact: row\.show_contact/);
  assert.match(call, /displayName: row\.display_name/);
});

test("a portfolio link that is not http(s) loses the link, not the item", () => {
  // Owner-entered text rendered on a public page: javascript: and data: URLs
  // are the hazard, and a scheme allowlist is the only check that cannot be
  // talked around with encoding.
  assert.equal(safeUrl("javascript:alert(1)"), undefined);
  assert.equal(safeUrl("data:text/html,<script>"), undefined);
  assert.equal(safeUrl("  example.com/work "), "https://example.com/work");
  assert.equal(safeUrl("https://example.com/a"), "https://example.com/a");

  const [item] = cleanPortfolio([{ title: "My case study", url: "javascript:alert(1)" }]);
  assert.equal(item.title, "My case study");
  assert.equal(item.url, undefined, "an unsafe URL survived into the profile");
});

test("the portfolio is bounded and drops untitled rows", () => {
  const many = Array.from({ length: PORTFOLIO_MAX + 5 }, (_, i) => ({ title: `Item ${i}` }));
  assert.equal(cleanPortfolio(many).length, PORTFOLIO_MAX);
  assert.equal(cleanPortfolio([{ title: "   " }, { title: "Real" }]).length, 1);
  assert.deepEqual(cleanPortfolio(null), []);
});

test("the portfolio is cleaned again on the way out, not only on the way in", () => {
  // A row written before this validation existed, or by any other path, must
  // still not render an unsafe link.
  const profile = publicProfile(RESUME, {
    displayName: "Amina Osei",
    showContact: false,
    portfolio: [{ title: "Stored earlier", url: "javascript:alert(1)" }],
  });
  assert.equal(profile.portfolio[0].url, undefined);
});

test("outbound portfolio links do not pass ranking signal", () => {
  // A site that vouches for unvetted user-submitted URLs becomes a link farm.
  const page = source("app/u/[handle]/page.tsx");
  assert.match(page, /rel="ugc nofollow noopener"/);
});

test("published means reachable; only indexable reaches a crawler", () => {
  // The difference between the two switches is the whole privacy contract. The
  // directory and the sitemap must both filter on indexable, in the WHERE.
  const db = source("lib/db/personal-sites.ts");
  assert.match(db, /where s\.published_at is not null and s\.indexable/);

  const sitemap = source("app/sitemaps/[name]/route.ts");
  assert.match(sitemap, /indexableSites\(\)/);
  assert.ok(!/publishedSiteByHandle/.test(sitemap), "the sitemap can reach unlisted pages");

  const directory = source("app/u/page.tsx");
  assert.match(directory, /indexableSites|listDevIndexableSites/);

  // Person schema is gated too: handing a crawler structured data about
  // somebody who chose noindex is the same disclosure by another route.
  assert.match(source("app/u/[handle]/page.tsx"), /site\.row\.indexable \? \(\s*<JsonLd/);
});

test("the owner route checks origin, session and rate limit before writing", () => {
  const route = source("app/api/personal-site/route.ts");
  assert.match(route, /if \(!user\) return NextResponse\.json\(\{ error: "login_required" \}, \{ status: 401 \}\)/);
  assert.match(route, /mutationOriginAllowed/);
  assert.match(route, /rateLimit\(req, "personal-site"/);
  assert.match(route, /handle_taken/);
});

test("case studies are capped, html-stripped, url-gated, and rendered only after the same cleaning", async () => {
  const { cleanCaseStudies, CASE_STUDY_MAX } = await import("../lib/personal-site");
  const many = Array.from({ length: CASE_STUDY_MAX + 3 }, (_, i) => ({ title: `Study ${i}`, problem: "p", approach: "a", result: "r" }));
  assert.equal(cleanCaseStudies(many).length, CASE_STUDY_MAX);
  // HTML-ish input is stripped, not escaped-and-kept.
  const [dirty] = cleanCaseStudies([{ title: "<b>Billing</b> revamp", result: "cut renewals <script>alert(1)</script> by 18%" }]);
  assert.equal(dirty.title, "Billing revamp");
  assert.ok(!dirty.result.includes("<script>"));
  // A javascript: proof link is dropped, not kept.
  const [safe] = cleanCaseStudies([{ title: "S", url: "javascript:alert(1)" }]);
  assert.equal(safe.url, undefined);
  // Untitled entries are dropped entirely.
  assert.equal(cleanCaseStudies([{ title: "  ", problem: "p" }]).length, 0);
  // The public profile gate cleans case studies the same way it cleans portfolio.
  const { publicProfile } = await import("../lib/personal-site");
  const profile = publicProfile(
    { skills: [], experiences: [], education: [], projects: [], certifications: [], languages: [], achievements: [], headline: "", summary: "" } as never,
    { displayName: "A", showContact: false, caseStudies: [{ title: "<i>X</i>", problem: "", approach: "", result: "" }] },
  );
  assert.equal(profile.caseStudies[0]?.title, "X");
  // The public page renders the cleaned list; the API persists the cleaned list.
  const page = source("app/u/[handle]/page.tsx");
  assert.match(page, /caseStudies: row\.case_studies/u);
  assert.match(page, /profile\.caseStudies/u);
  const route = source("app/api/personal-site/route.ts");
  assert.match(route, /cleanCaseStudies\(parsed\.data\.caseStudies\)/u);
});
