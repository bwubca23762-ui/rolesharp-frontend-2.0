type AcademyGuide = { href: string; title: string; time: string };
export type AcademyModule = { title: string; description: string; guides: AcademyGuide[]; cta: { href: string; text: string } };
export type PromptStrategy = { title: string; subtitle: string; steps: string[]; prompt: string };

// Plain data shared by the public Academy/prompt pages and /llms-full.txt.
// Keeping this separate from JSX prevents the AI bundle from importing UI
// components or silently drifting away from the visible content.
export const ACADEMY_MODULES: AcademyModule[] = [
  {
    title: "Module 1: Foundation — Fix What's Broken",
    description: "Start with an existing resume: score it, find weak spots, and fix the biggest problems first.",
    guides: [
      { href: "/blog/fix-old-resume-or-build-new", title: "Fix an old resume or build new — which is smarter?", time: "4 min" },
      { href: "/blog/what-is-a-good-ats-score", title: "What a good ATS score means", time: "5 min" },
      { href: "/blog/resume-action-verbs-that-sound-strong", title: "Resume action verbs that sound stronger", time: "6 min" },
      { href: "/resume-maker/help", title: "How country-aware photo guidance works", time: "4 min" },
    ],
    cta: { href: "/resume-fixer", text: "Fix my old resume" },
  },
  {
    title: "Module 2: Build — Create a Strong Draft",
    description: "Build an ATS-friendly resume from scratch or improve an existing structure with layout, keywords, and proof.",
    guides: [
      { href: "/blog/ats-friendly-resume-2026", title: "How to build an ATS-friendly resume (2026 guide)", time: "8 min" },
      { href: "/blog/ats-friendly-resume-without-sounding-generic", title: "ATS-friendly resume without sounding generic", time: "6 min" },
      { href: "/blog/best-resume-format-for-freshers", title: "Best resume format for freshers", time: "7 min" },
      { href: "/cover-letter-examples", title: "Cover letter examples for every role in 2026", time: "5 min" },
    ],
    cta: { href: "/resume-maker", text: "Build a resume manually" },
  },
  {
    title: "Module 3: Tailor — Match the Job",
    description: "Make one resume speak directly to one company and one role instead of sending one generic draft everywhere.",
    guides: [
      { href: "/blog/tailor-student-resume-for-internships", title: "How students can tailor one resume for internships", time: "6 min" },
      { href: "/blog/ats-friendly-resume-2026", title: "How to build an ATS-friendly resume in 2026", time: "8 min" },
      { href: "/blog/tailor-resume-to-job-description", title: "How to tailor a resume for a specific company", time: "7 min" },
      { href: "/blog/what-is-a-good-ats-score", title: "What to do when your ATS score is low", time: "5 min" },
    ],
    cta: { href: "/build", text: "AI-tailor my resume" },
  },
  {
    title: "Module 4: Apply — Land More Interviews",
    description: "Send stronger applications, find jobs, track applications, and follow up with more confidence.",
    guides: [
      { href: "/blog/job-search-faq", title: "Job search FAQ — everything you need to know", time: "8 min" },
      { href: "/blog/remote-job-resume-guide", title: "Remote job resume tips that actually work", time: "5 min" },
      { href: "/blog/linkedin-headline-examples-job-seekers", title: "LinkedIn headline examples for job seekers", time: "5 min" },
      { href: "/auto-apply", title: "How controlled application email works", time: "5 min" },
    ],
    cta: { href: "/jobs", text: "Find fresh jobs" },
  },
  {
    title: "Module 5: Interview — Prepare to Win",
    description: "Prepare strong answers, use the STAR method, and walk into interviews ready to discuss your evidence.",
    guides: [
      { href: "/interview-prep", title: "Common interview questions and how to answer them", time: "8 min" },
      { href: "/interview-prep", title: "STAR method interview examples for every role", time: "7 min" },
      { href: "/interview-prep", title: "Virtual interview preparation and delivery", time: "5 min" },
      { href: "/roles", title: "Choose a role-specific resume guide", time: "6 min" },
    ],
    cta: { href: "/interview-prep", text: "Prep for interviews" },
  },
  {
    title: "Module 6: Tools — Use the Right Stack",
    description: "Understand when to use AI, manual editing, ATS checks, templates, and comparison research together.",
    guides: [
      { href: "/blog/best-ai-resume-builders-2026", title: "7 best AI resume builders in 2026 — honest comparison", time: "8 min" },
      { href: "/blog/what-is-a-good-ats-score", title: "What is a good ATS score in 2026?", time: "5 min" },
      { href: "/blog/workday-ats-resume-guide", title: "Workday ATS resume guide — everything to know", time: "6 min" },
      { href: "/blog/resume-pdf-or-docx", title: "How to export your resume as PDF without breaking", time: "4 min" },
    ],
    cta: { href: "/compare", text: "Compare resume builders" },
  },
];

export const ACADEMY_FAQS: [string, string][] = [
  ["Is RoleSharp Academy free?", "Yes. Every guide, module, and tool referenced in the Academy is free. The resume fixer, ATS checker, and manual maker work without signup or payment."],
  ["How long does it take to complete?", "Each module takes about 20–30 minutes. You can complete the full Academy in about two to three hours or jump to the module that matches your current need."],
  ["Do I need to follow the modules in order?", "No. Start with Foundation or Build if you need a resume, then jump to Tailor, Apply, Interview, or Tools based on your job-search stage."],
  ["What if I already have a strong resume?", "Start with Tailor. Even a strong resume needs fine-tuning for each specific company and role so the relevant evidence is easier to find."],
  ["Can I download these guides?", "The guides are published as blog posts and can be bookmarked or shared. The content is free and accessible on any device."],
];

