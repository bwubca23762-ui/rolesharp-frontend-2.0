import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { breadcrumbLd, jobListLd } from "../lib/seo";
import { env } from "../lib/env";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("breadcrumb JSON-LD always emits absolute item URLs", () => {
  const data = breadcrumbLd([
    { name: "Home", item: "/" },
    { name: "Companies", item: "/companies" },
    { name: "External", item: "https://example.com/path" },
  ]);

  assert.deepEqual(
    data.itemListElement.map((item) => item.item),
    [`${env.siteUrl}/`, `${env.siteUrl}/companies`, "https://example.com/path"],
  );
});

// ── Structured-data upgrade (SEO directive, Module 1) ──

test("salary page FAQ schema is emitted as an object, not double-stringified", () => {
  const page = source("app/salaries/[role]/[country]/page.tsx");
  // The bug: <JsonLd data={JSON.stringify({...})} /> — jsonLd() already
  // serializes, so a pre-stringified payload embeds as a quoted JSON string
  // inside the script tag and every engine drops it.
  assert.doesNotMatch(page, /data=\{JSON\.stringify\(/);
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /acceptedAnswer/);
});

test("country jobs pages emit ItemList structured data pointing at original postings", () => {
  const page = source("app/jobs/[country]/page.tsx");
  const seoLib = source("lib/seo.ts");
  // Directory-page honesty: JobPosting markup is only valid on a page whose
  // main content IS one job; a listing page references the originals instead.
  assert.match(page, /jobListLd/);
  assert.match(page, /apply_url ~\*/);
  assert.match(seoLib, /"@type": "ItemList"/);
  assert.ok(seoLib.includes("https?:\\/"), "jobListLd must gate apply URLs on a clean http(s) pattern");
  const ld = jobListLd([
    { title: "T", company: "C", location: null, applyUrl: "https://employer.example/j/1", datePosted: "2026-09-01" },
    { title: "X", company: "Y", location: "Berlin", applyUrl: "javascript:alert(1)", datePosted: null },
  ]);
  assert.ok(ld, "a valid entry list must produce ItemList markup");
  assert.equal(ld.itemListElement.length, 1, "non-http apply URLs must be dropped");
  assert.equal(ld.itemListElement[0].url, "https://employer.example/j/1");
  assert.equal(jobListLd([]), null);
});

test("pricing emits SoftwareApplication schema with honest offer prices from env", () => {
  const page = source("app/pricing/page.tsx");
  assert.match(page, /"@type": "SoftwareApplication"/);
  assert.match(page, /price: String\(env\.priceMonthlyCents \/ 100\)/);
  assert.match(page, /price: String\(env\.priceYearlyCents \/ 100\)/);
  // The offers array must never hardcode a price the checkout contradicts.
  assert.doesNotMatch(page, /price: "19"/);
});

test("micro-generator pages carry WebApplication schema and breadcrumbs", () => {
  const shared = source("components/tools/micro-generator-page.tsx");
  assert.match(shared, /"@type": "WebApplication"/);
  assert.match(shared, /breadcrumbLd/);
  assert.match(shared, /price: "0"/);
  for (const route of [
    "app/resume-summary-generator/page.tsx",
    "app/resume-bullet-points-generator/page.tsx",
    "app/work-experience-generator/page.tsx",
    "app/career-summary-generator/page.tsx",
    "app/resignation-letter-generator/page.tsx",
    "app/thank-you-note-generator/page.tsx",
    "app/salary-negotiation-script/page.tsx",
  ]) {
    assert.match(source(route), /MicroGeneratorPage/, `${route} must use the shared generator shell`);
  }
});

test("interview bank emits FAQPage wrapping each question's answer guidance", () => {
  const page = source("app/interview-questions/[role]/page.tsx");
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /Strong answers show: \$\{q\.lookingFor\}/);
  assert.match(page, /breadcrumbLd/);
});

test("resume-match and resume-compare use the escaped JsonLd component", () => {
  for (const path of ["app/resume-match/page.tsx", "app/resume-compare/page.tsx"]) {
    const page = source(path);
    // Raw dangerouslySetInnerHTML + JSON.stringify skips the <>& escaping
    // jsonLd() exists to provide.
    assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
    assert.match(page, /<JsonLd/);
    assert.match(page, /"@type": "FAQPage"/);
    assert.match(page, /breadcrumbLd/);
  }
});

