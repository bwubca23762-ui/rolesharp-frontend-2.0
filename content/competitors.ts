// Competitor data for /compare/rolesharp-vs-* pages. Static marketing content —
// every claim here must stay defensible: sourced from public pricing pages and
// public review platforms, re-checked when competitors change plans. Claims with
// structured evidence fail closed when disputed, stale, or past reviewBy.

export type CompetitorEvidence = {
  id: string;
  claim: string;
  sourceUrl: string;
  capturedAt: string;
  locale: string;
  evidenceType: "first-party-page" | "checkout-observation" | "third-party-review" | "product-test";
  volatility: "low" | "medium" | "high";
  reviewBy: string;
  owner: string;
  status: "verified" | "qualified" | "disputed" | "stale" | "removed";
  notes?: string;
};

type CompareRow = {
  feature: string;
  rolesharp: string;
  them: string;
  /** who this row favors, for the verdict count */
  winner: "us" | "them" | "tie";
  evidenceIds?: string[];
};

export type Competitor = {
  slug: string; // full route slug, e.g. "rolesharp-vs-aiapply"
  name: string;
  shortName: string;
  title: string; // page <title>
  description: string; // meta description
  h1: string;
  intro: string; // opening paragraph under the h1
  verdict: string; // one-paragraph honest verdict
  rows: CompareRow[];
  themWins: { heading: string; body: string }[]; // honest credit where due
  usWins: { heading: string; body: string }[];
  pricingProse: string;
  // Price-bearing H2 ("Pricing: RoleSharp $12/mo vs X $29/mo") — numbers in
  // the heading are what SERP jump-links and AI answers extract.
  pricingHeading: string;
  faqs: [string, string][];
  evidence?: CompetitorEvidence[];
  sourcesNote: string;
};

function currentDateIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateValue(value: string): number {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) ? time : Number.NaN;
}

export function isCompetitorEvidenceCurrent(
  evidence: CompetitorEvidence,
  asOf = currentDateIso(),
): boolean {
  if (evidence.status !== "verified" && evidence.status !== "qualified") return false;
  const reviewBy = dateValue(evidence.reviewBy);
  const current = dateValue(asOf);
  return Number.isFinite(reviewBy) && Number.isFinite(current) && reviewBy >= current;
}

export function rowHasCurrentEvidence(
  competitor: Competitor,
  row: CompareRow,
  asOf = currentDateIso(),
): boolean {
  if (!row.evidenceIds?.length) return true;
  const evidence = new Map((competitor.evidence ?? []).map((item) => [item.id, item]));
  return row.evidenceIds.every((id) => {
    const item = evidence.get(id);
    return item ? isCompetitorEvidenceCurrent(item, asOf) : false;
  });
}

export function comparisonWinnerCounts(competitor: Competitor, asOf = currentDateIso()) {
  return competitor.rows.reduce(
    (counts, row) => {
      if (!rowHasCurrentEvidence(competitor, row, asOf)) return counts;
      counts.comparable += 1;
      if (row.winner === "us") counts.us += 1;
      if (row.winner === "them") counts.them += 1;
      return counts;
    },
    { us: 0, them: 0, comparable: 0 },
  );
}

export function competitorEvidenceLastChecked(competitor: Competitor): string {
  const captures = (competitor.evidence ?? [])
    .map((item) => item.capturedAt)
    .filter(Boolean)
    .sort();
  return captures.at(-1) ?? "2026-07";
}

