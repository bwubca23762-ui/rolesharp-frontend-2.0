// Country- and role-aware placeholder examples for the builder. Replaces the old
// hardcoded India-only placeholders (Aarav Sharma / Bhubaneswar / Tally, GST /
// Utkal University) that gave non-Indian visitors a bad impression.
//
// All values are neutral examples shown as input placeholders only — never saved.

type Examples = {
  name: string;
  phone: string;
  city: string;
  skills: string;
  education: string;
  projects: string;
  certs: string;
  languages: string;
  achievements: string;
};

// Per-country: a representative name, phone format, city, education sample, and
// the degree-grade term (GPA vs CGPA). Keyed by country NAME (matches state var).
const COUNTRY: Record<string, { name: string; phone: string; city: string; gradeTerm: string; eduYear: string; languages: string }> = {
  "United States":        { name: "Alex Morgan",   phone: "+1 555 010 2000", city: "San Francisco", gradeTerm: "GPA 3.8/4.0",  eduYear: "2026", languages: "English, Spanish" },
  "United Kingdom":       { name: "James Smith",    phone: "+44 7700 900123", city: "London",        gradeTerm: "First-class honours", eduYear: "2026", languages: "English, French" },
  "Canada":              { name: "Jordan Lee",     phone: "+1 416 555 0123", city: "Toronto",       gradeTerm: "GPA 3.8/4.0",  eduYear: "2026", languages: "English, French" },
  "Australia":           { name: "Riley Jones",    phone: "+61 4 1234 5678", city: "Sydney",        gradeTerm: "Distinction average", eduYear: "2026", languages: "English" },
  "India":               { name: "Aarav Sharma",   phone: "+91 98765 43210", city: "Bengaluru",     gradeTerm: "CGPA 8.1/10",  eduYear: "2026", languages: "English, Hindi" },
  "United Arab Emirates":{ name: "Omar Al Farsi",  phone: "+971 50 123 4567",city: "Dubai",         gradeTerm: "GPA 3.8/4.0",  eduYear: "2026", languages: "English, Arabic" },
  "Germany":             { name: "Lukas Müller",   phone: "+49 151 23456789",city: "Berlin",        gradeTerm: "Note 1.3",     eduYear: "2026", languages: "German, English" },
  "Singapore":           { name: "Wei Tan",        phone: "+65 8123 4567",   city: "Singapore",     gradeTerm: "GPA 4.8/5.0",  eduYear: "2026", languages: "English, Mandarin" },
  "New Zealand":         { name: "Charlie Wilson", phone: "+64 21 123 4567", city: "Auckland",      gradeTerm: "A average",    eduYear: "2026", languages: "English" },
  "South Africa":        { name: "Thabo Nkosi",    phone: "+27 71 123 4567", city: "Johannesburg",  gradeTerm: "Distinction",  eduYear: "2026", languages: "English, Zulu" },
};

const DEFAULT_COUNTRY = { name: "Your full name", phone: "+1 555 010 2000", city: "City", gradeTerm: "GPA / grade", eduYear: "2026", languages: "English" };

// Per-role example content. Matched loosely against the typed role title.
const ROLE: { match: RegExp; skills: string; degree: string; projects: string; certs: string }[] = [
  { match: /(software|developer|engineer|programmer|full.?stack|backend|frontend)/i,
    skills: "JavaScript, React, Node.js, Python, SQL, Git, REST APIs, AWS",
    degree: "B.S. Computer Science",
    projects: "Task Manager App | Built a full-stack app with React and Node, cut task-tracking time 30%\nPortfolio Site | Designed and shipped a responsive personal site",
    certs: "AWS Certified Developer, Meta Front-End" },
  { match: /(data|analyst|scientist|analytics|bi\b)/i,
    skills: "SQL, Python, Excel, Power BI, Tableau, data visualization, statistics",
    degree: "B.S. Statistics",
    projects: "Sales Dashboard | Built a Power BI dashboard tracking 5 KPIs for the sales team\nChurn Analysis | Modeled customer churn in Python, surfaced 3 key drivers",
    certs: "Google Data Analytics, Microsoft Power BI" },
  { match: /(product manager|product owner|\bpm\b)/i,
    skills: "product strategy, roadmapping, Agile, user research, SQL, A/B testing, stakeholder management",
    degree: "MBA",
    projects: "Onboarding Revamp | Led a redesign that lifted activation 18%\nMobile Launch | Shipped v1 of a mobile app from spec to release",
    certs: "Certified Scrum Product Owner (CSPO)" },
  { match: /(market|seo|content|growth|brand)/i,
    skills: "SEO, content marketing, Google Analytics, email marketing, paid ads, copywriting, social media",
    degree: "B.A. Marketing",
    projects: "SEO Overhaul | Grew organic traffic 40% in 6 months\nEmail Campaign | Ran a nurture series with a 22% open rate",
    certs: "Google Analytics, HubSpot Inbound" },
  { match: /(account|finance|audit|tax|bookkeep)/i,
    skills: "Excel, financial reporting, reconciliation, accounts payable, GAAP, QuickBooks, budgeting",
    degree: "B.S. Accounting",
    projects: "Month-End Close | Streamlined close from 8 to 5 days\nExpense Dashboard | Built a pivot-table dashboard for monthly spend",
    certs: "CPA (in progress), Advanced Excel" },
  { match: /(nurse|clinical|health|medical|care)/i,
    skills: "patient care, medication administration, EHR, vital signs, care planning, patient education",
    degree: "BSN Nursing",
    projects: "Care Protocol | Helped roll out a fall-prevention protocol on the unit",
    certs: "RN License, BLS, ACLS" },
  { match: /(sales|business development|account executive|\bsdr\b|\bbdr\b)/i,
    skills: "prospecting, CRM (Salesforce), cold outreach, lead qualification, negotiation, pipeline management",
    degree: "B.A. Business",
    projects: "Outbound Sprint | Booked 30 qualified meetings in one quarter",
    certs: "Salesforce Certified, HubSpot Sales" },
  { match: /(design|graphic|ux|ui|creative)/i,
    skills: "Figma, Photoshop, Illustrator, typography, layout, branding, prototyping",
    degree: "BFA Design",
    projects: "Brand Refresh | Redesigned a client's identity across web and print\nApp Redesign | Reworked a checkout flow, cut drop-off 15%",
    certs: "Adobe Certified Professional" },
  { match: /(project|program|delivery|scrum|operations)/i,
    skills: "project management, Agile, Scrum, stakeholder management, risk management, Jira, budgeting",
    degree: "B.S. Business",
    projects: "Platform Migration | Delivered a cross-team migration on time and under budget",
    certs: "PMP, Certified ScrumMaster (CSM)" },
];

const DEFAULT_ROLE = {
  skills: "communication, teamwork, problem solving, Microsoft Office, time management",
  degree: "Your degree",
  projects: "Project name | What you built and the result it delivered",
  certs: "Relevant certifications",
};

export function buildExamples(country: string, role: string): Examples {
  const c = COUNTRY[country] ?? DEFAULT_COUNTRY;
  const r = ROLE.find((x) => x.match.test(role || "")) ?? DEFAULT_ROLE;
  return {
    name: c.name,
    phone: c.phone,
    city: c.city,
    skills: r.skills,
    education: `${r.degree} | University name | ${c.eduYear} | ${c.gradeTerm}`,
    projects: r.projects,
    certs: r.certs,
    languages: c.languages,
    achievements: "Volunteer / club activity\nA competition, award, or challenge you completed",
  };
}
