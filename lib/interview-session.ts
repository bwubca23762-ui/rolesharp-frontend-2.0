import { connection, redisDeadline } from "./queue";
import { stem, terms } from "./ats-score";
import type { ResumeContent } from "./types";
import { buildEvidenceInterview } from "./evidence-content";
import { buildStarGuidance, type StarEntry } from "./interview-star";

// Interactive interview practice (VOICE-INTERVIEW-PLAN V-1): a turn-based
// session over the evidence-grounded question set. V-1 is deliberately
// deterministic — readouts are computed from evidence overlap, no model call —
// which is what makes the FREE tier possible at zero marginal cost. Premium
// LLM-reviewed readouts arrive with voice (V-3) and ride the tier gateway
// rule below; nothing in this module may grow a model dependency before that
// plan lands, or the free tier stops being free.

export const FREE_SESSIONS_PER_MONTH = 1;
export const FREE_QUESTION_LIMIT = 5;
const SESSION_TTL_SECONDS = 7 * 24 * 3600;

export type InterviewTier = "free" | "premium";

// Owner rule (VOICE-INTERVIEW-PLAN §0b): free-tier AI traffic, when voice
// arrives, goes to the LAST provider in the gateway chain; premium goes to
// the first. Encoded here and pinned by test so V-2/V-3 inherit the rule.
export function voiceGatewayFor(tier: InterviewTier): "first" | "last" {
  return tier === "free" ? "last" : "first";
}

export type Readout = {
  score: number;
  evidenceMatched: string[];
  unsupported: string[];
  starCoverage: { situation: boolean; action: boolean; result: boolean };
  coaching: string[];
  /** Deterministic delivery signals (no model call — free-tier safe). */
  fillerCount: number;
  words: number;
  /** Only present when the client reports how long the spoken answer took. */
  wordsPerMinute?: number;
};

export type SessionState = {
  sessionId: string;
  resumeId: string;
  tier: InterviewTier;
  questionCount: number;
  createdAt: string;
  answers: Array<{ index: number; answer: string; at: string }>;
};

type LocalUse = { count: number; expiresAt: number };
type LocalEntry = { session: SessionState; expiresAt: number };
// Next bundles API routes separately. Module-local maps lost sessions between
// question creation and answer submission whenever Redis was unavailable.
// shortcut: fallback is process-local; shared Redis is required across replicas.
const fallbackHost = globalThis as typeof globalThis & { rolesharpInterviewFallbackV1?: {
  sessions: Map<string, LocalEntry>;
  monthlyUses: Map<string, LocalUse>;
  consumedSessions: Map<string, number>;
} };
const fallback = fallbackHost.rolesharpInterviewFallbackV1 ??= {
  sessions: new Map(), monthlyUses: new Map(), consumedSessions: new Map(),
};

function sessionKey(userId: string, sessionId: string): string {
  return `ivw:${userId}:${sessionId}`;
}

