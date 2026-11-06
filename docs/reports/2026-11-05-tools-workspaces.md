# Career workspaces, interview practice, and job coverage

The tools catalogue and signed-in navigation now group related pages into six
workspaces: Resume Studio, Jobs & Fit, LinkedIn, Letters, Interview Practice,
and Salary & Offers. Existing tool URLs stay available. Each tool links back
to its workspace and provides a collapsed list of related tools.

## What changed

- Catalogue search and workspace filters show all 28 registered tools with
  their access requirements. Free generators remain available without login.
- The legacy cover-letter analyzer endpoint now enforces the same Premium
  access as the main endpoint.
- Interview Practice starts with resume selection and practice. The panel,
  evidence card, and question list are available on demand. Changing resumes
  clears the previous practice session. Spending a credit refreshes the balance.
- With Redis unavailable, Next.js route bundles in the same process now share
  their fallback interview sessions. Redis is still required for reliable
  cross-process sessions. Audio requests have timeouts, and replaced or
  unmounted players release their audio resources.
- Feedback recognizes employer and role names as context, without treating them
  as skill evidence. Speaking pace counts all spoken words.
- Resume Match and Skill Gap sample actions load the examples even when a
  workspace draft is present. Sample actions clear stale outputs on these tools,
  Resume Compare, and CV Converter. Resume Language Polish describes its
  style checks as heuristics and preserves its existing URL.

## Verification

| Check | Result |
| --- | --- |
| Tool page layout | 30 pages at 390px and 1280px; no document overflow |
| Catalogue controls | Workspace filters, search, empty results, and reset |
| Browser generator flows | Nine sample-to-result flows |
| Analytical browser flows | Resume Match, Skill Gap, and Resume Language Polish |
| Functional HTTP smoke | 28 assertions, including free generators, analyzer access, GitHub import, cover letter, and PDF/DOCX exports |
| Interview browser flow | Five free questions completed, restart, resume switching, credit unlock, three panel responses, and evidence card |
| Configured voice provider | Synthetic speech and recorded-answer transcription/coaching returned results |
| Local database integrity | Ordered migrations and repeat application passed on a disposable database |

The layout sweep checks rendering, not every control or possible account state.
The voice check used synthetic audio; browser microphone capture was not tested.
Local evidence is under `.omo/evidence/2026-11-05-tools/` and contains synthetic
fixtures only. Production user resumes were not used.

## Job coverage

The production snapshot showed 366 enabled search profiles across 72 markets
and about 152,600 unexpired listings. Recent search activity and stored results
do not necessarily represent unique new jobs.

Migration `080_expand_job_sector_profiles.sql` adds up to 54 searches for
healthcare, education, logistics, hospitality, retail, and operations in India,
the US, the UK, Canada, the UAE, Germany, France, Spain, and Japan. It reuses
existing providers, staggers the first runs, refreshes daily, and preserves
existing profile settings. After activation, compare unique fresh jobs, failure
rates, and queue backlog per market before expanding further.

## WhatsApp proposal

Pilot a daily digest of three to five fresh matches for Premium members who
opt in. Respect role, country, remote preferences, timezone, and quiet hours.
Skip days without strong matches, deduplicate jobs, and link to RoleSharp for
the full listing. Give members an immediate pause and opt-out option.

Use the official WhatsApp Business Platform with a verified recipient number,
explicit consent, approved templates when required, signed delivery webhooks,
and an outbox that checks access and consent at dispatch. Confirm the approved
template category and cost before enabling sends. Track delivery, job opens,
saved jobs, opt-outs, and cost per engaged member. This feature was evaluated
only; no WhatsApp messages were configured or sent.

- [WhatsApp Business Messaging Policy](https://whatsappbusiness.com/policy/)
- [WhatsApp Business Platform pricing](https://whatsappbusiness.com/products/platform-pricing/)
