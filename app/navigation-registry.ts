import {
  Activity,
  Briefcase,
  Coins,
  CreditCard,
  FileText,
  Globe,
  GraduationCap,
  Grid,
  LifeBuoy,
  Linkedin,
  Lock,
  Shield,
  Sparkles,
  Target,
  User,
} from "./icons";
import type { IconProps } from "./icons";

export type NavigationIcon = (props: IconProps) => React.JSX.Element;
export type NavigationAudience = "public" | "authenticated";
export type NavigationGroupId = "products" | "tools" | "jobs" | "resources" | "workspace" | "account";

export type NavigationRoute = {
  href: string;
  label: string;
  shortLabel?: string;
  description: string;
  icon: NavigationIcon;
  audience?: NavigationAudience;
  activePaths?: readonly string[];
};

export type NavigationSection = {
  id: string;
  label: string;
  routes: readonly NavigationRoute[];
};

export type NavigationGroup = {
  id: NavigationGroupId;
  label: string;
  kicker: string;
  sections: readonly NavigationSection[];
};

const resumeFixerRoute = { href: "/resume-fixer", label: "Resume Fixer", description: "Upload a resume and get ranked, evidence-based fixes.", icon: Sparkles } as const satisfies NavigationRoute;
const aiBuilderRoute = { href: "/build", label: "AI Resume Builder", description: "Tailor your evidence to one exact job.", icon: Target } as const satisfies NavigationRoute;
const checkerRoute = { href: "/checker", label: "ATS Checker", description: "Score keywords, structure, and impact.", icon: Shield } as const satisfies NavigationRoute;
const manualBuilderRoute = { href: "/resume-maker", label: "Manual Builder", description: "Build and export without using AI.", icon: FileText } as const satisfies NavigationRoute;
const linkedinRoute = { href: "/linkedin-checker", label: "LinkedIn Checker", description: "Improve what recruiters find first.", icon: Linkedin } as const satisfies NavigationRoute;
const coverLetterRoute = { href: "/cover-letter-generator", label: "Cover Letter", description: "Write a letter grounded in your resume.", icon: FileText } as const satisfies NavigationRoute;
const jobsRoute = { href: "/jobs", label: "Find Jobs", description: "Search current roles across supported markets.", icon: Briefcase } as const satisfies NavigationRoute;
const trackerRoute = { href: "/tracker", label: "Application Tracker", shortLabel: "Tracker", description: "Track stages, follow-ups, and the send ledger.", icon: Briefcase } as const satisfies NavigationRoute;
const autoApplyRoute = { href: "/auto-apply", label: "Controlled Auto Apply", shortLabel: "Auto Apply", description: "Posting-backed email applications with strict safeguards.", icon: Activity } as const satisfies NavigationRoute;
const interviewRoute = { href: "/interview-prep", label: "Interview Practice", description: "Rehearse questions grounded in your saved resume.", icon: Sparkles } as const satisfies NavigationRoute;
const dailyMatchesRoute = { href: "/daily-matches", label: "Daily Matches", description: "Review evidence-based private match snapshots.", icon: Sparkles, audience: "authenticated" } as const satisfies NavigationRoute;
const queueRoute = { href: "/application-queue", label: "Application Queue", description: "Review immutable packages and delivery outcomes.", icon: FileText, audience: "authenticated" } as const satisfies NavigationRoute;
const autoMailJobsRoute = { href: "/daily-matches", label: "Auto Mail Jobs", description: "Review evidence-based private matches and digest history.", icon: Sparkles } as const satisfies NavigationRoute;
const emailSendingJobsRoute = { href: "/application-queue", label: "Email-Sending Jobs", description: "Review posting-backed application emails and delivery outcomes.", icon: FileText } as const satisfies NavigationRoute;
const emailRoute = { href: "/email-connection", label: "Email Connection", description: "Manage a separate send-only provider connection.", icon: Shield, audience: "authenticated" } as const satisfies NavigationRoute;
const campaignRoute = { href: "/campaign-settings", label: "Campaign Settings", description: "Set evidence thresholds, consent, and daily limits.", icon: Target, audience: "authenticated" } as const satisfies NavigationRoute;
// One name everywhere for /dashboard: the top-nav link, the context tab, and
// any menu all say "Dashboard" — it used to read Workspace/Overview/Dashboard
// on three surfaces, which read as three different pages.
const dashboardRoute = { href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", description: "Resumes, usage, applications, and account status.", icon: Grid, audience: "authenticated" } as const satisfies NavigationRoute;
const settingsRoute = { href: "/settings", label: "Account settings", shortLabel: "Settings", description: "Access, credits, profile, and security.", icon: User, audience: "authenticated", activePaths: ["/settings", "/billing", "/account", "/security"] } as const satisfies NavigationRoute;
const supportRoute = { href: "/support", label: "Support", description: "Billing, login, export, and setup help.", icon: LifeBuoy, audience: "authenticated" } as const satisfies NavigationRoute;

// The free standalone generators: no account, one job each. They are the
// logged-out entry points, so they need somewhere to be found from.
const summaryToolRoute = { href: "/resume-summary-generator", label: "Summary Generator", description: "Turn your role and results into a summary.", icon: Sparkles } as const satisfies NavigationRoute;
const bulletToolRoute = { href: "/resume-bullet-points-generator", label: "Bullet Point Generator", shortLabel: "Bullet Points", description: "Rewrite what you did as evidence.", icon: Target } as const satisfies NavigationRoute;
const experienceToolRoute = { href: "/work-experience-generator", label: "Work Experience Generator", shortLabel: "Work Experience", description: "Rank your bullets against one posting.", icon: Briefcase } as const satisfies NavigationRoute;
const careerToolRoute = { href: "/career-summary-generator", label: "Career Summary Generator", shortLabel: "Career Summary", description: "Read across every role you have held.", icon: FileText } as const satisfies NavigationRoute;
const resignationToolRoute = { href: "/resignation-letter-generator", label: "Resignation Letter", description: "Leave well, with the right last day.", icon: FileText } as const satisfies NavigationRoute;const skillGapToolRoute = { href: "/skill-gap", label: "Skill Gap Check", shortLabel: "Skill Gap", description: "What a target role wants that your resume does not show.", icon: Target } as const satisfies NavigationRoute;
const toolsHubRoute = { href: "/tools", label: "All Free Tools", description: "Every free checker, generator, and research tool in one catalogue.", icon: Grid } as const satisfies NavigationRoute;
const resumeMatchToolRoute = { href: "/resume-match", label: "Resume Match Checker", shortLabel: "Match Check", description: "Score your resume against a job description, free.", icon: Shield } as const satisfies NavigationRoute;

const letterTemplatesRoute = { href: "/cover-letter-templates", label: "Cover Letter Templates", shortLabel: "Letter Templates", description: "Six letter structures, one set of facts.", icon: FileText } as const satisfies NavigationRoute;

const templatesRoute = { href: "/resume-templates", label: "Templates", description: "Inspect clean, ATS-safe resume layouts.", icon: Grid } as const satisfies NavigationRoute;
const examplesRoute = { href: "/resume-examples", label: "Resume Examples", description: "Role-specific examples with clear provenance.", icon: FileText } as const satisfies NavigationRoute;
const rolesRoute = { href: "/roles", label: "Role Guides", description: "Explore role-specific requirements and language.", icon: Target } as const satisfies NavigationRoute;
const companiesRoute = { href: "/companies", label: "Company Guides", description: "Research hiring context by employer.", icon: Briefcase } as const satisfies NavigationRoute;
const countryRoute = { href: "/resume-translator", label: "Country Resume Adapter", shortLabel: "Country Adapter", description: "Adapt a resume for 200+ markets.", icon: Globe } as const satisfies NavigationRoute;
const academyRoute = { href: "/learn", label: "Career Academy", shortLabel: "Academy", description: "Free, practical application guides.", icon: GraduationCap } as const satisfies NavigationRoute;
const certificationsRoute = { href: "/free-certifications", label: "Free Certifications", description: "Find verified free learning and provider-issued credentials.", icon: GraduationCap } as const satisfies NavigationRoute;
const guideRoute = { href: "/job-search-guide", label: "Job Search Guide", shortLabel: "Guide", description: "Seven steps, free, downloadable as a PDF.", icon: GraduationCap } as const satisfies NavigationRoute;
const careerMapRoute = { href: "/career-map", label: "Career Map", description: "Roles that share the skills you already have.", icon: Target } as const satisfies NavigationRoute;
const personalPagesRoute = { href: "/u", label: "Personal Pages", shortLabel: "Pages", description: "Résumé and portfolio pages published with RoleSharp.", icon: Grid } as const satisfies NavigationRoute;
const safetyRoute = { href: "/internship-reports", label: "Internship Safety", description: "Research suspicious internship listings.", icon: Shield } as const satisfies NavigationRoute;
const compareRoute = { href: "/compare", label: "Compare RoleSharp", description: "Review dated, source-governed comparisons.", icon: FileText } as const satisfies NavigationRoute;
const blogRoute = { href: "/blog", label: "Career Blog", description: "In-depth research on ATS algorithms, resume strategy, and AI builders.", icon: FileText } as const satisfies NavigationRoute;
const aboutRoute = { href: "/about", label: "About & Methodology", description: "How RoleSharp handles evidence, limits, and corrections.", icon: Shield } as const satisfies NavigationRoute;
const studentsRoute = { href: "/students", label: "Student Offer", description: "6 months of Premium free with a verified university email.", icon: Sparkles } as const satisfies NavigationRoute;

const billingRoute = { href: "/billing", label: "Billing & Access", description: "Fixed-term access, allowance, checkout, and payment history.", icon: CreditCard, audience: "authenticated" } as const satisfies NavigationRoute;
const creditsRoute = { href: "/settings?tab=credits", label: "Credits & Referrals", description: "Use or earn additional generations.", icon: Coins, audience: "authenticated" } as const satisfies NavigationRoute;
const profileRoute = { href: "/account", label: "Profile & Email", description: "Email address and verification status.", icon: User, audience: "authenticated" } as const satisfies NavigationRoute;
const securityRoute = { href: "/security", label: "Security", description: "Password, sign-in safety, and account deletion.", icon: Lock, audience: "authenticated" } as const satisfies NavigationRoute;
const studentRoute = { href: "/settings?tab=student", label: "Student Plan", description: "Education-email Premium offer.", icon: GraduationCap, audience: "authenticated" } as const satisfies NavigationRoute;

const salaryEstimatorRoute = { href: "/salaries", label: "Salary Estimator", shortLabel: "Salaries", description: "Real salary ranges from live job postings.", icon: Coins } as const satisfies NavigationRoute;
const interviewBankRoute = { href: "/interview-questions", label: "Interview Questions", description: "Practice by role — behavioral, technical, situational.", icon: FileText } as const satisfies NavigationRoute;
const resumeCompareRoute = { href: "/resume-compare", label: "Resume Version Compare", shortLabel: "Compare Versions", description: "Score two drafts against one posting and see which wins.", icon: Grid } as const satisfies NavigationRoute;
const jobAlertsRoute = { href: "/job-alerts", label: "Job Alerts", description: "New postings for your role emailed to you.", icon: Target, audience: "authenticated" } as const satisfies NavigationRoute;

// Free standalone generators got their own top-level group: "Products" held
// fifteen links in one dropdown and every other entry drowned. Now no desktop
// menu exceeds seven items.
const toolsSections = [
  { id: "free-checkers", label: "Check & score", routes: [toolsHubRoute, resumeMatchToolRoute, skillGapToolRoute, resumeCompareRoute] },
  { id: "free-generators", label: "Generators", routes: [summaryToolRoute, bulletToolRoute, experienceToolRoute, careerToolRoute, resignationToolRoute] },
] as const satisfies readonly NavigationSection[];

const productSections = [
  { id: "build-improve", label: "Build & improve", routes: [resumeFixerRoute, aiBuilderRoute, checkerRoute, manualBuilderRoute, linkedinRoute, coverLetterRoute] },
  { id: "apply-organize", label: "Apply & organize", routes: [trackerRoute, autoApplyRoute, interviewRoute] },
  { id: "salary-interview", label: "Salary & interview prep", routes: [salaryEstimatorRoute, interviewBankRoute] },
] as const satisfies readonly NavigationSection[];

const jobsSections = [
  { id: "job-discovery", label: "Discover", routes: [jobsRoute] },
  { id: "job-mail", label: "Job mail workflows", routes: [autoMailJobsRoute, emailSendingJobsRoute, jobAlertsRoute] },
] as const satisfies readonly NavigationSection[];

const resourceSections = [
  { id: "examples-research", label: "Examples & research", routes: [examplesRoute, letterTemplatesRoute, rolesRoute, careerMapRoute, certificationsRoute, personalPagesRoute, companiesRoute, countryRoute] },
  { id: "guidance-trust", label: "Guidance & trust", routes: [blogRoute, guideRoute, academyRoute, safetyRoute, compareRoute, aboutRoute, studentsRoute] },
] as const satisfies readonly NavigationSection[];

const workspaceSections = [
  { id: "workspace-core", label: "Workspace", routes: [dashboardRoute, dailyMatchesRoute, queueRoute, trackerRoute] },
  { id: "workspace-controls", label: "Application controls", routes: [autoApplyRoute, emailRoute, campaignRoute, settingsRoute] },
] as const satisfies readonly NavigationSection[];

const accountSections = [
  { id: "plan-profile", label: "Plan & profile", routes: [billingRoute, creditsRoute, profileRoute, securityRoute] },
  { id: "help-access", label: "Access & help", routes: [studentRoute, supportRoute] },
] as const satisfies readonly NavigationSection[];

export const NAVIGATION_GROUPS = [
  { id: "products", label: "Products", kicker: "From resume evidence to application follow-through", sections: productSections },
  { id: "tools", label: "Free Tools", kicker: "No account needed — one job each", sections: toolsSections },
  { id: "jobs", label: "Jobs", kicker: "Discover roles, review matches, and manage application email", sections: jobsSections },
  { id: "resources", label: "Resources", kicker: "Examples, research, guidance, and methodology", sections: resourceSections },
  { id: "workspace", label: "Workspace", kicker: "Your private RoleSharp workflow", sections: workspaceSections },
  { id: "account", label: "Account", kicker: "Account, plan, and support", sections: accountSections },
] as const satisfies readonly NavigationGroup[];

export const FEATURED_WORKFLOW_ROUTE = {
  href: "/#application-journey",
  label: "Check → Tailor → Apply → Track",
  description: "See how evidence and job context stay connected across the application workflow.",
  icon: Activity,
} as const satisfies NavigationRoute;

export const PUBLIC_DESKTOP_ROUTES = [
  templatesRoute,
  { href: "/pricing", label: "Pricing", description: "Compare Free, Premium, and Student access.", icon: CreditCard },
] as const satisfies readonly NavigationRoute[];

export const AUTHENTICATED_WORKSPACE_ROUTES: readonly NavigationRoute[] = [
  dashboardRoute,
  dailyMatchesRoute,
  queueRoute,
  trackerRoute,
  autoApplyRoute,
  emailRoute,
  campaignRoute,
  settingsRoute,
  supportRoute,
];
export const WORKSPACE_CONTEXT_ROUTES: readonly NavigationRoute[] = AUTHENTICATED_WORKSPACE_ROUTES;

const WORKSPACE_ROUTE_PREFIXES = [
  "/dashboard",
  "/daily-matches",
  "/application-queue",
  "/tracker",
  "/auto-apply",
  "/email-connection",
  "/campaign-settings",
  "/settings",
  "/billing",
  "/account",
  "/security",
  "/support",
] as const;

export function routesForAudience(routes: readonly NavigationRoute[], loggedIn: boolean) {
  return routes.filter((route) => route.audience !== "authenticated" || loggedIn);
}

export function groupRoutes(group: NavigationGroup) {
  return group.sections.flatMap((section) => section.routes);
}

export function isOperationalWorkspacePath(pathname: string) {
  return WORKSPACE_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isNavigationRouteActive(pathname: string, href: string, activePaths?: readonly string[]) {
  const hrefPath = href.split(/[?#]/)[0] || "/";
  const routes = activePaths ?? [hrefPath];
  return routes.some((route) => route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`));
}

export function findNavigationGroup(id: NavigationGroupId) {
  return NAVIGATION_GROUPS.find((group) => group.id === id)!;
}