function monthWindow(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function sessionsUsedThisMonth(userId: string, tier: InterviewTier): Promise<number> {
  if (tier === "premium") return 0;
  const key = `ivw:sess:${userId}:${monthWindow()}`;
  try {
    const value = await redisDeadline(() => connection.get(key));
    if (value) return Math.max(Number(value) || 0, localMonthlyUses.get(key)?.count ?? 0);
  } catch {
    // Redis may be temporarily unavailable while this process still holds
    // usage consumed during the outage.
  }
  return localMonthlyUses.get(key)?.count ?? 0;
}

const localMonthlyUses = fallback.monthlyUses;
const localConsumedSessions = fallback.consumedSessions;
const USE_TTL_MS = 40 * 24 * 3600 * 1000;

function pruneLocalUses(now: number) {
  for (const [key, value] of localMonthlyUses) if (value.expiresAt <= now) localMonthlyUses.delete(key);
  for (const [key, expiresAt] of localConsumedSessions) if (expiresAt <= now) localConsumedSessions.delete(key);
}

export function consumeSessionLocally(markerKey: string, monthlyKey: string, now = Date.now()): ConsumeSessionResult {
  pruneLocalUses(now);
  if (localConsumedSessions.has(markerKey)) return "already_consumed";
  const used = localMonthlyUses.get(monthlyKey)?.count ?? 0;
  if (used >= FREE_SESSIONS_PER_MONTH) return "limit_reached";
  localConsumedSessions.set(markerKey, now + USE_TTL_MS);
  localMonthlyUses.set(monthlyKey, { count: used + 1, expiresAt: now + USE_TTL_MS });
  return "consumed";
}

// ── Deferred session burn ──
// The free monthly session is consumed on the FIRST ANSWER, not on question
// retrieval. Generating questions and reading them costs nothing; a user who
// opens a session, closes the tab, and comes back tomorrow loses nothing.
// consumeSessionOnce is idempotent per sessionId (SETNX marker), so answer
// retries and double-clicks never double-charge the same session.
export type ConsumeSessionResult = "consumed" | "already_consumed" | "limit_reached";

export async function consumeSessionOnce(userId: string, sessionId: string, tier: InterviewTier): Promise<ConsumeSessionResult> {
  if (tier === "premium") return "consumed";
  const markerKey = `ivw:consumed:${userId}:${sessionId}`;
  const monthlyKey = `ivw:sess:${userId}:${monthWindow()}`;
  pruneLocalUses(Date.now());
  if (localConsumedSessions.has(markerKey)) return "already_consumed";
  const localUsed = localMonthlyUses.get(monthlyKey)?.count ?? 0;
  try {
    const result = Number(await redisDeadline(() => connection.eval(
      `if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
       local used = math.max(tonumber(redis.call('GET', KEYS[2]) or '0'), tonumber(ARGV[4]))
       if used >= tonumber(ARGV[1]) then return -1 end
       redis.call('SET', KEYS[1], '1', 'EX', ARGV[2])
       redis.call('SET', KEYS[2], tostring(used + 1), 'EX', ARGV[3])
       return 1`,
      2, markerKey, monthlyKey, String(FREE_SESSIONS_PER_MONTH), String(40 * 24 * 3600), String(40 * 24 * 3600), String(localUsed),
    )));
    return result === 1 ? "consumed" : result === 0 ? "already_consumed" : "limit_reached";
  } catch {
    // Process-local fallback remains atomic within one JS isolate. It cannot
    // coordinate across instances while Redis is down, but never fails open
    // repeatedly on the same instance.
    return consumeSessionLocally(markerKey, monthlyKey);
  }
}

export function tierFor(hasPremium: boolean): InterviewTier {
  return hasPremium ? "premium" : "free";
}

export function questionCountFor(tier: InterviewTier, total: number): number {
  return tier === "free" ? Math.min(FREE_QUESTION_LIMIT, total) : total;
}

export async function createSession(
  userId: string,
  resumeId: string,
  tier: InterviewTier,
  questionCount: number,
): Promise<SessionState> {
  const session: SessionState = {
    sessionId: crypto.randomUUID(),
    resumeId,
    tier,
    questionCount,
    createdAt: new Date().toISOString(),
    answers: [],
  };
  try {
    await redisDeadline(() => connection.set(
      sessionKey(userId, session.sessionId), JSON.stringify(session), "EX", SESSION_TTL_SECONDS,
    ));
  } catch {
    // Redis down: the session still works through the local fallback store.
    rememberLocalSession(sessionKey(userId, session.sessionId), session);
  }
  return session;
}

const localSessions = fallback.sessions;
const MAX_LOCAL_SESSIONS = 5_000;

function rememberLocalSession(key: string, session: SessionState) {
  for (const [id, entry] of localSessions) if (entry.expiresAt <= Date.now()) localSessions.delete(id);
  if (!localSessions.has(key) && localSessions.size >= MAX_LOCAL_SESSIONS) {
    const oldest = localSessions.keys().next().value;
    if (oldest) localSessions.delete(oldest);
  }
  localSessions.set(key, { session, expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000 });
}

export async function getSession(userId: string, sessionId: string): Promise<SessionState | null> {
  const key = sessionKey(userId, sessionId);
  try {
    const raw = await redisDeadline(() => connection.get(key));
    if (raw) return JSON.parse(raw) as SessionState;
  } catch {
    // Continue to the local fallback below.
  }
  const entry = localSessions.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) { localSessions.delete(key); return null; }
  return entry.session;
}

export async function saveSession(userId: string, session: SessionState): Promise<void> {
  const key = sessionKey(userId, session.sessionId);
  try {
    await redisDeadline(() => connection.set(key, JSON.stringify(session), "EX", SESSION_TTL_SECONDS));
  } catch {
    rememberLocalSession(key, session);
  }
}

// ---- Readout engine (deterministic; no model call) ----

type Evidence = { starByQuestion: Map<string, StarEntry>; resumeTerms: Set<string>; contextTerms?: Set<string> };

export function evidenceFor(content: ResumeContent, questions: readonly string[]): Evidence {
  const { entries } = buildStarGuidance(content, questions);
  const resumeTerms = new Set<string>();
  const contextTerms = new Set<string>(terms(content.headline ?? ""));
  for (const experience of content.experiences) {
    for (const term of terms(`${experience.title} ${experience.company}`)) contextTerms.add(term);
    for (const bullet of experience.bullets) for (const term of terms(bullet)) resumeTerms.add(term);
  }
  for (const project of content.projects ?? []) {
    for (const term of terms(`${project.name} ${project.detail}`)) resumeTerms.add(term);
  }
  for (const skill of content.skills) for (const term of terms(skill)) resumeTerms.add(term);
  if (content.summary) for (const term of terms(content.summary)) resumeTerms.add(term);
  return { starByQuestion: new Map(entries.map((entry) => [entry.question, entry])), resumeTerms, contextTerms };
}

