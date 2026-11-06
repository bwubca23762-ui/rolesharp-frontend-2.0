# rolesharp

## Which doc is the truth

One branch: `main`. Nothing else is live work. Read in this order:

| Question | File |
|---|---|
| What is the state right now, and what do I do next? | `ROLESHARP-PROGRESS.md` — top block only |
| How does the system fit together? | `docs/ARCHITECTURE.md` |
| What are the visual rules? | `DESIGN.md`, then `REDESIGN-SPEC.md` (the current layer on top of it) |
| Is that redesign batch done? | `REDESIGN-TRACKER.md` |
| How do I run or roll back the job workflows? | `docs/JOBS-WORKFLOWS-*.md` |

Everything under `docs/reports/`, `docs/archive/`, `audits/` and any file with a
date in its name is **historical evidence, not current guidance**. It was true on
the day it was written. Verify against the code before acting on it.

## Two rules that are easy to get wrong

1. **`npm test` is not the whole suite.** `npm test` is the node suite;
   `npx playwright test` is the e2e suite. This repo reported "388/388 green"
   for weeks while ten e2e tests were red.
2. **Every push to `main` adds an entry at the top of `ROLESHARP-PROGRESS.md`,
   in the same push.** A push that changes behaviour without one is incomplete.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
