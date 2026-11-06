# Resume Checker Hardcore Audit — 2026-07-11

Adversarial audit of `lib/resume-checker.ts` (powers the generated-resume ATS score, the live builder meter via `lib/ats-score.ts`, and the public `/ats-resume-checker` through `/api/check-resume`).

## Attack surface reviewed

`/api/check-resume`: zod-bounded (resume ≤30K, JD ≤20K), rate-limited (20/min/IP), no auth required (by design — free tool). No user input reaches `new RegExp` unescaped after this audit.

## Findings & fixes (all fixed, all verified)

| # | Severity | Finding | Before → After |
|---|---|---|---|
| 1 | High (DoS) | **ReDoS** in email detection: `[A-Z0-9.-]+\.[A-Z]{2,}` backtracks quadratically on `a@` + 29K dots | 522ms → **6.7ms** per request. Domain class no longer contains `.`; bounded quantifiers. Plus a 40K hard cap on analyzed text inside `checkResume` (defense in depth). |
| 2 | High (integrity) | **JD-copy cheat**: appending the raw JD to a resume scored 93 "Excellent" (the classic white-text ATS trick) | 93 → **73 "Needs work"** + explicit `jd-copy` fail check. Detection: 10-word JD shingles found verbatim in the resume; >25% overlap = −12, >50% = −20. |
| 3 | High (integrity) | **Duplicate-bullet spam**: one metric bullet ×40 scored 79 "Strong" | 79 → **65** + `duplicate-bullets` warn check. Ratios/volume now computed on unique bullets only. |
| 4 | High (fairness) | **Unicode bullet glyphs dropped**: Word/Canva exports use `●▪‣–◦`; only `-•*` were recognized, so a perfect resume scored 78 | 78 → **100**. Marker class expanded. |
| 5 | Medium (product) | **Non-Latin resumes** (Hindi 50, Arabic 44) were confidently graded "Weak" with English-tuned advice | Score unchanged (analysis genuinely can't grade them) but now: `language` warn check, confidence forced to **Low**, honest messaging. |
| 6 | Low | `targetRole` first-word matched with `.includes` — "IT Support" matched any word containing "it"; also `new RegExp` on role would have crashed on "C++ Developer" | Word-boundary regex with escaping. |
| 7 | Low | Keyword soup with fake headings scored 73 | 73 → **61** (falls out of fixes 2+3). |

## Verified unaffected

- Legit generated resumes: free 99, premium 100 (unchanged).
- `npm run test:ats`: 4/4 pass. `tsc` + `eslint` clean.
- CRLF, NBSP, ALL-CAPS, 30K real resumes, empty JD: all sane (<8ms worst case).
- Privacy-risk and table-risk checks fire correctly.

## Known limitations (accepted, documented)

- Non-English resumes are flagged, not scored properly — real i18n scoring is a separate project.
- The `phone` regex accepts any 9+ digit run; harmless (detection only).
- `sectionPresent` misses exotic headings like "Skills & Tools" (falls back gracefully via other section signals).
