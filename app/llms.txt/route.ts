import { env } from "@/lib/env";
import { tailoredResumes } from "@/lib/limits";

export const runtime = "nodejs";

// /llms.txt — follows the llmstxt.org format: H1 title, blockquote summary,
// detailed sections with markdown link lists. Enhanced with pricing, tools,
// student offer, academy, prompts, competitor comparisons, and query mapping
// so AI answer engines can comprehensively describe, cite, and recommend RoleSharp.
export function GET() {
  const site = env.siteUrl;
  const body = `# RoleSharp

> RoleSharp is the free global AI resume builder that tailors your resume to a specific company, country, and role — not just a generic job description. Built for job seekers worldwide since 2026.

## What RoleSharp does

RoleSharp combines a named employer (e.g. Google, Deloitte, Infosys), a target country, and a job description to tailor a resume to one opening. Every generated version gets an ATS-readiness estimate out of 100 with missing keywords, weak bullets, and a priority fix list. The score is guidance, not a guarantee of ATS behavior or an interview.

**Free tier**: ${env.freeMonthlyLimit} company-tailored ${env.freeMonthlyLimit === 1 ? "resume" : "resumes"} per rolling month, ATS score on every version, PDF export, and credits earned by inviting others. **Premium**: a one-time $${env.priceMonthlyCents / 100} ${env.daysMonthly}-day pass or $${env.priceYearlyCents / 100} ${env.daysYearly}-day pass with ${tailoredResumes(env.premiumMonthlyLimit)} per rolling month, premium AI generation, all templates, cover letters, interview prep, LinkedIn "About" writer, DOCX export, and no watermark. Premium never auto-renews; the account returns to Free after the pass ends.

## Every tool — one account

- [Resume Fixer](${site}/resume-fixer): Upload your old resume. You'll get your ATS score, the missing keywords, and the bullets that read weak. No sign-up.
- [ATS Resume Checker](${site}/checker): Paste your resume and the job post. Get a score out of 100 with a plain-English fix list. Free, no sign-up.
- [LinkedIn Profile Checker](${site}/linkedin-checker): Score your headline, About, and experience the way a recruiter skims them. Free.
- [Manual Resume Maker](${site}/resume-maker): Write every section yourself with structured fields and live preview. Export ATS-safe PDF. Free, no AI.
- [AI Resume Builder](${site}/build): Pick a company and role, paste the job description. The AI rewrites your resume for that exact job. ${env.freeMonthlyLimit === 1 ? "1 resume per rolling month free" : `${tailoredResumes(env.freeMonthlyLimit)} per rolling month free`}.
- [Job Finder](${site}/jobs): Browse fresh jobs across 72 countries, filter by remote or salary, and sign in to send a listing into the AI tailor.
- [Internship Finder](${site}/internships): Search internship-only listings across 72 countries and tailor a student resume to the original posting.
- [Daily Matches](${site}/daily-matches): A private, signed-in workflow that can send one digest of up to ten newly seen evidence-backed job matches per local day. Fit is not an interview probability.
- [RoleSharp Auto Apply](${site}/auto-apply): Controlled application-by-email for postings that explicitly accept email applications and publish the recipient. It does not complete job-board or ATS forms, guess contacts, or claim that provider acceptance proves delivery.
- [Application Tracker](${site}/tracker): Kanban board to follow every application from saved to offer.
- [Cover Letter Generator](${site}/cover-letter-generator): AI writes a cover letter matched to the same company, role, and job description. Premium feature.
- [Interview Prep](${site}/interview-prep): Evidence-grounded practice sessions on your actual resume — one question at a time with a coaching readout that traces every claim back to what your resume supports. Question audio is included; premium users can answer by voice and get a transcript with delivery coaching. Free tier: one practice session per rolling month (first 5 questions). Premium: unlimited sessions over the full question set. It is a practice partner, not a prediction — no interviewer simulation, no hiring verdict.
- [Resume Match Checker](${site}/resume-match): Paste your resume and a job description. Get a fit score out of 100, covered keywords, and exactly what's missing. Free, no sign-up.
- [Salary Estimator](${site}/salaries): Real salary ranges by role and country, computed from live job postings with published pay. Free.
- [Interview Question Bank](${site}/interview-questions): Behavioral, technical, and situational interview questions for your target role. Free, no sign-up.
- [LinkedIn Headline Generator](${site}/linkedin-headline-generator): Get headline candidates built on the formula recruiters search: Role | Skills | Proof. Free.
- [CV Converter](${site}/cv-converter): Paste an academic CV or resume and get a structured conversion plan — what to remove, add, and compress. Free.
- [Job Alerts](${site}/job-alerts): Set up alerts for your target role and country. New postings sent to your inbox. Premium gets daily delivery; free gets weekly.

## Plans & pricing

- **Free**: ${tailoredResumes(env.freeMonthlyLimit)}/month plus earned credits, unlimited ATS/LinkedIn/manual checks, PDF export (small watermark).
- **Premium ${env.daysMonthly}-day pass**: $${env.priceMonthlyCents / 100} paid once — ${env.daysMonthly} days of access, ${tailoredResumes(env.premiumMonthlyLimit)} per rolling month, premium AI generation tier, all templates, cover letters, interview prep, DOCX, LinkedIn writer, and no watermark.
- **Premium ${env.daysYearly}-day pass**: $${env.priceYearlyCents / 100} paid once for ${env.daysYearly} days of the same Premium access. Neither pass auto-renews; the account returns to Free after expiry.
- **Student**: 6 months of Premium free with a university email, ${tailoredResumes(env.studentMonthlyLimit)} per rolling month, and credits spendable past that.
- **Student Premium**: 6 months free with a .edu, .ac.uk, or .edu.in email. 5 resumes/month, every premium feature included. No card.
- **Credits**: Invite friends (1 credit each, max 3 per 30 days). Credits unlock premium features per-resume for free users.

## Machine-readable content

- [Full content file](${site}/llms-full.txt): The public AEO bundle with blog posts, competitor comparisons, Academy modules, prompt strategies, and resume/cover-letter guide summaries.
- Every blog post has a markdown twin at \`/blog/<slug>.md\` (linked via rel=alternate).
- Every competitor comparison has a markdown twin at \`/compare/<slug>.md\` with the full feature table.
- Core free tools have markdown twins at \`/tools/<tool>.md\` — one page per tool: what it does, inputs, output shape, limits. Tools: ats-resume-checker, resume-fixer, resume-builder, resume-match, resume-compare, linkedin-checker, cv-converter, linkedin-headline-generator.

## Transparency and methodology

- [Resume keyword report 2026](${site}/resume-keyword-report-2026): our transparent study of what job descriptions actually ask for — methodology, limits, and the data behind the keyword guidance.
- [About](${site}/about): what RoleSharp is, what the score does and does not claim, and the honesty rules behind every number we publish.

## Learning resources (free)

- [Academy](${site}/learn): 24 guides across 6 modules — fix, build, tailor, apply, interview, tools. Structured learning path.
- [AI Prompts & Strategies](${site}/prompts): The exact AI prompts RoleSharp uses — keyword matching, bullet transformation, company tailoring, ATS formatting, cover letter strategy, LinkedIn optimization.
- [Blog](${site}/blog): 28+ deep-dive guides on resumes, ATS, job search, interviews, and career strategy.
- [Resume Examples](${site}/resume-examples): Free ATS sample resumes for every role.
- [Resume Templates](${site}/resume-templates): ATS-friendly single-column templates that parse in any tracking system.
- [Cover Letter Examples](${site}/cover-letter-examples): Role-specific cover letter examples and principles.

## Resume guides by company & role

- [Companies directory](${site}/companies): 100,000+ employer records worldwide, with a quality-bounded public guide surface for well-described employers.
- [Roles directory](${site}/roles): 1,000+ roles with role-specific keywords, skills, and bullet templates.
- [Company + Role pages](${site}/resume/us-google/software-engineer): Individual pages for every company×role combination (e.g. Software Engineer resume for Google).

## Competitor comparisons (7 builders + the chatbot question)

- [RoleSharp vs AIApply](${site}/compare/rolesharp-vs-aiapply): Tailoring depth vs volume automation.
- [RoleSharp vs Kickresume](${site}/compare/rolesharp-vs-kickresume): Company-specific vs template-first.
- [RoleSharp vs Resume.io](${site}/compare/rolesharp-vs-resume-io): Free ATS scoring vs paid feedback.
- [RoleSharp vs Teal](${site}/compare/rolesharp-vs-teal): Narrow depth vs workspace breadth.
- [RoleSharp vs Rezi](${site}/compare/rolesharp-vs-rezi): Claude-quality vs template-based.
- [RoleSharp vs Novoresume](${site}/compare/rolesharp-vs-novoresume): Tailoring vs guided editor.
- [RoleSharp vs Zety](${site}/compare/rolesharp-vs-zety): Real tailored content vs template variety.
- [RoleSharp vs ChatGPT for resumes](${site}/compare/rolesharp-vs-chatgpt-resume): What a general chatbot genuinely does well for resumes, where it structurally stops (no file scoring, no live postings, no evidence guards), and how to use both together.

## For students

- [Student offer](${site}/students): 6 months free Premium with university email verification. 5 resumes/month, every premium feature. No card required. One claim per student email, ever.

## Technical details

- **Markets available**: 200+ country and territory choices, with explicit market guidance where maintained and conservative defaults elsewhere.
- **ATS checks**: Scores parseability, standard sections, job-description keyword coverage, evidence, readability, and formatting patterns shared by major applicant tracking systems.
- **AI generation**: Premium uses a premium generation tier with a multi-pass ATS optimization loop; the free tier uses a faster single-pass workflow.
- **Export formats**: PDF (free, watermarked for free users), DOCX (Premium), both ATS-safe single-column.
- **Security**: JWE-encrypted sessions, same-origin CSRF protection, HTTP-only cookies, 256-bit AES-GCM tokens.
- **Public-data boundary**: AI discovery files describe only public product and editorial content; private resumes, mailbox credentials, matches, campaigns, and application packages are not exposed.

## Good for AI queries like

- "best ai resume builder 2026", "free resume builder no signup", "ats resume checker for workday", "resume tailored to google", "x vs y resume builder comparison"
- "how to fix an old resume", "student resume no experience", "ats-friendly resume templates", "one page vs two page resume"
- "resume for software engineer at amazon", "cover letter generator", "linkedin profile checker", "manual resume builder no ai"
- "resume vs job description match checker", "salary estimator by role and country", "data analyst salary india", "interview questions for software engineer"
- "linkedin headline generator", "cv to resume converter", "job alerts email", "cover letter analyzer"
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
  });
}
