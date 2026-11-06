# VOICE INTERVIEW PLAN — spending the Google Cloud credits honestly

> Forward guidance for Phase 5 item 14 of `docs/GROWTH-PLAN.md`. Written
> 2026-09-05 after pricing research (sources: Google's Gemini API pricing page,
> Google Cloud STT/TTS pricing, current third-party rate trackers, all checked
> 2026-09-05 — re-verify at build time, Google moves these quarterly).
>
> The fuel: **₹28,664 (~$340) of Google Cloud credits, expiring 3 December
> 2026**, converting to pay-as-you-go after expiry. The plan is paced to
> consume the credits inside the window and to make post-expiry billing
> structurally impossible.

---

## 0. What the credits buy, decided up front

**The competitor benchmark** (StartHack.io, see GROWTH-PLAN §5) sells a 25-minute
AI voice interview with a "hiring verdict." Our version is a **practice
partner**: per-answer coaching readouts, STAR scaffolds from the user's own
evidence, and a final breakdown — never a verdict on the person (boundary
ledger, GROWTH-PLAN §1).

### The architecture decision: turn-based, not realtime

An interview is naturally turn-based — question, answer, feedback, next
question. Realtime full-duplex (Gemini Live) buys nothing for that shape and
costs ~6× more, plus a 10-minute session cap that fights a 25-minute interview.

**Per-answer multimodal calls win on every axis:**

| Approach | Cost / 25-min session | Infra | Notes |
|---|---|---|---|
| **A. Turn-based (chosen)** | **~$0.15–0.25** | HTTPS POST per answer, no streaming infra | One multimodal Gemini call per answer does *transcribe + evaluate + pick next question* in a single round trip |
| B. Gemini Live realtime | ~$0.90 | WebSocket/WebRTC + session-resumption logic for >10 min | Only worth revisiting if A's latency proves inadequate (unlikely) |

A-side cost decomposition (current Sept-2026 rates):
- Speech→text: Gemini Flash **audio understanding** ≈ $0.057/hour of audio
  (~12 min of user speech per session ≈ $0.012). Chirp STT v2 ($0.016/min) is
  8× pricier for the same job and loses the fused evaluation.
- Evaluation + next-question: ~12 turns × ~4k tokens on Flash-class text
  ≈ $0.10–0.15.
- Text→speech for question audio: Gemini Flash TTS ≈ $6/1M output audio tokens
  (25 tok/s) — a 20-second question ≈ $0.003. **And our questions are
  deterministic per resume+role** (the interview route already caches them), so
  TTS output is cached per question hash and amortizes to ~zero for repeats.

**Credit runway:** $340 ≈ 1,400–2,200 turn-based sessions — far more than the
beta and launch-window demand through 3 December, with headroom reserved for
the Evidence Study (§4).

---

## 0b. Two tiers (owner decision, 2026-09-05)

| | **Free tier** | **Premium tier** |
|---|---|---|
| Sessions | **1 practice session per rolling month** | Unlimited (within rate limits) |
| Questions | First 5 of the evidence set | Full set |
| Readouts | **Deterministic, evidence-overlap only — zero AI cost, forever** | LLM-reviewed coaching (V-3) |
| Voice (when it lands) | Routed to the **LAST gateway in the chain** (cheapest provider — Atomesus / free Gemini keys), browser Web Speech transcription where available (zero cost), cached TTS only, short session (5 questions) | Routed to the **FIRST gateway** (Claude proxy → primary Gemini), full multimodal quality, TTS + recorded answers |
| Gateway rule | `voiceGatewayFor("free") → "last"` | `voiceGatewayFor("premium") → "first"` |

The free tier is a conversion hook with a hard ceiling: it must cost
approximately zero (deterministic readouts; the gateway-last rule means free
AI traffic only ever lands on providers that are free or already paid for),
and it must visibly withhold the premium experience (full sessions, reviewed
readouts, voice quality) so the upgrade line is honest. The rule is encoded in
`lib/interview-session.ts` and pinned by test from V-1, so voice (V-2/V-3)
inherits it rather than inventing it.

---

## 1. Safety rails (build these FIRST, before any API call)

