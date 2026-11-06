# RoleSharp SEO keyword ownership

This map assigns one indexable URL to each search intent. Keep synonyms on the
same owner page instead of publishing a second landing page for the same query.
Google does not use the `meta keywords` tag, so keywords belong naturally in
titles, descriptions, headings, direct answers, body copy, and link anchors.

| Owner URL | Primary query | Supporting queries | Intent |
| --- | --- | --- | --- |
| `/checker` | free ATS resume checker | ATS score checker, resume score checker, resume grader, resume scanner, CV checker, resume keyword scanner, match resume to job description | Use a free diagnostic tool |
| `/resume-fixer` | free resume fixer | resume optimizer, improve old resume, fix weak resume bullets, ATS resume repair | Diagnose and repair an existing resume |
| `/resume-builder` | free AI resume builder | online resume builder, ATS resume builder, professional resume maker | Compare builder paths and start building |
| `/build` | job description resume builder | tailored resume builder, company-specific resume builder, resume tailored to a job | Build for one exact opening |
| `/resume-maker` | manual resume builder | resume maker without AI, make your own resume, free PDF resume maker | Build manually |
| `/students` | free resume builder for students | student resume builder, resume with no experience, internship resume builder, college resume builder | Claim the student offer and build |
| `/internships` | internship search | find internships, internship finder, student internships, remote internships | Find current internship listings |
| `/internships/[country]` | internships in `[country]` | student internships in `[country]`, remote internships in `[country]` | Find internships in one market |
| `/resume-templates` | free ATS resume templates | ATS-friendly resume template, simple resume template, single-column resume template | Browse safe layouts |
| `/resume-examples` | resume examples | resume samples by role, ATS resume example, professional resume examples | Review examples before building |
| `/cover-letter-generator` | AI cover letter generator | cover letter from job description, tailored cover letter generator | Generate a job-specific letter |
| `/interview-prep` | AI interview preparation | interview questions from resume, job-specific interview prep | Prepare after building |
| `/linkedin-checker` | LinkedIn profile checker | LinkedIn score, LinkedIn headline checker, recruiter profile review | Improve a profile |
| `/resume-translator` | resume country adapter | international resume format, resume format by country, adapt CV for another country | Localize a resume |
| `/roles/[role]` | `[role] resume` | `[role] resume skills`, `[role] resume example`, ATS `[role]` template | Explore one role |
| `/companies/[company]` | `[company] resume` | `[company] resume guide`, resume for `[company]`, how to apply to `[company]` | Explore one employer |
| `/resume/[company]/[role]` | `[role] resume for [company]` | `[company] [role] resume example`, `[company] [role] keywords` | Build for one employer and role |

## Consolidated aliases

- `/ats-resume-checker` permanently redirects to `/checker` and must not appear
  in sitemaps or internal links.
- Do not create `/resume-score-checker`, `/resume-grader`, `/cv-checker`, or
  `/resume-keyword-scanner`; those phrases belong to `/checker`.
- Do not create another generic AI builder page; `/resume-builder` owns the
  broad query and `/build` owns job-description/company tailoring.

## Content priorities

1. Strengthen `/checker`, `/resume-builder`, `/build`, `/resume-fixer`, and
   `/students` before adding more programmatic URLs.
2. Publish evidence-led guides for question queries already linked from product
   pages: good ATS score, ATS-friendly formatting, missing resume keywords,
   student resumes without experience, and tailoring to a job description.
3. Review Google Search Console queries monthly. Merge or redirect pages that
   receive impressions for the same query, and expand pages that rank positions
   8-20 with better direct answers and internal links.
