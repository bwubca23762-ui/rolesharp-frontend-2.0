type ResumeRuleSource = {
  title: string;
  url: string;
  authority: string;
};

export type ResumeMarketRules = {
  pages: string;
  dateFormat: string;
  sections: string[];
  photo: "no" | "optional";
  photoPolicy: {
    status: "discouraged" | "optional" | "customary";
    verified: boolean;
    rationale: string;
  };
  evidenceLevel: "verified" | "limited";
  personalDetailsToOmit?: string[];
  applicationNotes?: string[];
  sources: ResumeRuleSource[];
  reviewedAt: string;
};

const REVIEWED_AT = "2026-07-22";

// Only primary government, public-employment, supranational, or ATS-vendor
// sources belong here. A market convention never becomes a mandatory rule:
// only an explicit employer/application instruction may require a photo,
// document type, page count, or special field.
export const VERIFIED_RESUME_MARKET_RULES: Record<string, ResumeMarketRules> = {
  US: {
    pages: "1-2",
    dateFormat: "MMM YYYY",
    sections: ["summary", "experience", "skills", "education"],
    photo: "no",
    photoPolicy: { status: "discouraged", verified: true, rationale: "The EEOC says employers should not request applicant photographs before an accepted offer." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["photo", "date of birth", "age", "marital status", "religion", "government ID"],
    applicationNotes: ["Federal applications are a separate format: follow the announcement and include month/year, hours per week, and required specialized-experience evidence.", "Current USAJOBS announcements may impose a two-page resume limit; the announcement controls."],
    sources: [
      { title: "Prohibited Employment Policies/Practices", url: "https://www.eeoc.gov/prohibited-employment-policiespractices", authority: "U.S. Equal Employment Opportunity Commission" },
      { title: "What should I include in my federal resume?", url: "https://help.usajobs.gov/faq/application/documents/resume/what-to-include", authority: "USAJOBS" },
    ], reviewedAt: REVIEWED_AT,
  },
  GB: {
    pages: "1-2",
    dateFormat: "MMM YYYY",
    sections: ["personal statement", "experience", "skills", "education"],
    photo: "no",
    photoPolicy: { status: "discouraged", verified: true, rationale: "UK public careers guidance recommends a concise CV and omitting a photo unless an application specifically requires one." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["photo", "date of birth", "age", "marital status", "religion"],
    applicationNotes: ["Civil Service applications may use name-blind recruitment and role-specific evidence; follow the vacancy instructions."],
    sources: [
      { title: "CV sections", url: "https://nationalcareers.service.gov.uk/careers-advice/cv-sections", authority: "UK National Careers Service" },
      { title: "Preparing your CV", url: "https://jobhelp.campaign.gov.uk/preparing-your-cv/", authority: "UK Department for Work and Pensions" },
    ], reviewedAt: REVIEWED_AT,
  },
  CA: {
    pages: "1-2",
    dateFormat: "MMM YYYY",
    sections: ["summary", "experience", "skills", "education", "volunteer experience"],
    photo: "no",
    photoPolicy: { status: "discouraged", verified: true, rationale: "Canada's Job Bank says pictures are not the norm and can reduce consideration." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["photo", "age", "height", "weight", "marital status", "religion", "political affiliation", "social insurance number"],
    sources: [{ title: "How to write a good resume", url: "https://www.jobbank.gc.ca/findajob/resources/write-good-resume", authority: "Government of Canada Job Bank" }],
    reviewedAt: REVIEWED_AT,
  },
  AU: {
    pages: "1-3",
    dateFormat: "MMM YYYY",
    sections: ["professional summary", "experience", "skills", "education"],
    photo: "no",
    photoPolicy: { status: "discouraged", verified: true, rationale: "Australian government guidance says a resume does not need a photo or unrelated personal characteristics." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["photo", "date of birth", "gender", "marital status"],
    applicationNotes: ["Australian Public Service applications can require a longer CV and separate selection evidence; the candidate information pack controls."],
    sources: [
      { title: "Writing a resume and cover letter", url: "https://humanrights.gov.au/our-work/disability-rights/writing-resume-cover-letter", authority: "Australian Human Rights Commission" },
      { title: "How to write a resume", url: "https://www.qld.gov.au/jobs/finding/resume", authority: "Queensland Government" },
    ], reviewedAt: REVIEWED_AT,
  },
  NZ: {
    pages: "1-3",
    dateFormat: "MMM YYYY",
    sections: ["summary", "skills", "experience", "education"],
    photo: "no",
    photoPolicy: { status: "discouraged", verified: true, rationale: "New Zealand government career guidance tells applicants not to include a photo or protected personal details." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["photo", "age", "ethnicity", "gender", "children", "marital status"],
    sources: [{ title: "How to apply for a job", url: "https://www.careers.govt.nz/job-hunting/applying-for-jobs/how-to-apply-for-a-job/", authority: "New Zealand Government Careers" }],
    reviewedAt: REVIEWED_AT,
  },
  DE: {
    pages: "1-2",
    dateFormat: "MM/YYYY",
    sections: ["personal details", "work experience", "education", "skills", "languages"],
    photo: "optional",
    photoPolicy: { status: "customary", verified: true, rationale: "Germany's Federal Employment Agency says an application photo is no longer mandatory and may be included optionally." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["marital status", "religion"],
    sources: [{ title: "Lebenslauf erstellen", url: "https://www.arbeitsagentur.de/bildung/bewerbung/lebenslauf", authority: "Bundesagentur für Arbeit" }],
    reviewedAt: REVIEWED_AT,
  },
  FR: {
    pages: "1-2",
    dateFormat: "MM/YYYY",
    sections: ["profile", "experience", "skills", "education", "languages"],
    photo: "optional",
    photoPolicy: { status: "optional", verified: false, rationale: "No universal photo requirement was found in the primary source; leave it out unless the vacancy requests it." },
    evidenceLevel: "limited",
    sources: [{ title: "CV sur 2 pages : une bonne idée ?", url: "https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/cv-sur-2-pages--une-bonne-idee.html", authority: "France Travail" }],
    reviewedAt: REVIEWED_AT,
  },
  JP: {
    pages: "1-2",
    dateFormat: "YYYY/MM",
    sections: ["personal details", "education", "work history", "licenses and qualifications", "motivation and strengths"],
    photo: "optional",
    photoPolicy: { status: "customary", verified: true, rationale: "Japan's official resume example provides a photo position only when a photo is necessary; the employer's instructions control." },
    evidenceLevel: "verified",
    personalDetailsToOmit: ["family information", "unrelated beliefs or affiliations"],
    applicationNotes: ["Japanese applications may use both a rirekisho and a separate shokumukeirekisho; do not force a Western one-page layout when the employer requests those forms."],
    sources: [
      { title: "Ministry of Health, Labour and Welfare resume example", url: "https://www.hellowork.mhlw.go.jp/doc/kouroushourirekisho.pdf", authority: "Japan Ministry of Health, Labour and Welfare" },
      { title: "Fair recruitment for job seekers", url: "https://kouseisaiyou.mhlw.go.jp/jobseekers.html", authority: "Japan Ministry of Health, Labour and Welfare" },
    ], reviewedAt: REVIEWED_AT,
  },
};

export const SAFE_DEFAULT_RESUME_RULES: ResumeMarketRules = {
  pages: "1-2",
  dateFormat: "MMM YYYY",
  sections: ["summary", "experience", "skills", "education"],
  photo: "optional",
  photoPolicy: { status: "optional", verified: false, rationale: "No current primary source establishes a universal market rule. Follow the vacancy; the privacy-safe default is no photo." },
  evidenceLevel: "limited",
  personalDetailsToOmit: ["government ID", "unrelated sensitive personal information"],
  applicationNotes: ["Employer, occupation, visa, government, and academic application instructions override this general default."],
  sources: [],
  reviewedAt: REVIEWED_AT,
};

export function resumeMarketRules(countryCode?: string | null): ResumeMarketRules {
  return VERIFIED_RESUME_MARKET_RULES[(countryCode ?? "").toUpperCase()] ?? SAFE_DEFAULT_RESUME_RULES;
}