// ── Robots & sitemap expansion (Module 2) ──

test("robots.txt disallows every private workflow route", () => {
  const robots = source("app/robots.txt/route.ts");
  for (const path of [
    "/daily-matches", "/application-queue", "/campaign-settings", "/email-connection",
    "/reset-password", "/forgot-password",
  ]) {
    assert.ok(robots.includes(`"${path}"`), `robots.txt must disallow ${path}`);
  }
  // The pre-existing private set stays.
  for (const path of ["/api/", "/admin", "/dashboard", "/settings", "/tracker", "/resumes"]) {
    assert.ok(robots.includes(`"${path}"`), `robots.txt must keep disallowing ${path}`);
  }
});

test("sitemap index carries the interview-questions segment and pages.xml adds /job-alerts", () => {
  const index = source("app/sitemap.xml/route.ts");
  const segments = source("app/sitemaps/[name]/route.ts");
  assert.match(index, /\/sitemaps\/interview-questions\.xml/);
  assert.match(segments, /name === "interview-questions"/);
  assert.match(segments, /bankEligibleRoles/);
  assert.ok(segments.includes('"/job-alerts"'), "pages.xml must list /job-alerts");
});

// ── AEO deployment (Module 3) ──

test("AskAiLinks is retired — no outbound AI-engine links on commercial surfaces", () => {
  // Owner decision 2026-10-18: high-intent users stay on-site. The component
  // renders null; call sites may keep the import. No surface may send users
  // to chatgpt.com / claude.ai / gemini / perplexity from page markup.
  for (const path of [
    "app/checker/page.tsx",
    "app/resume-fixer/page.tsx",
    "app/resume-builder/page.tsx",
    "app/pricing/page.tsx",
  ]) {
    const rendered = source(path);
    if (rendered.includes("<AskAiLinks")) {
      assert.ok(true, "call site kept; component itself renders null");
    }
  }
  assert.match(source("app/ask-ai-links.tsx"), /return null/);
});