export const PROMPT_STRATEGIES: PromptStrategy[] = [
  {
    title: "Keyword Match Optimization", subtitle: "How RoleSharp scores a resume against a job description",
    steps: ["Extract noun phrases and skill terms from the job description", "Cross-reference them against the resume", "Suggest missing terms only where real experience supports them", "Avoid keyword stuffing"],
    prompt: "I'll give you a resume and a job description. For each keyword in the job description that is MISSING from the resume, suggest where it could be added naturally — only where you can back it up with something the candidate actually did. Do NOT invent experience.",
  },
  {
    title: "Bullet-to-Metric Transformation", subtitle: "Turn responsibility statements into evidence-based bullets",
    steps: ["Flag bullets beginning with weak phrases such as Responsible for or Worked on", "Ask for scope, metric, and outcome", "Rewrite with an action verb, scope, and result", "Make each bullet answer so what?"],
    prompt: "Rewrite this resume bullet to start with a strong action verb and end with a measurable result. Use the format: [Action Verb] [what you did] for/in/with [scope], achieving/improving/reducing [metric]. Do not invent metrics.",
  },
  {
    title: "Company-Specific Tailoring", subtitle: "Make one resume read like it was written for one employer",
    steps: ["Use the company and job description as context", "Prioritize experience matching the employer's needs", "Mirror accurate terminology from the posting", "Put the most relevant evidence first"],
    prompt: "Given this company name and job description, rewrite the resume summary and top 3 experience bullets to use the company's exact terminology and the job-posting terms. The resume should read like it was written specifically for [COMPANY]. Do not invent experience.",
  },
  {
    title: "The ATS-Friendly Format", subtitle: "Keep resume structure parseable",
    steps: ["Use a single-column layout", "Use standard headings such as Summary, Experience, Education, and Skills", "Avoid tables, sidebars, graphics, and text in images", "Export as text-based PDF or DOCX"],
    prompt: "Analyze this resume layout. List every element that could cause an ATS parser to fail: tables, columns, images, icons, unusual headings, headers/footers, non-standard fonts, and embedded charts. For each issue, explain exactly what to change.",
  },
  {
    title: "Cover Letter Generator Strategy", subtitle: "Connect the letter to the actual company and role",
    steps: ["Open with the company and role", "Map three job requirements to real experience", "Mention a specific company signal when verified", "Close with a clear next step"],
    prompt: "Write a cover letter for [ROLE] at [COMPANY]. Reference 3 specific requirements from this job description and connect each to a real experience from the candidate's resume. Do not invent company news or candidate facts. Keep it under 250 words.",
  },
  {
    title: "LinkedIn Profile Strategy", subtitle: "Improve recruiter search and first-impression clarity",
    steps: ["State the target role and specialty in the headline", "Use first-person, specific About copy", "Add quantified results to experience", "Use role-relevant search terms"],
    prompt: "Rewrite this LinkedIn About section in first person. Start with current role and specialty, include 2–3 specific achievements from the source, and add accurate skill terms for [TARGET ROLE]. Keep it professional and conversational. Do not invent metrics.",
  },
];

export const PROMPT_FAQS: [string, string][] = [
  ["Can I copy these prompts and use them myself?", "Yes. You can adapt these prompts for ChatGPT, Claude, Gemini, or another language model. RoleSharp automates the workflow and keeps the output grounded in the candidate's facts."],
  ["Do these prompts work with any AI tool?", "They are written in plain language and work with most general-purpose language models that accept text instructions."],
  ["How is RoleSharp different from using prompts manually?", "RoleSharp combines the strategies with structured resume data, company and role context, ATS scoring, and export workflows instead of making you run each prompt separately."],
  ["Which strategy should I use first?", "Start with ATS-friendly formatting and keyword matching, then strengthen bullets with scope and measurable outcomes."],
  ["Will using AI make my resume sound generic?", "It should not when the input contains real facts, numbers, tools, and outcomes. AI should organize and sharpen evidence, not invent it."],
  ["Where can I see what the results look like?", "Use the free ATS checker for a score and fix list, or use the AI builder with a real job description to generate a tailored resume."],
];

export const PUBLIC_GUIDE_CONTENT = [
  {
    title: "Controlled application email and Daily Matches",
    url: "/auto-apply",
    answer: "RoleSharp Daily Matches can send one digest of up to ten newly seen jobs per user-local day. RoleSharp Apply can prepare and send a tailored CV only when a stored posting explicitly accepts email applications and exposes a source-backed recipient. It does not submit ATS or job-board forms, guess recruiter addresses, or automatically retry an uncertain provider outcome.",
  },
  {
    title: "ATS-safe resume templates",
    url: "/resume-templates",
    answer: "An ATS-friendly resume template uses one column, standard headings, selectable text, ordinary fonts, and no tables, sidebars, graphics, or text inside images. RoleSharp templates prioritize parseability before visual variety.",
  },
  {
    title: "Resume examples by role",
    url: "/resume-examples",
    answer: "A strong role-specific resume example shows the target title, relevant skills, job-posting language, and quantified achievements in a clean ATS-readable structure. The example should guide the candidate without encouraging copied or invented experience.",
  },
  {
    title: "Cover letter examples by role",
    url: "/cover-letter-examples",
    answer: "A useful cover letter names the company and role, connects one or two real achievements to the job requirements, matches the employer's tone, and ends with a clear next step instead of repeating the resume.",
  },
];
