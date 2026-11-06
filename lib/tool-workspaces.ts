export const TOOL_WORKSPACES = [
  { id: "resume", title: "Resume Studio", href: "/build", description: "Build, check, and improve one resume.", paths: ["/build", "/resume-maker", "/resume-builder", "/resume-tailoring", "/checker", "/ats-xray", "/resume-fixer", "/github-resume", "/ai-humanizer", "/resume-summary-generator", "/resume-bullet-points-generator", "/work-experience-generator", "/cv-converter"] },
  { id: "fit", title: "Jobs & Fit", href: "/resume-match", description: "Find roles, compare requirements, and close real gaps.", paths: ["/resume-match", "/resume-compare", "/skill-gap", "/career-map", "/free-certifications", "/tools/job-clipper", "/jobs"] },
  { id: "linkedin", title: "LinkedIn", href: "/linkedin-checker", description: "Review your profile and improve its headline and story.", paths: ["/linkedin-checker", "/linkedin-headline-generator", "/career-summary-generator"] },
  { id: "letters", title: "Letters", href: "/cover-letter-generator", description: "Write and review letters from your own facts.", paths: ["/cover-letter-generator", "/cover-letter-analyzer", "/resignation-letter-generator"] },
  { id: "interview", title: "Interview Practice", href: "/interview-prep", description: "Rehearse answers, prepare references, and follow up.", paths: ["/interview-prep", "/interview-questions", "/thank-you-note-generator", "/reference-prep-generator", "/30-60-90-day-plan-generator"] },
  { id: "offers", title: "Salary & Offers", href: "/salaries", description: "Research pay, compare offers, and prepare to negotiate.", paths: ["/salaries", "/offer-calculator", "/salary-negotiation-script"] },
] as const;

export function toolWorkspaceForPath(path: string) {
  const pathname = path.split(/[?#]/u)[0].replace(/\/$/u, "") || "/";
  return TOOL_WORKSPACES.find((workspace) => workspace.paths.some((route) => pathname === route || pathname.startsWith(`${route}/`)));
}