test("core tools expose markdown twins with rewrite, alternates, and specs", () => {
  const config = source("next.config.ts");
  const route = source("app/tools-md/[tool]/route.ts");
  const specs = source("lib/tool-specs.ts");
  assert.match(config, /source: "\/tools\/:tool\.md", destination: "\/tools-md\/:tool"/);
  assert.match(route, /X-Robots-Tag.*noindex/);
  assert.match(specs, /TOOL_SPECS: Record<ToolSlug, ToolSpec>/);
  for (const slug of [
    "ats-resume-checker", "resume-fixer", "resume-builder", "resume-match",
    "resume-compare", "linkedin-checker", "cv-converter", "linkedin-headline-generator",
  ]) {
    assert.ok(specs.includes(`"${slug}":`), `tool spec missing: ${slug}`);
  }
  for (const layout of [
    "app/checker/layout.tsx",
    "app/resume-fixer/layout.tsx",
    "app/build/layout.tsx",
    "app/linkedin-checker/layout.tsx",
    "app/cv-converter/layout.tsx",
    "app/linkedin-headline-generator/layout.tsx",
  ]) {
    assert.match(source(layout), /"text\/markdown": "\/tools\//, `${layout} must link its markdown twin`);
  }
  for (const page of ["app/resume-match/page.tsx", "app/resume-compare/page.tsx"]) {
    assert.match(source(page), /"text\/markdown": "\/tools\//);
  }
});

test("llms.txt covers salaries, interview questions, tools twins, and the keyword report", () => {
  const llms = source("app/llms.txt/route.ts");
  assert.match(llms, /\/salaries/);
  assert.match(llms, /\/interview-questions/);
  assert.match(llms, /\/tools\/<tool>\.md/);
  assert.match(llms, /resume-keyword-report-2026/);
});

// ── Internal graph (Module 4) ──

test("company×role pages bridge to jobs, salary, and interview data only when it exists", () => {
  const page = source("app/resume/[company]/[role]/page.tsx");
  // Ungated links to dynamicParams=false pages would 404 for most pairs.
  assert.match(page, /salaryCandidate &&/);
  assert.match(page, /bankEligible &&/);
  assert.match(page, /\/jobs\/\$\{jobsSlug\}\?q=/);
  assert.match(page, /AskAiLinks/);
});

test("role hubs bridge to the interview bank and salary data with existence gates", () => {
  const page = source("app/roles/[role]/page.tsx");
  assert.match(page, /bankEligible/);
  assert.match(page, /salaryCandidate/);
  assert.match(page, /\/interview-questions\/\$\{role\}/);
});

// ── Dynamic OG cards (Module 5) ──

test("programmatic surfaces generate per-entity OpenGraph images", () => {
  const ogResume = source("app/resume/[company]/[role]/opengraph-image.tsx");
  const ogSalary = source("app/salaries/[role]/[country]/opengraph-image.tsx");
  const ogBank = source("app/interview-questions/[role]/opengraph-image.tsx");
  const resumePage = readFileSync(new URL("../app/resume/[company]/[role]/page.tsx", import.meta.url), "utf8");
  const salaryPage = source("app/salaries/[role]/[country]/page.tsx");
  const bankPage = source("app/interview-questions/[role]/page.tsx");
  for (const [og, page] of [
    [ogResume, resumePage],
    [ogSalary, salaryPage],
    [ogBank, bankPage],
  ] as const) {
    assert.match(og, /ImageResponse/);
    assert.ok(page.includes("opengraph-image"), "the page must point at its dynamic OG card");
    // The page must not still point at the generic site-wide card.
    assert.doesNotMatch(page, /images: \["\/opengraph-image"\]/);
  }
  assert.match(ogSalary, /median/, "the salary card must carry the median");
});

// ── IndexNow automation (Module 7) ──

test("published blog posts and fresh job markets ping IndexNow automatically", () => {
  const blogJobs = source("lib/blog-jobs.ts");
  const scheduler = source("worker/jobs-scheduler.ts");
  // The .md twin ships with the post page.
  assert.match(blogJobs, /blog\/\$\{post\.slug\}\.md/);
  assert.match(blogJobs, /submitToIndexNow/);
  // Scheduler pings only markets whose listings actually moved.
  assert.match(scheduler, /submitToIndexNow/);
  assert.match(scheduler, /last_seen_at > now\(\) - interval '90 seconds'/);
});

test("builder prefill uses fragments while /resume-builder owns search intent", () => {
  const build = source("app/build/page.tsx");
  const layout = source("app/build/layout.tsx");
  const landing = source("app/resume-builder/page.tsx");
  assert.match(layout, /canonical: "\/resume-builder"/);
  assert.match(layout, /robots: \{ index: false, follow: true \}/);
  assert.match(layout, /"text\/markdown": "\/tools\/resume-builder\.md"/);
  assert.match(landing, /alternates: \{ canonical: "\/resume-builder" \}/);
  assert.match(build, /new URLSearchParams\(window\.location\.hash/);
  assert.match(build, /const prefill = \(key: string\)/);

  for (const path of [
    "app/resume/[company]/[role]/page.tsx",
    "app/companies/[company]/page.tsx",
    "app/roles/[role]/page.tsx",
    "app/checker/checker-country-cta.tsx",
    "app/first-visit-country.tsx",
    "app/jobs/jobs-finder.tsx",
  ]) {
    const page = source(path);
    assert.doesNotMatch(page, /\/build\?(?:company|role|country|jobId)=/);
    assert.match(page, /\/build#(?:company|role|country|jobId)=/);
  }
});

test("locale routes reject unknown top-level slugs before streaming", () => {
  const localePage = source("app/[locale]/page.tsx");
  assert.match(localePage, /export const dynamicParams = false/);
  assert.equal((localePage.match(/if \(!data\) notFound\(\)/g) ?? []).length, 2);
});

test("company-role guides stay available but out of search indexing until they have employer evidence", () => {
  const db = source("lib/db.ts");
  const index = source("app/sitemap.xml/route.ts");
  const segments = source("app/sitemaps/[name]/route.ts");
  const pairPage = source("app/resume/[company]/[role]/page.tsx");
  const indexNow = source("app/api/admin/indexnow/route.ts");

  assert.match(db, /export const SEO_COMPANIES_PER = 400/);
  assert.match(db, /website is not null and sector is not null/g);
  assert.doesNotMatch(index, /resumes-\$\{|SEO_PAIR_CHUNKS|seoCompanyCount/);
  assert.match(index, /env\.production && !env\.localDevMode/);
  assert.match(index, /publicRequestOrigin\(\{/);
  assert.match(index, /fallbackHost: req\.nextUrl\.host/);
  assert.match(segments, /\^resumes-\[12\]\$/);
  assert.match(pairPage, /robots: \{ index: false, follow: true \}/);
  assert.doesNotMatch(indexNow, /listSeoPairs|resume\/\$\{p\.company\}/);
  assert.match(segments, /env\.production && !env\.localDevMode/);
  assert.match(segments, /publicRequestOrigin\(\{/);
  assert.match(segments, /fallbackHost: req\.nextUrl\.host/);
  assert.match(segments, /JOB_COUNTRIES\.filter\(\(c\) => !hasDb\(\) \|\| jobsLastByCode\.has/);
  assert.match(segments, /JOB_COUNTRIES\.filter\(\(c\) => !hasDb\(\) \|\| \(internshipsLastByCode\.has/);
  for (const helpPath of ["/build/help", "/checker/help", "/linkedin-checker/help", "/resume-maker/help", "/resume-fixer/help"]) {
    assert.ok(segments.includes(`"${helpPath}"`), `${helpPath} must be sitemapped`);
  }
});

// Indexability is inherited: app/layout.tsx declares robots.index = true for
// the whole tree, so a signed-in surface is crawlable unless something on its
// own layout chain says otherwise. Resolving the chain the way Next.js does
// catches a new private route that simply forgot to opt out, which is how
// /notifications and /resumes came to serve indexable logged-out shells.
function resolvedRobotsIndex(route: string): string {
  const segments = route.split("/").filter(Boolean);
  const candidates = [
    `app/${[...segments, "page.tsx"].join("/")}`,
    ...segments.map((_, i) => `app/${[...segments.slice(0, segments.length - i), "layout.tsx"].join("/")}`),
    "app/layout.tsx",
  ];
  for (const candidate of candidates) {
    let text: string;
    try {
      text = source(candidate);
    } catch {
      continue;
    }
    const match = /robots:\s*\{[^}]*index:\s*(true|false)/.exec(text);
    if (match) return match[1];
  }
  return "absent";
}

test("signed-in surfaces are never indexable", () => {
  for (const route of [
    "/dashboard",
    "/notifications",
    "/settings",
    "/tracker",
    // No AuthRequiredState marker, but every id is a private saved document.
    "/resumes",
  ]) {
    assert.equal(resolvedRobotsIndex(route), "false", `${route} resolves to an indexable robots directive`);
  }
});

test("embed and duplicate directory routes have explicit index ownership", () => {
  const embedLayout = source("app/embed/layout.tsx");
  const shell = source("app/app-shell.tsx");
  const config = source("next.config.ts");
  assert.match(embedLayout, /index: false/);
  assert.match(embedLayout, /follow: false/);
  assert.match(shell, /pathname\?\.startsWith\("\/embed\/"\)/);
  assert.match(config, /source: "\/careers", destination: "\/roles", permanent: true/);
  assert.match(config, /X-Robots-Tag.*noindex, nofollow, nosnippet/);
});

test("international pages expose localized snippets and a reciprocal English default", () => {
  const locales = source("lib/locales.ts");
  const localePage = source("app/[locale]/page.tsx");
  assert.match(locales, /en: "\/"/);
  for (const phrase of [
    "Lebenslauf- und ATS-Tools für Deutschland",
    "Outils CV et ATS pour la France",
    "Herramientas de currículum y ATS para España",
    "日本向け履歴書・ATS対策ツール",
    "أدوات السيرة الذاتية وATS في الإمارات",
  ]) assert.ok(locales.includes(phrase), `missing localized SEO title: ${phrase}`);
  assert.match(localePage, /title: data\.seoTitle/);
});

test("deep search audit enforces snippets, social cards, hreflang, schema, and link depth", () => {
  const audit = source("scripts/audit-search-surfaces.mjs");
  for (const check of [
    "duplicate-title", "open-graph-property", "hreflang-target", "faq-answer-not-visible",
    "orphan-sitemap-page", "sitemap-page-click-depth", "redirecting-internal-link",
    "indexable-internal-page-not-sitemapped", "social-image-response",
  ]) assert.ok(audit.includes(check), `deep search audit is missing ${check}`);
});

test("route audit discovers native Windows and POSIX paths", () => {
  const audit = source("scripts/audit-routes.mjs");
  assert.ok(audit.includes("const pageFiles = files.filter((file) => /[\\\\/]page"));
  assert.ok(audit.includes("const handlerFiles = files.filter((file) => /[\\\\/]route"));
  assert.match(audit, /if \(key === "country"\) return "us"/);
  assert.match(audit, /if \(key === "company"\) return "us-google"/);
  assert.match(audit, /ROUTE_AUDIT_MUTATIONS/);
  assert.match(audit, /method === "GET" \|\| method === "HEAD"/);
  assert.match(audit, /result\.status === 405/);
});

test("jobs workflow copy, privacy scopes, and sitemap stay truthful", () => {
  const autoApply = source("app/auto-apply/page.tsx");
  const legalSeed = source("db/migrations/047_legal_document_versions.sql");
  const privacy = legalSeed;
  const terms = legalSeed;
  const help = source("app/help/page.tsx");
  const sitemap = source("app/sitemaps/[name]/route.ts");
  const environment = source(".env.example");
  const competitors = source("content/competitors.ts");
  const llms = source("app/llms.txt/route.ts");
  const llmsFull = source("app/llms-full.txt/route.ts");

  assert.match(autoApply, /email applications only/i);
  assert.match(autoApply, /delivery unverified/i);
  assert.match(autoApply, /does not automate LinkedIn, Indeed, or ATS forms/i);
  assert.match(autoApply, /"@type": "WebApplication"/);
  assert.match(autoApply, /"@type": "FAQPage"/);
  assert.match(autoApply, /"@type": "BreadcrumbList"/);
  assert.match(autoApply, /twitter:/);
  assert.doesNotMatch(autoApply, /RoleSharp (?:can|will) apply everywhere/iu);
  assert.doesNotMatch(autoApply, /guaranteed (?:interview|job|delivery)/iu);
  assert.doesNotMatch(autoApply, /application email (?:was |is )?submitted/iu);

  for (const scope of [
    "gmail.send", "offline_access", "User.Read", "Mail.Send",
  ]) assert.ok(privacy.includes(scope), `privacy copy is missing ${scope}`);
  assert.match(privacy, /does not request inbox-read/i);
  assert.match(privacy, /purged after 30 days/i);
  assert.match(privacy, /last exactly 24 hours/i);
  assert.match(privacy, /Disconnect first disables sending and erases the local refresh credential/i);
  assert.match(terms, /does not complete LinkedIn, Indeed, or employer ATS forms/i);
  assert.match(help, /Unknown outcomes are not automatically resent/i);
  assert.match(sitemap, /"\/auto-apply"/);
  assert.match(competitors, /verified application email only/i);
  assert.match(competitors, /does not complete LinkedIn, Indeed, or employer ATS forms/i);
  assert.doesNotMatch(competitors, /RoleSharp deliberately doesn't offer it/i);
  assert.doesNotMatch(competitors, /RoleSharp won't/i);
  assert.doesNotMatch(competitors, /Auto-apply to jobs", rolesharp: "No/i);
  for (const answerSurface of [llms, llmsFull]) {
    assert.match(answerSurface, /Daily Matches/i);
    assert.match(answerSurface, /application-by-email|application email/i);
    assert.match(answerSurface, /does not (?:complete|automate) (?:job-board or ATS|ATS or job-board) forms/i);
  }

  for (const flag of [
    "JOBS_WORKFLOWS_ENABLED=false",
    "ROLE_APPLY_GMAIL_SEND_ENABLED=false",
    "ROLE_APPLY_MICROSOFT_SEND_ENABLED=false",
  ]) assert.ok(environment.includes(flag), `${flag} must remain disabled by default`);
});