1. **Budget alerts at 50/80/95%** of ₹28,664 on the billing account, owner
   email wired. Scope them to the `rolesharp-voice` project so the auth
   project's (zero-cost) OAuth traffic never triggers noise.
2. **Quota caps, not just alerts**: Vertex AI quotas per model set below
   projected peak (start ~200 requests/day across audio+TTS; raise deliberately).
3. **The expiry cliff**: 3 December 2026 the credits end and pay-as-you-go
   begins. Set a calendar block for **25 November**: if the voice feature is
   not self-sustaining on its own pricing, either disable the voice gateway in
   admin (one switch, the gateways panel) or cap it hard. *Nothing may be able
   to bill after expiry without a human decision.* Write the date into the
   admin voice-gateway panel description.
4. **Service account, not user keys**: one dedicated service account with only
   Vertex AI user + STT/TTS roles, JSON key stored in the VPS env as
   `GCP_SERVICE_ACCOUNT_JSON`, never in git.
5. **Audio retention policy (boundary)**: we record per-answer audio **only for
   transcription**; the audio object is deleted the moment the transcript +
   evaluation are persisted. Stored forever: transcript, scores, coaching
   readout — user-visible, user-deletable. **No screen captures, no ambient
   recording, no "integrity verification"** (the explicit contrast with
   StartHack's privacy footprint). This policy goes on the feature page.

---

## 2. Build phases (V-0 … V-6)

### V-0 — GCP plumbing (half day, no product code)

**Project decision (owner, 2026-09-05):** the owner's GCP account is at its
project limit, so the dedicated-project plan is replaced by **same-project
with guardrails** — voice runs inside the existing auth project
(`GOOGLE_CLIENT_ID/SECRET`, `STAFF_GOOGLE_CLIENT_ID/SECRET`). This is
acceptable: OAuth clients do not consume API quota, and enabling Vertex AI
cannot disturb them. The guardrails that substitute for project isolation:

1. **Least-privilege service account**: create `rolesharp-voice-runner` with
   ONLY **Vertex AI User**. Never reuse or touch the existing service
   accounts/keys. The new JSON key goes to the VPS env as
   `GCP_SERVICE_ACCOUNT_JSON` and nowhere else.
2. **Nothing existing is modified**: no key rotation, no consent-screen edits,
   no IAM changes to existing principals. Voice is purely additive.
3. **Budget alerts scoped to the project** still work — and since the auth
   project itself has zero spend (OAuth is free), every rupee the alerts see
   IS voice spend. Simpler than the split plan.
4. **Migration path**: if the project-limit increase is ever granted, the same
   service account can be granted Vertex AI User on a fresh project and the
   VPS env's project ID changes in one line. Plan for it; don't wait for it.

Then, in the existing project: enable **Vertex AI API** (+ Cloud TTS only if
we fall back to classic voices).
- Add a **`geminiAudio` gateway** to the admin gateways panel (the same UI that
  manages `claudeProxy`/Gemini rotation): base URL (native Gemini API or
  Vertex endpoint), key/service-account, model, per-day request cap. Audio
  calls go through `lib/llm.ts` gateway resolution so admin keeps one control
  surface and the expiry switch (§1.3) exists from day one.
- Track spend: admin system view already shows gateway health — add
  `requests today` per gateway so cost is observable from the console.

### V-1 — Turn engine, text mode (no credits, de-risks the LLM flow)
Upgrade the existing premium interview prep (`app/api/interview/route.ts`,
`lib/interview-star.ts`) from "one static page of questions + STAR scaffolds"
to an **interactive turn flow**, still text-only:
- Session state (Redis, existing infra): current question index, per-answer
  records, resume+role context.
- `POST /api/interview/[id]/answer` → evaluate the typed answer against the
  evidence (evidence-overlap already computed in `interview-star.ts`), produce
  a coaching readout (what landed, what had no evidence behind it, what a
  follow-up question would probe), advance to the next question.
- Free users see the existing static page; the interactive flow is the same
  premium gate as today. **This ships value even if voice never lands** — and
  its endpoint shape is exactly what voice reuses with an audio field added.
- Node tests pin: evidence-overlap readouts, no invented content, gate
  contract (402 shape), double-fire guard on submit.

### V-2 — Question audio (first credits, ~$0.03/session amortizing to ~0)
- Server endpoint synthesizes a question's audio via **Gemini Flash TTS**
  (`gemini-*preview-tts`), caches by `sha(question)` in the worker cache
  (Redis + file store on the VPS), serves with long-lived cache headers.
- Client: per-question play button on the interview page; auto-play optional.
- Fallback: Cloud TTS WaveNet ($4/1M chars) if the preview TTS wobbles — same
  cache key space, one-line provider switch behind the gateway config.

### V-3 — Answer audio (the core voice step)
- Client records per-answer via **MediaRecorder** (webm/opus; Safari gets the
  typed-answer path — same UI, mic button hidden where unsupported, feature
  detect not UA sniff).
- `POST /api/interview/[id]/answer` with the audio blob → server sends
  **one multimodal Gemini call**: audio in → structured JSON out
  (transcript, evidence-linked evaluation, coaching readout, next question).
  Transcript + audio-delete are in the same transaction (§1.5).
- Cost logging per call lands in the gateway counter (V-0) — every session's
  marginal cost is visible in admin.

### V-4 — The full voice experience (UX batch)
- A voice-interview page: progress rail (the builder's segmented pattern,
  reused), current question card with play/ replay, record button with level
  meter and 3-minute cap per answer, coaching readout per answer, final
  breakdown (per-question evidence match + STAR guidance, the honest
  alternative to a "verdict").
- Copy names what it is: **practice partner**. The final screen says what we
  do *not* claim (no recruiter simulation) — same boundary voice as the ATS
  seal notices.
- Accessibility: every audio control keyboard-reachable, readouts are text
  first (voice is an add-on to text mode, never a replacement), reduced-motion
  contract applies to the record meter.
- e2e: typed-path full flow on mobile + desktop; audio path mocked at the API
  boundary (Playwright cannot grant fake mics reliably — the node suite pins
  the server contract instead).

### V-5 — Beta, measure, decide (owner in the loop)
- Beta cohort: 20–50 premium/student users. Instrument: session starts,
  completion rate, answers per session, mic-failure rate, **cost per session**
  (from the gateway counters), and one question — "would you pay for this as
  part of the pass?"
- Decision gate: completion ≥ 40% and cost/session ≤ ₹25 → GA as a premium
  feature inside the existing pass (no separate SKU). Below that → keep text
  mode as the product, voice as a labeled experiment.

### V-6 — GA + steady state
- Voice sessions priced in credits (e.g., 1 credit/session, aligned with the
  existing credit economy) so steady-state cost is user-funded, not
  credit-funded.
- The 25-November review (§1.3) decides the post-expiry posture: keep on
  pay-as-you-go from margin, or throttle to free-tier STT minutes (60/month)
  + cached TTS only.
- Realtime (Gemini Live) is revisited only if beta shows turn latency hurts
  completion — the cost table above says it shouldn't.

---

## 3. Credit budget (₹28,664 ≈ $340, expiry 3 Dec 2026)

| Allocation | Amount | Purpose |
|---|---|---|
| Build + load testing + beta | ~$150 | V-2 → V-5: TTS cache priming, beta sessions, failure-retry testing |
| Launch subsidy (Oct–Nov) | ~$100 | GA voice sessions until user credits carry the cost |
| Evidence Study reserve | ~$70 | GROWTH-PLAN Phase 3: calibration reviews, draft polish — text only, cheap |
| Contingency | ~$20 | Rate-limit accidents, re-transcriptions |
| **Post-expiry posture** | ₹0 by default | Pay-as-you-go disabled by quota caps + the admin switch; only a human decision re-arms it |

---

## 4. Why this plan is honest (and why that matters commercially)

StartHack records your screen "for integrity verification" and pronounces a
"hiring verdict." We: delete your audio the moment the transcript exists, coach
instead of judge, show every score's evidence links, and say on the page what
we cannot do. The voice feature is premium-tier bait with a trust spine — the
same structure as the ATS seal. The competitor validated demand; the boundary
is the differentiation.
