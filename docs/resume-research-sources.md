# RoleSharp resume and CV evidence standard

Reviewed: 2026-07-22

## Product rule

RoleSharp separates three kinds of guidance:

1. **Verified market guidance** — supported by a current government, public-employment, supranational, occupational-data, or ATS-vendor source.
2. **Sector inference** — generic advice inferred from a company's sector, never represented as the company's own rule.
3. **Employer-specific requirement** — only a current vacancy, application form, or official employer careers page can establish this.

A country convention must never force or prohibit a photo. The builder may require a photo only when an explicit, verified employer/application rule says it is required. Where evidence is missing, the default is a one-to-two-page, single-column, photo-free resume and a reminder to follow the vacancy.

## Verified market matrix

| Market | General length | Photo default | Important exception | Primary sources |
|---|---:|---|---|---|
| United States | 1–2 pages | Discouraged | Federal applications use the announcement's fields and may have a two-page cap | [EEOC hiring guidance](https://www.eeoc.gov/prohibited-employment-policiespractices), [USAJOBS resume fields](https://help.usajobs.gov/faq/application/documents/resume/what-to-include) |
| United Kingdom | 1–2 pages | Discouraged | Civil Service vacancies may use name-blind evidence | [National Careers Service](https://nationalcareers.service.gov.uk/careers-advice/cv-sections/), [DWP JobHelp](https://jobhelp.campaign.gov.uk/preparing-your-cv/) |
| Canada | 1–2 pages | Discouraged | Never include a SIN | [Government of Canada Job Bank](https://www.jobbank.gc.ca/findajob/resources/write-good-resume) |
| Australia | 1–3 pages | Discouraged | APS information packs can require longer applications | [Australian Human Rights Commission](https://humanrights.gov.au/our-work/disability-rights/writing-resume-cover-letter), [Queensland Government](https://www.qld.gov.au/jobs/finding/resume) |
| New Zealand | 1–3 pages | Discouraged | Include work status/availability where relevant | [New Zealand Careers](https://www.careers.govt.nz/job-hunting/applying-for-jobs/how-to-apply-for-a-job/) |
| Germany | 1–2 pages | Optional/customary | Photo is no longer mandatory | [Bundesagentur für Arbeit](https://www.arbeitsagentur.de/bildung/bewerbung/lebenslauf) |
| France | 1–2 pages | Optional, limited evidence | A second page is reasonable when it holds relevant supporting detail | [France Travail](https://www.francetravail.fr/candidat/vos-recherches/preparer-votre-candidature/cv-lettre-de-motivation-e-mail/cv-sur-2-pages--une-bonne-idee.html) |
| Japan | Official form or employer format | Optional/customary | Employer may request both rirekisho and shokumukeirekisho | [MHLW resume example](https://www.hellowork.mhlw.go.jp/doc/kouroushourirekisho.pdf), [MHLW fair recruitment](https://kouseisaiyou.mhlw.go.jp/jobseekers.html) |
| EU / Europass | Tailored to vacancy | Optional field, not a requirement | Europass is a reusable profile/export format, not a universal employer mandate | [Europass CV](https://europass.europa.eu/en/create-europass-cv) |

India, Singapore, UAE, and other unsupported markets deliberately use the conservative default until a suitable current primary source is recorded. Search-engine articles, staffing blogs, and generic career blogs are not sufficient to create a mandatory rule.

## ATS format evidence

- [Greenhouse supported upload formats](https://support.greenhouse.io/hc/en-us/articles/360052218132-Supported-formats-for-resumes-cover-letters-and-other-candidate-uploads) include DOC, DOCX, PDF, RTF, and TXT. Format support does not guarantee perfect extraction.
- [Lever resume parsing](https://help.lever.co/s/article/Understanding-Resume-Parsing) explains that image files cannot be parsed and recommends checking whether resume text is selectable. This supports RoleSharp's warning against scanned/image-only resumes.
- A clean single column, standard headings, selectable text, and manual review of parsed application fields remain the safest cross-ATS default. RoleSharp must not claim a company uses a particular ATS unless a current company-controlled application URL or verified record supports it.

## Keyword and occupation evidence

RoleSharp combines the vacancy's wording with normalized occupation data, but recommends only skills the candidate can truthfully evidence.

- [O*NET Database](https://www.onetcenter.org/database.html) provides occupation titles, tasks, skills, work activities, technology skills, and related descriptors for the U.S. market.
- [ESCO classification](https://esco.ec.europa.eu/en/classification) provides multilingual occupations, skills, preferred/non-preferred terms, and occupation-skill relationships for European and global normalization.
- [LinkedIn Skills Match](https://www.linkedin.com/help/linkedin/answer/a793433) documents explicit and implicit skill matching between a member's experience and a job description. This supports exact phrases plus conservative aliases—not keyword stuffing.

Keyword matches use whole tokens or phrases. For example, `JavaScript` does not satisfy `Java`. Required and preferred role skills remain separate in analysis. Job-description sentences copied verbatim are penalized; supported terms should appear beside the candidate's own evidence.

## Maintenance policy

- Recheck sources at least every six months and whenever an application system changes.
- Store source URL, authority, evidence level, and review date with each market rule.
- Mark unreachable or conflicting evidence as `limited`; do not silently preserve an old strong claim.
- Employer rules expire unless reverified from the employer's current application flow.
- Never infer an ATS vendor from company size, country, or sector.