export const COMPETITORS: Competitor[] = [
  {
    slug: "rolesharp-vs-aiapply",
    name: "AIApply",
    shortName: "AIApply",
    title: "RoleSharp vs AIApply (2026) — Pricing, Features & Trust Compared",
    description:
      "AIApply costs $29/mo plus auto-apply credits; RoleSharp is $12/mo with a real free tier. An honest side-by-side of features, pricing transparency, and user reviews.",
    h1: "RoleSharp vs AIApply",
    intro:
      "AIApply bundles broad auto-apply, a resume builder, cover letters, and interview practice into one subscription. RoleSharp focuses on controlled workflows: company-and-role tailoring, evidence-based matching, Daily Matches, and application email only when a posting explicitly publishes a recipient and says to apply by email.",
    verdict:
      "If you want software to mass-submit through job boards and ATS forms, AIApply is built around that; RoleSharp does not automate those flows. RoleSharp Apply is narrower: it can send a reviewed or time-limited authorized package only when the stored posting explicitly accepts email applications and exposes the recipient. For building, tailoring, and scoring a resume, RoleSharp gives you more for free, costs less than half as much when you upgrade, and shows you the price before checkout. AIApply's public review record (an F rating at the Better Business Bureau and a Trustpilot integrity warning as of July 2026) is worth reading before you enter a card.",
    rows: [
      { feature: "Free tier", rolesharp: "1 tailored resume every month, unlimited ATS checks, no card", them: "Limited trial; most features gated behind checkout", winner: "us" },
      { feature: "Premium price", rolesharp: "$12/mo · $79/yr", them: "$29/mo base; auto-apply credits sold separately ($74–149/mo all-in)", winner: "us" },
      { feature: "Pricing shown before signup", rolesharp: "Yes — public pricing page", them: "No — revealed at checkout", winner: "us" },
      { feature: "Application automation", rolesharp: "Verified application email only; no ATS or job-board forms", them: "Broad auto-apply, credit-based", winner: "them" },
      { feature: "Tailors to a specific company", rolesharp: "Yes — company + role + country", them: "Generic JD-based generation", winner: "us" },
      { feature: "ATS score included free", rolesharp: "Yes, on every version", them: "Paid", winner: "us" },
      { feature: "Interview practice", rolesharp: "Premium — Q&A generated from your actual resume", them: "Yes — Interview Buddy is their most-praised feature", winner: "tie" },
      { feature: "Cover letters", rolesharp: "Premium", them: "Paid plan", winner: "tie" },
      { feature: "Student offer", rolesharp: "6 months of Premium free with a university email", them: "None advertised", winner: "us" },
      { feature: "Public review record", rolesharp: "Small but clean", them: "BBB F rating; Trustpilot integrity warning (July 2026)", winner: "us" },
    ],
    themWins: [
      {
        heading: "Broader auto-apply coverage",
        body: "If your strategy is raw application volume across job boards and ATS forms, AIApply covers flows that RoleSharp does not automate. RoleSharp Apply supports only posting-backed application email with conservative fit, confidence, consent, cap, cooldown, and duplicate-send gates. Broad mass submission can also conflict with job-board terms, so check the service and destination rules first.",
      },
      {
        heading: "Interview Buddy",
        body: "AIApply's real-time interview assistant is the feature their users praise most consistently. RoleSharp's interview prep generates likely questions and strong answers from your actual resume, but it is a preparation tool, not a live in-interview assistant.",
      },
      {
        heading: "More tools under one roof",
        body: "Six tools including a resume translator. If you need multilingual resume conversion specifically, AIApply has a dedicated tool for it.",
      },
    ],
    usWins: [
      {
        heading: "A free tier that's actually free",
        body: "Three company-tailored resumes every month with ATS scores, no card required — not a trial that expires. You can evaluate the full quality of the output before paying anything.",
      },
      {
        heading: "Less than half the price, shown upfront",
        body: "RoleSharp Premium is $12/mo or $79/yr, published on a public pricing page. AIApply's $29/mo base price appears at checkout, and auto-apply credits are billed on top — reviewers report realistic totals of $74–149/mo.",
      },
      {
        heading: "Tailoring depth over volume",
        body: "RoleSharp builds the resume around a specific company, role, and country — not a generic rewrite. One sharp, tailored application tends to outperform dozens of auto-submitted generic ones.",
      },
      {
        heading: "Billing you can trust",
        body: "No credit systems, no surprise renewals to dispute. AIApply's BBB page carries an F rating with billing complaints as the dominant theme; Trustpilot has flagged their review collection with an integrity warning.",
      },
    ],
    pricingProse:
      "RoleSharp: free plan with 1 tailored resume/month, Premium at $12/mo or $79/yr, and 6 months of Premium free for verified students. AIApply: pricing is not published on the marketing site; at checkout the base plan is $29/mo, and auto-apply requires separately purchased credits — third-party reviews put a realistic all-in cost at $74–149/mo depending on volume.",
    pricingHeading: "Pricing: RoleSharp $12/mo vs AIApply $29/mo + credits ($74–149/mo all-in)",
    faqs: [
      ["Is RoleSharp cheaper than AIApply?", "Yes. RoleSharp Premium is $12/month or $79/year, versus AIApply's $29/month base plan plus separately billed auto-apply credits that push realistic totals to $74–149/month. RoleSharp also has a permanent free tier with 1 tailored resume a month; AIApply's free access is a limited trial."],
      ["Does RoleSharp have auto-apply like AIApply?", "RoleSharp has a narrower, controlled version. It can prepare and send an application email only when the stored posting explicitly accepts email applications and provides the recipient. It does not complete LinkedIn, Indeed, or employer ATS forms, guess recruiter addresses, or mass-submit across job boards."],
      ["Why does AIApply have a BBB F rating?", "As of July 2026, AIApply's Better Business Bureau profile shows an F rating, with billing and refund complaints as the dominant theme. Trustpilot has also attached an integrity warning to their review collection. Check both pages yourself before purchasing — records change over time."],
      ["Which is better for interview prep?", "AIApply's Interview Buddy is a live in-interview assistant and their most-praised feature. RoleSharp's interview prep is a preparation tool: it generates the questions you're most likely to face and strong answers built from your actual resume. If you want live assistance, AIApply; if you want to walk in prepared, RoleSharp."],
      ["Can I try both for free?", "You can fully evaluate RoleSharp free — 1 tailored resume a month with ATS scores, no card. AIApply's free access is limited, with most features revealed only after checkout. Trying RoleSharp first costs you nothing."],
    ],
    sourcesNote:
      "AIApply details from their public site, checkout flow, BBB profile, Trustpilot, and third-party reviews (Wobo, Resumly, JobRight), last checked July 2026. Their plans and review record can change — verify before deciding.",
  },
  {
    slug: "rolesharp-vs-kickresume",
    name: "Kickresume",
    shortName: "Kickresume",
    title: "RoleSharp vs Kickresume (2026) — Features, Free Access & Tailoring",
    description:
      "Compare RoleSharp and Kickresume on recurring free access, templates, ATS checking, job-ad tailoring, student eligibility, and current pricing terms.",
    h1: "RoleSharp vs Kickresume",
    intro:
      "Kickresume combines a polished template gallery with AI writing, ATS checking, job-ad tailoring, examples, and a connected job-search workspace. RoleSharp focuses on recurring, job-specific utility: company-, role-, country-, and job-description-aware tailoring, unlimited free ATS checks, transparent fixed-term pricing, and a safety-first application workflow.",
    verdict:
      "Choose Kickresume if template breadth, visual examples, public product polish, and native mobile continuity are your priorities. Choose RoleSharp if you value recurring free tailoring, unlimited free ATS checks, country-aware guidance, public fixed-term pricing with no automatic renewal, and conservative application controls. The products now overlap on tailoring and ATS analysis, so those capabilities should be compared by scope and limits rather than by a yes-or-no claim.",
    rows: [
      { feature: "Free access", rolesharp: "1 tailored resume every month, unlimited ATS checks, no card", them: "Free creation and downloads while using free customization options", winner: "tie", evidenceIds: ["kickresume-free-access"] },
      { feature: "Free download boundary", rolesharp: "PDF download included on Free (small watermark)", them: "Downloads available with free customization; advanced customization requires Premium", winner: "tie", evidenceIds: ["kickresume-free-access"] },
      { feature: "Premium pricing", rolesharp: "$12/mo · $79/yr; fixed term, no automatic renewal", them: "Varies by billing period, promotion, and potentially session or location", winner: "tie", evidenceIds: ["kickresume-pricing"] },
      { feature: "Template gallery", rolesharp: "6 focused ATS-safe styles", them: "40+ advertised resume templates with category browsing", winner: "them", evidenceIds: ["kickresume-templates"] },
      { feature: "Job-specific tailoring", rolesharp: "Company + role + country + job description; recurring allowance", them: "Accepts job title, company name, and full job ad; limited free use advertised", winner: "tie", evidenceIds: ["kickresume-tailoring"] },
      { feature: "ATS checking", rolesharp: "Unlimited free checks with score and prioritized fixes", them: "Free score advertised; deeper word analysis promoted as Premium", winner: "tie", evidenceIds: ["kickresume-ats"] },
      { feature: "Student access", rolesharp: "6 months of Premium free after academic-email verification", them: "Free student access advertised through ISIC, ITIC, or UNiDAYS", winner: "tie", evidenceIds: ["kickresume-students"] },
      { feature: "Works internationally", rolesharp: "200+ countries with country-aware guidance", them: "International product with localized public pages", winner: "tie" },
    ],
    themWins: [
      {
        heading: "Template breadth and visual browsing",
        body: "Kickresume advertises 40+ resume templates with category landing pages, previews, and direct template actions. RoleSharp currently offers six focused ATS-safe styles.",
      },
      {
        heading: "Public proof and cross-device continuity",
        body: "Kickresume publicly presents a larger example library, product screenshots, reviews, named experts, and native iOS and Android applications. These are meaningful advantages in product confidence and return use.",
      },
    ],
    usWins: [
      {
        heading: "Recurring free job-specific utility",
        body: "RoleSharp publishes a recurring allowance of 3 company-, role-, country-, and job-description-tailored resumes each month, alongside unlimited ATS checks. Kickresume also offers free creation and analysis, but its boundaries are structured differently and should not be reduced to a one-resume claim.",
      },
      {
        heading: "Transparent fixed-term pricing",
        body: "RoleSharp publishes $12 monthly and $79 yearly Premium passes and states that they do not renew automatically. Kickresume pricing can vary by billing period and promotion, so this comparison links to its current pricing page instead of treating one captured price as permanent.",
      },
      {
        heading: "Country-aware workflow and controlled applications",
        body: "RoleSharp connects country-aware tailoring and ATS analysis to jobs, tracking, and posting-backed application email. It does not guess recipients, complete job-board or ATS forms, or automatically retry unknown delivery outcomes.",
      },
    ],
    pricingProse:
      "RoleSharp publishes a free plan with 1 tailored resume per month and unlimited ATS checks, plus fixed-term Premium at $12 per month or $79 per year with no automatic renewal. Kickresume publishes monthly, quarterly, and annual Premium options, but observed prices and promotions have varied materially between captures. Verify the amount, displayed currency, billing total, taxes, eligibility, and renewal terms on Kickresume's current pricing page before deciding.",
    pricingHeading: "Pricing and terms: compare the current checkout details",
    faqs: [
      ["How do the free plans differ?", "RoleSharp publishes 1 tailored resume every month plus unlimited ATS checks and no card requirement. Kickresume says users can create and download resumes for free while they use free customization options; paid customization is labeled in its product. These are different boundaries, so a single numeric winner would be misleading."],
      ["Does Kickresume have better templates?", "Kickresume advertises 40+ templates and provides broader visual and category browsing. RoleSharp currently offers six focused ATS-safe styles. Kickresume leads on breadth; RoleSharp emphasizes restrained recruiter-readable formats."],
      ["Which product is cheaper?", "RoleSharp publishes fixed-term Premium at $12 per month or $79 per year with no automatic renewal. Kickresume's displayed prices and promotions have varied between captures and can depend on billing period or session context. Check its current pricing page and compare the full billed amount and renewal terms rather than relying on an old headline price."],
      ["Can both tailor a resume to a specific job?", "Yes. RoleSharp uses the company, role, country, and job description and provides a recurring monthly allowance. Kickresume's public tailoring page asks for the job title, company name, and full job ad and advertises limited free use. Compare the resulting edits, limits, and supporting evidence rather than treating tailoring as a binary feature."],
      ["Do both offer ATS checking?", "Yes. RoleSharp includes unlimited free checks with a score and prioritized fixes. Kickresume publicly advertises a free score and promotes deeper word analysis as a Premium capability. Exact in-product limits can change, so verify the current boundary before purchasing."],
      ["What student access is available?", "RoleSharp offers 6 months of Student Premium after academic-email verification. Kickresume publicly advertises free student access through ISIC, ITIC, or UNiDAYS. Eligibility, duration, and included features differ, so verify the terms that apply to you."],
    ],
    evidence: [
      {
        id: "kickresume-free-access",
        claim: "Users can create and download resumes for free while using free customization options.",
        sourceUrl: "https://www.kickresume.com/en/pricing/",
        capturedAt: "2026-08-03",
        locale: "English public page; currency and session context may vary",
        evidenceType: "first-party-page",
        volatility: "high",
        reviewBy: "2026-09-03",
        owner: "RoleSharp product marketing",
        status: "qualified",
        notes: "Public-page statement; exact in-product customization and export boundaries were not independently tested.",
      },
      {
        id: "kickresume-pricing",
        claim: "Kickresume offers monthly, quarterly, and annual Premium plans with dynamic promotional pricing.",
        sourceUrl: "https://www.kickresume.com/en/pricing/",
        capturedAt: "2026-08-03",
        locale: "English public page; displayed USD in direct capture",
        evidenceType: "first-party-page",
        volatility: "high",
        reviewBy: "2026-08-10",
        owner: "RoleSharp product marketing",
        status: "disputed",
        notes: "A direct capture displayed materially different prices from an earlier audit capture. Publish no timeless numeric comparison until a controlled recapture resolves the discrepancy.",
      },
      {
        id: "kickresume-templates",
        claim: "Kickresume advertises more than 40 resume templates.",
        sourceUrl: "https://www.kickresume.com/en/templates/resume",
        capturedAt: "2026-08-03",
        locale: "English public page",
        evidenceType: "first-party-page",
        volatility: "medium",
        reviewBy: "2026-11-03",
        owner: "RoleSharp product marketing",
        status: "verified",
      },
      {
        id: "kickresume-tailoring",
        claim: "Kickresume's tailoring workflow accepts a job title, company name, and full job ad and advertises limited free use.",
        sourceUrl: "https://www.kickresume.com/en/resume-tailoring/",
        capturedAt: "2026-08-03",
        locale: "English public page",
        evidenceType: "first-party-page",
        volatility: "high",
        reviewBy: "2026-09-03",
        owner: "RoleSharp product marketing",
        status: "qualified",
        notes: "Public-page description; authenticated product behavior was not independently tested.",
      },
      {
        id: "kickresume-ats",
        claim: "Kickresume advertises a free ATS score and promotes deeper word analysis as Premium.",
        sourceUrl: "https://www.kickresume.com/en/resume-checker/",
        capturedAt: "2026-08-03",
        locale: "English public page",
        evidenceType: "first-party-page",
        volatility: "high",
        reviewBy: "2026-09-03",
        owner: "RoleSharp product marketing",
        status: "qualified",
        notes: "Public-page description; exact free and Premium product limits were not independently tested.",
      },
      {
        id: "kickresume-students",
        claim: "Kickresume advertises free student access through ISIC, ITIC, or UNiDAYS.",
        sourceUrl: "https://www.kickresume.com/en/pricing/",
        capturedAt: "2026-08-03",
        locale: "English public page",
        evidenceType: "first-party-page",
        volatility: "high",
        reviewBy: "2026-09-03",
        owner: "RoleSharp product marketing",
        status: "qualified",
        notes: "Eligibility, duration, and included features may vary and should be checked with the provider.",
      },
    ],
    sourcesNote:
      "Kickresume feature and access details are competitor self-reports captured from its public pricing, templates, tailoring, and checker pages on 2026-08-03. Pricing is marked disputed because captures conflict. Verify current eligibility, limits, currency, billed total, promotion, and renewal terms before deciding.",
  },
  {
    slug: "rolesharp-vs-resume-io",
    name: "Resume.io",
    shortName: "Resume.io",
    title: "RoleSharp vs Resume.io (2026) — Pricing, Free Downloads & ATS Scoring",
    description:
      "Resume.io's free plan downloads TXT only and premium runs $24.95/mo. RoleSharp downloads real PDFs free and Premium is $12/mo. An honest side-by-side comparison.",
    h1: "RoleSharp vs Resume.io",
    intro:
      "Resume.io is one of the biggest names in online resume builders, with a clean editor and huge SEO presence. RoleSharp is smaller and sharper: company-specific tailoring, free ATS scoring on every version, and a free plan that exports a real PDF instead of a TXT file.",
    verdict:
      "Resume.io is a solid, established editor — but its free plan famously exports only a TXT file, and premium costs $24.95/mo with subscription terms that many public reviews complain about. RoleSharp gives you real free PDF downloads, free ATS scores, company-level tailoring, and a premium at less than half the price, published upfront.",
    rows: [
      { feature: "Free download format", rolesharp: "Real PDF (small watermark)", them: "TXT only", winner: "us" },
      { feature: "Free allowance", rolesharp: "1 tailored resume every month", them: "Limited", winner: "us" },
      { feature: "Premium price", rolesharp: "$12/mo · $79/yr", them: "$24.95/mo", winner: "us" },
      { feature: "Editor maturity", rolesharp: "Focused builder + live preview", them: "Very polished, long-established editor", winner: "them" },
      { feature: "Tailors to a specific company", rolesharp: "Yes — company + role + country", them: "No", winner: "us" },
      { feature: "ATS score included free", rolesharp: "Yes, every version", them: "Paid", winner: "us" },
      { feature: "Student offer", rolesharp: "6 months of Premium free", them: "None advertised", winner: "us" },
      { feature: "Works internationally", rolesharp: "200+ countries", them: "Yes", winner: "tie" },
    ],
    themWins: [
      {
        heading: "A very mature editor",
        body: "Resume.io has spent years refining its editor and template rendering. The editing experience is smooth and predictable, and their example library is enormous.",
      },
      {
        heading: "Brand recognition",
        body: "Resume.io is one of the most-searched builders in the world. If you want the most established option and don't mind the price, it's a known quantity.",
      },
    ],
    usWins: [
      {
        heading: "Free actually means a usable file",
        body: "Resume.io's free plan exports a TXT file — not something you can send to a recruiter. RoleSharp's free plan downloads a real, formatted PDF with only a small watermark.",
      },
      {
        heading: "Less than half the premium price",
        body: "$12/mo or $79/yr versus $24.95/mo, and RoleSharp's pricing is published on a public page rather than surfacing during checkout.",
      },
      {
        heading: "Tailoring and scoring built in",
        body: "Every RoleSharp resume can be tailored to a specific company, role, and country, and every version gets a free ATS score with missing keywords and fixes. Resume.io charges for ATS feedback and doesn't do company-specific tailoring.",
      },
    ],
    pricingProse:
      "RoleSharp: free plan with 1 tailored resume/month and real PDF downloads, Premium at $12/mo or $79/yr, 6 months free for verified students. Resume.io: free plan limited to TXT export, premium at $24.95/mo, no advertised student offer.",
    pricingHeading: "Pricing: RoleSharp $12/mo vs Resume.io $24.95/mo",
    faqs: [
      ["Can I download a free PDF from Resume.io?", "No — Resume.io's free plan exports TXT only; PDF downloads require a paid plan. RoleSharp's free plan downloads a real formatted PDF with a small watermark, and you get 3 company-tailored resumes every month at no cost."],
      ["Is RoleSharp cheaper than Resume.io?", "Yes — RoleSharp Premium is $12/month or $79/year versus Resume.io's $24.95/month. RoleSharp also publishes its pricing on a public page, and verified students get 6 months of Premium free."],
      ["Does Resume.io check my resume against ATS systems?", "ATS feedback on Resume.io is a paid feature. RoleSharp includes an ATS score with missing keywords and priority fixes free on every resume version, including on the free plan."],
      ["Which should I pick?", "Pick Resume.io if you want the most established editor and don't mind $24.95/mo. Pick RoleSharp if you want free usable PDFs, free ATS scoring, resumes tailored to a specific company and role, and a premium at less than half the price."],
    ],
    sourcesNote:
      "Resume.io details from their public pricing page, last checked July 2026. Plans change — check theirs before deciding.",
  },
  {
    slug: "rolesharp-vs-teal",
    name: "Teal",
    shortName: "Teal",
    title: "RoleSharp vs Teal (2026) — Free Resumes, ATS Scoring & Pricing Compared",
    description:
      "Teal's free plan builds 1 resume; RoleSharp gives you 1 tailored resume every month. Honest side-by-side of the job tracker, resume builder, and ATS tools.",
    h1: "RoleSharp vs Teal",
    intro:
      "Teal is a job-search workspace: a tracker, a resume builder, and a JD matcher in one product. RoleSharp is narrower and deeper — it builds the resume around a specific company, role, and country, and scores every version against ATS for free. Both have free tiers; they differ in what's free and how deep the tailoring goes.",
    verdict:
      "Pick Teal if you want a full job-search workspace with a tracker and bookmarklet that pulls jobs from any board — that workflow is genuinely useful. Pick RoleSharp if the resume itself is the bottleneck: company-specific tailoring, free ATS scores on every version, a monthly free allowance instead of a single resume, and a lower premium price.",
    rows: [
      { feature: "Free resumes", rolesharp: "1 tailored resume every month", them: "1 resume template on free", winner: "us" },
      { feature: "ATS score included free", rolesharp: "Yes, every version", them: "Limited — Match Score is a paid feature", winner: "us" },
      { feature: "Premium price", rolesharp: "$12/mo · $79/yr", them: "$9/mo weekly · $29/mo monthly", winner: "tie" },
      { feature: "Job tracker", rolesharp: "Yes — pipeline with statuses", them: "Yes — their flagship, with board bookmarklet", winner: "them" },
      { feature: "Tailors to a specific company", rolesharp: "Yes — company + role + country", them: "JD-based matching, not company-specific", winner: "us" },
      { feature: "Resume builder", rolesharp: "AI + manual + fixer", them: "Builder + AI rewrite (paid)", winner: "tie" },
      { feature: "Student offer", rolesharp: "6 months of Premium free", them: "50% off paid plans", winner: "us" },
      { feature: "Works internationally", rolesharp: "200+ countries", them: "Yes, US-centric", winner: "tie" },
    ],
    themWins: [
      {
        heading: "The job tracker is the star",
        body: "Teal's tracker with the Chrome bookmarklet that saves jobs from any board is genuinely the best free tracker in this comparison. If you're juggling many applications and want one inbox for all of them, Teal does that better than RoleSharp's simpler pipeline.",
      },
      {
        heading: "A real workspace, not just a builder",
        body: "Teal is built for the whole job search — tracker, resume, cover letter, contacts, JD analysis in one tab. RoleSharp focuses on the resume and ATS scoring and leaves the tracker lighter by design.",
      },
    ],
    usWins: [
      {
        heading: "ATS scores free, on every version",
        body: "Teal's Match Score against a job description is a paid feature. RoleSharp scores every resume version free, including on the free plan, with the missing keywords and fixes called out.",
      },
      {
        heading: "Tailoring goes deeper than the JD",
        body: "Teal matches your resume to a job description. RoleSharp tailors to the specific company, role, and country — a Google resume in the US reads differently from a Deloitte resume in the UK, and RoleSharp handles that distinction.",
      },
      {
        heading: "A monthly free allowance, not a single template",
        body: "Teal's free plan locks you to one resume template. RoleSharp gives you 3 company-tailored resumes every month forever — enough to run a real job search without paying.",
      },
    ],
    pricingProse:
      "RoleSharp: free plan with 1 tailored resume/month and ATS scores, Premium at $12/mo or $79/yr, 6 months free for verified students. Teal: free plan with 1 resume template, paid at $9/week or $29/month for unlimited resumes, AI features, and the JD Match Score.",
    pricingHeading: "Pricing: RoleSharp $12/mo vs Teal $29/mo (or $9/wk)",
    faqs: [
      ["Is RoleSharp's free plan better than Teal's?", "For resume building, yes. Teal's free plan gives you one resume template; RoleSharp gives you 3 company-tailored resumes every month with free ATS scores on each. Teal's free job tracker is stronger, so it depends what you need most."],
      ["Does Teal have a better job tracker?", "Yes — Teal's tracker, with the Chrome bookmarklet that saves jobs from any board, is the best free tracker in this comparison. RoleSharp has a simpler pipeline tracker. If tracking applications across many boards is your main pain, Teal wins that round."],
      ["Which is cheaper?", "Teal's weekly plan is $9 and monthly is $29; RoleSharp Premium is $12/month or $79/year. Over a full year RoleSharp is significantly cheaper, and RoleSharp's free tier is more usable for ongoing resume building."],
      ["Does Teal tailor resumes to a specific company?", "Teal matches your resume against a job description and scores the keyword overlap. RoleSharp goes further: it rewrites the resume around the specific company, role, and country, not just the JD text."],
    ],
    sourcesNote:
      "Teal details from their public pricing page and product site, last checked July 2026. Plans change — check theirs before deciding.",
  },
  {
    slug: "rolesharp-vs-rezi",
    name: "Rezi",
    shortName: "Rezi",
    title: "RoleSharp vs Rezi (2026) — ATS Resumes, AI Writer & Pricing Compared",
    description:
      "Rezi is built around ATS optimization with AI bullet writing; RoleSharp adds company-specific tailoring and a free tier. An honest side-by-side comparison.",
    h1: "RoleSharp vs Rezi",
    intro:
      "Rezi has made its name on ATS-optimized resume building, with an AI writer that generates and rewrites bullet points and a content optimizer that scores keyword coverage. RoleSharp covers the same ATS ground but adds company-specific tailoring — the resume is built around a named employer and country, not just a job description — and a more usable free tier.",
    verdict:
      "If you want an AI that writes your bullets for you and an ATS optimizer focused on keyword density, Rezi does that well. If you want the resume tailored to the specific company and market you're applying to, free ATS scoring on every version, and a monthly free allowance, RoleSharp gives you more for less. They overlap on ATS; they differ on tailoring depth and free-tier generosity.",
    rows: [
      { feature: "Free tier", rolesharp: "1 tailored resume every month, unlimited ATS checks", them: "Limited free plan, credits-based", winner: "us" },
      { feature: "Premium price", rolesharp: "$12/mo · $79/yr", them: "$29/mo · $129/yr (Pro)", winner: "us" },
      { feature: "AI bullet writer", rolesharp: "Premium — rewrites for the target role", them: "Core feature, AI-generated bullets", winner: "tie" },
      { feature: "Tailors to a specific company", rolesharp: "Yes — company + role + country", them: "No — JD-based optimization", winner: "us" },
      { feature: "ATS score included free", rolesharp: "Yes, every version", them: "Limited on free", winner: "us" },
      { feature: "Keyword optimization", rolesharp: "Missing-keyword list + fixes", them: "Content optimizer with density scoring", winner: "tie" },
      { feature: "Cover letters", rolesharp: "Premium", them: "Paid plan", winner: "tie" },
      { feature: "Student offer", rolesharp: "6 months of Premium free", them: "Discount available", winner: "us" },
    ],
    themWins: [
      {
        heading: "A focused ATS optimizer",
        body: "Rezi's content optimizer scores keyword density and coverage at a level of granularity that's genuinely useful for ATS tuning. If pure keyword optimization is your goal, their tooling is well-built.",
      },
      {
        heading: "AI bullet generation",
        body: "Rezi's AI writer generates bullet points from a prompt, which is fast if you're starting from nothing. RoleSharp's AI rewrites existing bullets for the target role rather than inventing them from a one-line prompt.",
      },
    ],
    usWins: [
      {
        heading: "Company-specific tailoring, not just JD matching",
        body: "Rezi optimizes against a job description's keywords. RoleSharp builds the resume around the specific company, role, and country — the difference between matching keywords and writing for the actual employer.",
      },
      {
        heading: "A free tier you can actually use",
        body: "Rezi's free plan is credit-limited. RoleSharp gives you 3 company-tailored resumes every month, forever, with free ATS scores on each — no credits to run out of.",
      },
      {
        heading: "Less than half the price",
        body: "$12/mo or $79/yr versus Rezi Pro at $29/mo or $129/yr, with a more generous free tier and a better student offer underneath.",
      },
    ],
    pricingProse:
      "RoleSharp: free plan with 1 tailored resume/month and ATS scores, Premium at $12/mo or $79/yr, 6 months free for verified students. Rezi: limited free plan, Pro at $29/mo or $129/yr with unlimited AI writing and the full content optimizer.",
    pricingHeading: "Pricing: RoleSharp $12/mo vs Rezi $29/mo",
    faqs: [
      ["Is RoleSharp cheaper than Rezi?", "Yes — RoleSharp Premium is $12/month or $79/year versus Rezi Pro at $29/month or $129/year. RoleSharp also has a more generous free tier with 1 tailored resume a month."],
      ["Which is better for ATS optimization?", "Both focus on ATS. Rezi's content optimizer scores keyword density in detail; RoleSharp gives you a free ATS score with missing keywords and fixes on every version. If granular density scoring matters, Rezi; if a free score on every version with a clear fix list matters, RoleSharp."],
      ["Does Rezi tailor to a specific company?", "No — Rezi optimizes against a job description's keywords. RoleSharp tailors the resume to the named company, role, and country, which is a deeper level of targeting."],
      ["Which has a better free plan?", "RoleSharp's free plan gives you 3 company-tailored resumes every month with ATS scores, no card. Rezi's free plan is credit-limited. For ongoing free use, RoleSharp is more usable."],
    ],
    sourcesNote:
      "Rezi details from their public pricing page and product site, last checked July 2026. Plans change — check theirs before deciding.",
  },
  {
    slug: "rolesharp-vs-novoresume",
    name: "Novoresume",
    shortName: "Novoresume",
    title: "RoleSharp vs Novoresume (2026) — Free Tier, Templates & Pricing Compared",
    description:
      "Novoresume's free plan locks 1-page resumes and basic templates; RoleSharp gives 1 tailored resume a month free. Honest side-by-side of features and price.",
    h1: "RoleSharp vs Novoresume",
    intro:
      "Novoresume is a polished template-first resume builder with a clean editor and a content optimizer that suggests improvements as you write. RoleSharp is tailoring-first: the resume is built around a specific company, role, and country, and every version gets a free ATS score. Both have free tiers; Novoresume restricts format and length, RoleSharp restricts monthly count.",
    verdict:
      "Choose Novoresume if you want a guided, template-first editor that holds your hand through each section and you don't mind the 1-page limit on free. Choose RoleSharp if you want the resume tailored to the actual company and role, free ATS scoring on every version, and a premium at roughly half the price.",
    rows: [
      { feature: "Free plan limit", rolesharp: "1 tailored resume every month", them: "1-page resumes only, basic templates", winner: "us" },
      { feature: "Premium price", rolesharp: "$12/mo · $79/yr", them: "$19.95/mo · $99.95/yr", winner: "us" },
      { feature: "Tailors to a specific company", rolesharp: "Yes — company + role + country", them: "No", winner: "us" },
      { feature: "ATS score included free", rolesharp: "Yes, every version", them: "Content tips, not a score", winner: "us" },
      { feature: "Template polish", rolesharp: "Focused ATS-safe set", them: "Polished, design-forward templates", winner: "them" },
      { feature: "Guided editor", rolesharp: "Structured fields + live preview", them: "Section-by-section guidance + tips", winner: "them" },
      { feature: "Student offer", rolesharp: "6 months of Premium free", them: "Discount available", winner: "us" },
      { feature: "Works internationally", rolesharp: "200+ countries", them: "Yes", winner: "tie" },
    ],
    themWins: [
      {
        heading: "A genuinely guided editor",
        body: "Novoresume's editor walks you through each section with tips and a content optimizer that suggests improvements as you type. For a first-time resume writer who wants hand-holding, it's well designed.",
      },
      {
        heading: "Polished templates",
        body: "Novoresume's templates are cleaner and more design-forward than RoleSharp's deliberately ATS-safe set. If visual presentation matters for your field, theirs look better.",
      },
    ],
    usWins: [
      {
        heading: "No 1-page limit on free",
        body: "Novoresume's free plan forces 1-page resumes and basic templates only. RoleSharp's free plan lets you build full multi-page tailored resumes with ATS scores — no artificial length limit.",
      },
      {
        heading: "Company-specific tailoring",
        body: "Novoresume helps you fill a template well. RoleSharp rewrites the content around the specific company, role, and country you're targeting — the difference between a nice template and a resume written for the job.",
      },
      {
        heading: "Cheaper premium, better student deal",
        body: "$12/mo or $79/yr versus $19.95/mo or $99.95/yr, and students with a university email get 6 months of RoleSharp Premium completely free rather than a percentage discount.",
      },
    ],
    pricingProse:
      "RoleSharp: free plan with 1 tailored resume/month (no page limit) and ATS scores, Premium at $12/mo or $79/yr, 6 months free for verified students. Novoresume: free plan limited to 1-page resumes with basic templates, Premium at $19.95/mo or $99.95/yr.",
    pricingHeading: "Pricing: RoleSharp $12/mo vs Novoresume $19.95/mo",
    faqs: [
      ["Is RoleSharp's free plan better than Novoresume's?", "For most users, yes. Novoresume's free plan limits you to 1-page resumes with basic templates; RoleSharp gives you 3 full company-tailored resumes every month with ATS scores and no page limit."],
      ["Does Novoresume have better templates?", "Novoresume's templates are more polished and design-forward — it's a genuine strength. RoleSharp keeps a focused set of ATS-safe templates, betting that content tailored to the job beats visual variety."],
      ["Which is cheaper?", "RoleSharp Premium is $12/month or $79/year versus Novoresume Premium at $19.95/month or $99.95/year. Students get 6 months of RoleSharp Premium free with a university email."],
      ["Can Novoresume tailor my resume to a specific company?", "No — Novoresume is a template editor with content guidance. RoleSharp builds the resume around the specific company, role, and country, with an ATS score on every version."],
    ],
    sourcesNote:
      "Novoresume details from their public pricing page, last checked July 2026. Plans change — check theirs before deciding.",
  },
  {
    slug: "rolesharp-vs-zety",
    name: "Zety",
    shortName: "Zety",
    title: "RoleSharp vs Zety (2026) — Free Downloads, Pricing & ATS Scoring Compared",
    description:
      "Zety's free plan lets you build but not download; RoleSharp downloads a real PDF free. Honest side-by-side of the editors, templates, and pricing.",
    h1: "RoleSharp vs Zety",
    intro:
      "Zety is one of the highest-traffic resume builders online, with a large template gallery and a guided editor. It's also notorious for a free plan that lets you build but not download, and a subscription price that surprises users at checkout. RoleSharp is smaller and more direct: free PDF downloads, free ATS scores, company-specific tailoring, and a premium at a fraction of the price.",
    verdict:
      "Zety has the template gallery and the SEO footprint, and its editor is smooth. But its free plan famously won't let you download your resume, and its pricing surfaces at checkout rather than on a public page. RoleSharp gives you a real free PDF, free ATS scoring, company-level tailoring, and a published premium at less than half the price. For most job seekers, that's the better deal.",
    rows: [
      { feature: "Free download", rolesharp: "Real PDF (small watermark)", them: "No — build only, download is paid", winner: "us" },
      { feature: "Free resumes", rolesharp: "1 tailored resume every month", them: "Build only, cannot export", winner: "us" },
      { feature: "Premium price", rolesharp: "$12/mo · $79/yr", them: "$5.95 trial then ~$23.95/mo", winner: "us" },
      { feature: "Pricing shown before signup", rolesharp: "Yes — public pricing page", them: "No — trial price then auto-renew at full rate", winner: "us" },
      { feature: "Template gallery", rolesharp: "Focused ATS-safe set", them: "Large gallery — their strong suit", winner: "them" },
      { feature: "Tailors to a specific company", rolesharp: "Yes — company + role + country", them: "No", winner: "us" },
      { feature: "ATS score included free", rolesharp: "Yes, every version", them: "Paid", winner: "us" },
      { feature: "Student offer", rolesharp: "6 months of Premium free", them: "None advertised", winner: "us" },
    ],
    themWins: [
      {
        heading: "A large template gallery",
        body: "Zety's template gallery is one of the biggest in the market. If template variety is your top criterion and you're happy to pay, they have more visual options than RoleSharp's focused ATS-safe set.",
      },
      {
        heading: "Brand recognition and reach",
        body: "Zety is one of the most-searched resume builders online. If you want the option with the biggest footprint and don't mind the pricing model, it's a known quantity.",
      },
    ],
    usWins: [
      {
        heading: "A free download you can actually use",
        body: "Zety's free plan lets you build a resume but won't let you download it — you hit a paywall at export. RoleSharp's free plan downloads a real formatted PDF with a small watermark, and you get 1 tailored resume every month.",
      },
      {
        heading: "Published pricing, no surprise renewals",
        body: "RoleSharp's $12/mo or $79/yr is on a public pricing page. Zety's $5.95 trial auto-renews at roughly $23.95/mo, a model that generates consistent complaints in public reviews.",
      },
      {
        heading: "Tailoring and scoring built in",
        body: "Every RoleSharp resume can be tailored to a specific company, role, and country, and every version gets a free ATS score. Zety charges for ATS feedback and doesn't do company-specific tailoring.",
      },
    ],
    pricingProse:
      "RoleSharp: free plan with 1 tailored resume/month and real PDF downloads, Premium at $12/mo or $79/yr, 6 months free for verified students. Zety: free plan allows building but not downloading; paid plan starts at a $5.95 trial that auto-renews at roughly $23.95/mo, no advertised student offer.",
    pricingHeading: "Pricing: RoleSharp $12/mo vs Zety ~$23.95/mo after trial",
    faqs: [
      ["Can I download a free resume from Zety?", "No — Zety's free plan lets you build a resume but blocks the download; exporting requires a paid plan. RoleSharp's free plan downloads a real formatted PDF with a small watermark, and you get 3 company-tailored resumes every month."],
      ["Is RoleSharp cheaper than Zety?", "Yes — RoleSharp Premium is $12/month or $79/year. Zety's $5.95 trial auto-renews at roughly $23.95/month, making RoleSharp less than half the ongoing price."],
      ["Does Zety check my resume against ATS?", "ATS feedback on Zety is a paid feature. RoleSharp includes an ATS score with missing keywords and priority fixes free on every resume version, including on the free plan."],
      ["Which should I pick?", "Pick Zety if you want the largest template gallery and don't mind the trial-to-subscription pricing. Pick RoleSharp if you want a free usable PDF download, free ATS scoring, resumes tailored to a specific company and role, and a published premium at less than half the price."],
    ],
    sourcesNote:
      "Zety details from their public site and checkout flow, last checked July 2026. Their trial-to-subscription pricing and auto-renewal rate are widely reported in third-party reviews — verify before deciding.",
  },
  {
    // Generic archetype, not a named vendor — the Whali-style BOFU page for
    // "is ChatGPT enough?" searches. Every claim is about the *category*
    // (general AI chatbots as resume tools), so there is no vendor evidence to
    // date and no sourcesNote beyond the honest disclosure that this is an
    // archetype comparison. Winner counts stay meaningful because every row
    // is a real, stable capability difference.
    slug: "rolesharp-vs-chatgpt-resume",
    name: "ChatGPT",
    shortName: "ChatGPT",
    title: "RoleSharp vs ChatGPT for Resumes (2026) — What a Chatbot Can't Do",
    description:
      "ChatGPT writes good bullet text. It can't score your resume against an ATS, tailor to a real company's postings, or keep your evidence honest. An honest side-by-side.",
    h1: "RoleSharp vs ChatGPT for resume writing",
    intro:
      "ChatGPT (and Claude, Gemini, and every general chatbot) is a strong writing assistant — and many people write their resume with it for free. This page is the honest version of that comparison: what a general chatbot genuinely does well for resumes, where it structurally stops, and what a purpose-built tool adds on top. No strawmen.",
    verdict:
      "If you're comfortable prompting and checking your own work, a chatbot can draft respectable bullet text for free — use it. What it can't do is structural: it has no ATS parser to score against, no live job postings to tailor toward, no template that renders identically to what a recruiter receives, and no memory of your evidence — it will happily invent metrics if you let it. RoleSharp wraps the same class of AI in the parts a chatbot lacks: a real ATS score on every version, tailoring to a named company and country, ATS-safe rendering, and guards that keep invented numbers out of your resume.",
    rows: [
      { feature: "Draft writing quality", rolesharp: "Purpose-built prompts, evidence-guarded", them: "Excellent general writing, free to try", winner: "them" },
      { feature: "ATS score on your actual file", rolesharp: "Yes — parseable structure, missing keywords, priority fixes, free", them: "No — it can't parse or score a document", winner: "us" },
      { feature: "Tailors to a real company's postings", rolesharp: "Yes — company + role + country + live job description", them: "Only what you paste in, with no posting to verify against", winner: "us" },
      { feature: "Prevents invented metrics", rolesharp: "Evidence-first — rewrites your real experience, flags unsupported claims", them: "Will fabricate plausible numbers if prompted to", winner: "us" },
      { feature: "Recruiter-ready formatting", rolesharp: "ATS-safe templates, PDF/DOCX export", them: "You format it yourself; chat text isn't a resume", winner: "us" },
      { feature: "Price", rolesharp: "Free tier with 1 tailored resume/mo; $12/mo premium", them: "Free or ~$20/mo for the paid chatbot tier", winner: "tie" },
      { feature: "Interview prep from your resume", rolesharp: "Questions + STAR scaffolds + voice practice from your actual resume", them: "Good conversational practice if you paste your resume in", winner: "tie" },
      { feature: "Your data stays yours", rolesharp: "Resume stored in your account, deletable", them: "Depends on the chatbot's retention settings — check them", winner: "tie" },
    ],
    themWins: [
      {
        heading: "Free, excellent raw writing",
        body: "A modern chatbot drafts fluent bullet text, rewrites tone, and brainstorms achievement angles at zero cost. If you already know what recruiters want and just need help wording it, that's a legitimate tool for the job — RoleSharp's own ask-AI links send you to chatbots with source-first prompts for exactly this reason.",
      },
      {
        heading: "General-purpose flexibility",
        body: "The same chat handles your cover letter, outreach messages, interview research, and anything else you throw at it. A purpose-built resume tool intentionally doesn't try to be everything.",
      },
    ],
    usWins: [
      {
        heading: "A real ATS score, not a vibe",
        body: "Chatbots can't parse your PDF or DOCX and have no parser to score against — ask one 'is my resume ATS-friendly?' and you get generic formatting advice, not an analysis of your file. RoleSharp extracts your actual document, scores it, and lists the missing keywords and structural fixes in priority order, free on every version.",
      },
      {
        heading: "Tailoring against real postings",
        body: "RoleSharp tailors to a named company, role, and country with the live job description attached, and its jobs pages carry real postings with the requirements to match. A chatbot only knows the JD text you paste — it can't verify your resume against what this employer actually asks for.",
      },
      {
        heading: "Evidence guards",
        body: "The most common way chatbot-written resumes fail is invented metrics — plausible numbers the model produced because a prompt asked for achievements. RoleSharp's whole pipeline is evidence-first: it rewrites the experience you actually had, flags bullets it can't trace, and keeps the honesty in. That discipline is the product.",
      },
      {
        heading: "Output a recruiter can receive",
        body: "Chat text is not a resume. RoleSharp renders ATS-safe templates to identical PDF/DOCX with correct parsing order, and every version you tailor is a real, scored, exportable document in your account.",
      },
    ],
    pricingProse:
      "RoleSharp: free tier with 3 company-tailored resumes a month and free ATS scoring; Premium at $12/mo or $79/yr with no automatic renewal. ChatGPT: the free tier handles most resume drafting; paid chatbot tiers run roughly $20/mo — fine value for general use, but none of it buys document scoring or tailoring.",
    pricingHeading: "Pricing: RoleSharp free tier + $12/mo vs chatbot free tier + ~$20/mo",
    faqs: [
      ["Can I just use ChatGPT to write my resume?", "You can, and many people do. The honest failure mode isn't the writing quality — it's that the chatbot can't score your file against an ATS, can't tailor to a real posting it doesn't have, will invent plausible metrics if you let it, and hands you text you still have to format yourself. Use it for wording; use a purpose-built tool for structure, scoring, and export."],
      ["Does ChatGPT do ATS checks?", "No. A chatbot has no document parser and no scoring engine — asked to 'check' a resume it gives generic formatting advice. RoleSharp parses your actual PDF, DOCX, or text, scores it, and names the missing keywords and fixes, free."],
      ["Will an AI resume get me rejected?", "Recruiters reject resumes that read generic or contain claims that fall apart under questioning — both are failure modes of unsupervised chatbot drafting. The tool matters less than the discipline: real evidence, tailored to the posting, formatted so the ATS can read it."],
      ["Is RoleSharp just ChatGPT with extra steps?", "No — RoleSharp uses its own tailored pipeline around an LLM, but the product is everything around the model: the ATS parser and score, the live posting data, the company/country tailoring, the evidence guards that keep invented numbers out, and the recruiter-ready export. The model is a component, not the product."],
      ["Can I use both together?", "Yes, and RoleSharp makes it easy — every blog post and tool page carries ask-AI links that open ChatGPT, Claude, or Gemini with a source-first prompt for the question you were reading about. Draft with the chatbot, then score and tailor the result in RoleSharp."],
    ],
    sourcesNote:
      "This page compares RoleSharp with the general-chatbot category (ChatGPT, Claude, Gemini) as of September 2026. No named-vendor claims are made; chatbot capabilities are the public, advertised behavior of the category and change frequently — test with your own resume before deciding.",
  },
];

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}
