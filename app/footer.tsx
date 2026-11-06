import { KEY_LOCALES } from "@/lib/locales";
import RoleSharpMark from "@/components/RoleSharpMark";
import { SUPPORT_EMAIL } from "@/lib/contact";

const footerGroups = [
  {
    title: "Product",
    wide: true,
    links: [
      { label: "Resume Fixer", href: "/resume-fixer" },
      { label: "AI Resume Builder", href: "/resume-builder" },
      { label: "Manual Resume Maker", href: "/resume-maker" },
      { label: "Personal Portfolio", href: "/u" },
      { label: "ATS Checker", href: "/checker" },
      { label: "ATS Parser X-Ray", href: "/ats-xray" },
      { label: "GitHub Resume Compiler", href: "/github-resume" },
      { label: "Resume Language Polish", href: "/ai-humanizer" },
      { label: "Resume Match Checker", href: "/resume-match" },
      { label: "Resume Version Compare", href: "/resume-compare" },
      { label: "Cover Letter", href: "/cover-letter-generator" },
      { label: "Interview Questions", href: "/interview-questions" },
      { label: "Interview Prep", href: "/interview-prep" },
      { label: "Free credits event", href: "/social-rewards" },
    ],
  },
  {
    title: "Jobs",
    wide: false,
    links: [
      { label: "Find Jobs", href: "/jobs" },
      { label: "Auto Mail Jobs", href: "/daily-matches" },
      { label: "Email-Sending Jobs", href: "/application-queue" },
      { label: "Internships", href: "/internships" },
      { label: "Application Tracker", href: "/tracker" },
    ],
  },
  {
    // "Templates" not "Templates & Examples": at six-across the column is
    // ~150px wide and the long form wrapped to two lines, pushing this
    // group's first link row below every neighbour's (usability audit #23).
    title: "Templates",
    wide: false,
    links: [
      { label: "Resume Templates", href: "/resume-templates" },
      { label: "Resume Examples", href: "/resume-examples" },
      { label: "Role Guides", href: "/roles" },
      { label: "Company Guides", href: "/companies" },
    ],
  },
  {
    title: "Guidance",
    wide: true,
    links: [
      { label: "Career Blog & Insights", href: "/blog" },
      { label: "Job Search Guide", href: "/job-search-guide" },
      { label: "Resume Keyword Report", href: "/resume-keyword-report-2026" },
      { label: "Country Resume Adapter", href: "/resume-translator" },
      { label: "Salary Estimator", href: "/salaries" },
      { label: "LinkedIn Headline Generator", href: "/linkedin-headline-generator" },
      { label: "CV Converter", href: "/cv-converter" },
      { label: "Career Academy", href: "/learn" },
      { label: "Free Certifications", href: "/free-certifications" },
      { label: "Internship Safety", href: "/internship-reports" },
      { label: "Help Center", href: "/help" },
    ],
  },
  {
    title: "Trust",
    wide: false,
    links: [
      { label: "About & Methodology", href: "/about" },
      { label: "Compare RoleSharp", href: "/compare" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refunds", href: "/refund" },
    ],
  },
  {
    title: "Company",
    wide: false,
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Free Tools", href: "/tools" },
      { label: "Integrations", href: "/integrations" },
      { label: "Press & Media", href: "/press" },
      { label: "Affiliate", href: "/affiliate" },
      { label: "Contact", href: "/contact" },
      { label: "Support", href: "/support" },
    ],
  },
] as const;

const socialLinks = [
  { label: "X", href: "https://x.com/rolesharpai" },
  { label: "Instagram", href: "https://instagram.com/rolesharp" },
  { label: "LinkedIn", href: "https://linkedin.com/company/rolesharpai" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="rs-site-footer">
      <div className="max-w-[var(--maxw)] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
        <div className="grid gap-8 border-b border-white/10 pb-8 lg:grid-cols-[minmax(230px,0.85fr)_minmax(0,3.15fr)]">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-white font-[family-name:var(--font-display)] font-extrabold text-xl tracking-tight" aria-label="RoleSharp home">
              <RoleSharpMark size={34} />
              <span>Role<span className="text-[var(--color-brand-amber)]">Sharp</span></span>
            </a>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-300">
              Turn resume evidence and one target job into a clearer, ATS-aware application—then keep the workflow connected through follow-up.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rs-footer-proof">Free monthly value</span>
              <span className="rs-footer-proof">Fixed-term Premium</span>
              <span className="rs-footer-proof">No auto-renewal</span>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-6 inline-flex text-sm font-semibold text-white hover:text-[var(--color-brand-amber)]">{SUPPORT_EMAIL}</a>

          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {footerGroups.map((group) => (
              <section key={group.title} className={group.wide ? "lg:col-span-2" : undefined}>
                <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-white">{group.title}</h2>
                <ul className={group.wide ? "grid gap-x-6 gap-y-2 sm:grid-cols-2" : "space-y-2"}>
                  {/* Wider groups use two short columns instead of leaving a
                      tall, sparse directory below the account workspace. */}
                  {group.links.map(({ label, href }) => <li key={href}><a href={href} className="text-sm leading-6 text-slate-400 transition-colors hover:text-white">{label}</a></li>)}
                </ul>
              </section>
            ))}
          </nav>
        </div>

        <nav aria-label="Regional resume guides" className="border-b border-white/10 py-8">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.12em] text-white">Regional Guides</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            {/* Dot separators between items: a bare flex-wrap row of country
                names reads as one paragraph (audit #25). aria-hidden keeps
                screen readers announcing the names, not "dot dot dot". */}
            {KEY_LOCALES.map((locale, index) => (
              <span key={locale.slug} className="flex items-center gap-3">
                {index > 0 && <span aria-hidden="true" className="text-slate-600">•</span>}
                <a href={`/${locale.slug}`} hrefLang={locale.lang} lang={locale.lang} className="text-sm text-slate-400 transition-colors hover:text-white">{locale.nativeName}</a>
              </span>
            ))}
          </div>
        </nav>

        <div className="flex flex-col gap-5 pt-7 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="mb-1">&copy; {year} RoleSharp. Built for job seekers worldwide.</p><p className="mb-0">Country-aware resume guidance for 209 countries and territories.</p></div>
          <div className="flex flex-wrap gap-4">{socialLinks.map(({ label, href }) => <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-300 hover:text-white">{label}</a>)}</div>
        </div>
      </div>
    </footer>
  );
}