// Generic interview questions ("measurable result") share no literal terms
// with domain bullets ("reconciled invoices"), so per-question anchors are
// often unmapped — that is the STAR module's honest behavior, not a bug to
// route around. The readout therefore scores the answer against the resume's
// whole evidence vocabulary. Use the shared plural fold rather than prefix
// matching, which incorrectly treated "records" as evidence for "reconciled".
function isSupported(term: string, resumeTerms: Set<string>): boolean {
  if (resumeTerms.has(term)) return true;
  for (const candidate of resumeTerms) {
    if (stem(candidate) === stem(term)) return true;
  }
  return false;
}

export function readoutFor(
  question: string,
  answer: string,
  evidence: Evidence,
  durationSec?: number,
): Readout {
  const answerTerms = terms(answer);
  const anchor = evidence.starByQuestion.get(question);

  const matched: string[] = [];
  const unsupported: string[] = [];
  for (const term of answerTerms) {
    if (!isSupported(term, evidence.resumeTerms) && evidence.contextTerms && isSupported(term, evidence.contextTerms)) continue;
    if (matched.length < 8 && isSupported(term, evidence.resumeTerms) && !matched.includes(term)) matched.push(term);
    else if (unsupported.length < 8 && !isSupported(term, evidence.resumeTerms) && !unsupported.includes(term)) unsupported.push(term);
  }

  const wordCount = answerTerms.length;
  const spokenWords = answer.trim().split(/\s+/u).filter(Boolean).length;
  // Delivery signals, computed from the text alone — no model call, so the
  // free tier gets them too. Filler detection is phrase-level ("you know"
  // counts once, not twice). WPM needs the client-reported duration and only
  // exists for spoken answers; typed answers have no honest duration.
  const FILLERS = /\b(um+|uh+|erm|like|actually|basically|literally|you know|i mean|sort of|kind of)\b/gi;
  const fillerCount = (answer.match(FILLERS) ?? []).length;
  const wordsPerMinute = durationSec && durationSec >= 10 ? Math.round((spokenWords / durationSec) * 60) : undefined;

  // STAR coverage, honest-simple: the heuristics look for what a defensible
  // answer structurally contains — a context line, an own-verb action, and a
  // measured or stated outcome. They never grade the person, only the shape.
  const situation = wordCount >= 15 || /\b(at|during|while|when)\b/i.test(answer);
  const action = wordCount >= 12 && (/\bi\b|\bmy\b|\bwe\b|\bled\b|\bbuilt\b|\bdesigned\b|\bimproved\b/i.test(answer) || matched.length > 0);
  const result = /\d|%|₹|\$/.test(answer) || /\b(result|impact|outcome|learned|reduced|increased|saved)\b/i.test(answer);

  const score = Math.round(
    Math.min(100, matched.length * 9 + (situation ? 12 : 0) + (action ? 18 : 0) + (result ? 18 : 0) + (wordCount >= 25 ? 10 : 0)),
  );

  const coaching: string[] = [];
  if (!anchor && matched.length === 0) {
    coaching.push("Ground the answer in one specific example from your resume — name the project or role, not just the skill.");
  } else if (anchor) {
    if (matched.length === 0) coaching.push(`Your answer doesn't reference the evidence this question maps to ("${anchor.bullet}"). Weave the specific project in.`);
  }
  if (!situation) coaching.push("Set the context in one line — where, when, and with whom.");
  if (!action) coaching.push("Name what YOU did — the action verb, the decision you made, not just the team's outcome.");
  if (!result) coaching.push("Close with the result. A number you can defend, or an honest observation if none exists — never an invented one.");
  if (spokenWords < 25) coaching.push("Too short for an interview answer. Aim for 45–90 spoken words: context, action, result.");
  if (spokenWords > 220) coaching.push("Long. Lead with the action and the result, then add the context the question needs.");
  if (fillerCount >= 3) coaching.push(`"${fillerCount}" filler phrases detected (um, like, you know). Trim them — silence reads more confident than a filler.`);
  if (wordsPerMinute !== undefined) {
    if (wordsPerMinute > 175) coaching.push(`Speaking fast (${wordsPerMinute} WPM) — slow down; interviewers stop absorbing past ~170.`);
    else if (wordsPerMinute < 105) coaching.push(`Speaking slowly (${wordsPerMinute} WPM) — conversational pace is 130–150; keep the energy up.`);
  }

  return { score, evidenceMatched: matched, unsupported, starCoverage: { situation, action, result }, coaching, fillerCount, words: spokenWords, wordsPerMinute };
}

export function questionsFor(content: ResumeContent, tier: InterviewTier): { questions: string[]; star: StarEntry[] } {
  const interview = buildEvidenceInterview(content);
  const count = questionCountFor(tier, interview.items.length);
  const questions = interview.items.slice(0, count).map((item) => item.q);
  const { entries } = buildStarGuidance(content, questions);
  return { questions, star: entries };
}
