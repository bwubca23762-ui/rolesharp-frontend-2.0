// Orchestration: LLM prompt assembly, tier-aware ATS optimization, and the
// public tailor() entry point with timeout + local-fallback safety net.
// Provenance: extracted from lib/tailor.ts during Phase 6 monolith refactor.

import { chat, type LlmProvider } from "../llm";
import { localTailor } from "../local-tailor";
import { type GenerateRequest, type ResumeContent as RC } from "../types";
import { keywordCoverage } from "../ats-score";
import type { CompanyContext } from "../company-context";
import { checkResumeContent } from "../resume-checker";
import { FREE_ATS_TARGET, PREMIUM_ATS_TARGET } from "../ats-targets";
import { parseGeneratedContent } from "./normalization";
import { polishContent } from "./polish";
import { closeKeywordGaps } from "./close-gaps";
import {
  repairPlan,
  supportedMissingKeywords,
  targetKeywordBank,
} from "./keywords";
import type { RoleNorm } from "./types";

// Gemini sometimes wraps JSON in ```json fences despite response_format.
function stripFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

const SYSTEM = `You are an expert resume writer and ATS optimizer.
Rules:
- Use ONLY facts provided in the user's profile. Never invent employers, dates, degrees, or metrics.
- If an experience includes structured impactFacts, treat them as high-priority source facts for quantified bullet writing.
- Rewrite bullets to be metric-driven and aligned to the target role and job description.
- If company context is provided, use it to shape tone, summary emphasis, and keyword phrasing, but NEVER turn company context into fake candidate experience.
- For fresh graduates, prioritize education, projects, internships, certifications, achievements, and skills. Do not create fake jobs.
- Mirror important keywords from the job description naturally.
- Keep the resume ATS-safe: standard headings, no tables, no icons, no decorative wording.
- Return STRICT JSON matching the requested schema. No prose, no markdown.`;

function scoredResume(req: GenerateRequest, role: RoleNorm, companyName: string | undefined, content: RC): number {
  return checkResumeContent(content, {
    jdText: req.jdText,
    targetRole: role?.title ?? req.roleTitleRaw,
    targetCompany: companyName,
    // Same context the live builder meter now passes — otherwise the meter
    // would over-promise relative to the generated resume's final score.
    roleSkills: role?.required_skills?.length ? role.required_skills : undefined,
  }).score;
}

function impactFactsText(req: GenerateRequest): string {
  const lines = (req.profile.experiences ?? [])
    .map((exp) => {
      const facts = exp.impactFacts;
      if (!facts) return "";
      const parts = [facts.metric, facts.scope, facts.outcome, facts.timeframe].filter(Boolean);
      if (!parts.length) return "";
      return `${exp.title || "Experience"} at ${exp.company || "company"}: ${parts.join(" | ")}`;
    })
    .filter(Boolean);
  return lines.join("\n");
}

function companyContextText(companyContext?: CompanyContext): string {
  if (!companyContext) return "";
  const style = companyContext.styleProfile && typeof companyContext.styleProfile === "object"
    ? [
        Array.isArray(companyContext.styleProfile.tone) && companyContext.styleProfile.tone.length
          ? `tone=${companyContext.styleProfile.tone.join(", ")}`
          : "",
        Array.isArray(companyContext.styleProfile.values) && companyContext.styleProfile.values.length
          ? `values=${companyContext.styleProfile.values.join(", ")}`
          : "",
        Array.isArray(companyContext.styleProfile.summary_focus) && companyContext.styleProfile.summary_focus.length
          ? `summary_focus=${companyContext.styleProfile.summary_focus.join(", ")}`
          : "",
        Array.isArray(companyContext.styleProfile.bullet_style) && companyContext.styleProfile.bullet_style.length
          ? `bullet_style=${companyContext.styleProfile.bullet_style.join(", ")}`
          : "",
        Array.isArray(companyContext.styleProfile.preferred_emphasis) && companyContext.styleProfile.preferred_emphasis.length
          ? `preferred_emphasis=${companyContext.styleProfile.preferred_emphasis.join(", ")}`
          : "",
        companyContext.styleProfile.keyword_density
          ? `keyword_density=${companyContext.styleProfile.keyword_density}`
          : "",
      ].filter(Boolean).join(" | ")
    : "";
  return [
    companyContext.name ? `name=${companyContext.name}` : "",
    companyContext.sector ? `sector=${companyContext.sector}` : "",
    `guidance_source=${companyContext.guidanceSource}`,
    companyContext.atsSystem ? `ats_system=${companyContext.atsSystem}` : "",
    companyContext.sizeBand ? `size_band=${companyContext.sizeBand}` : "",
    style ? `style_profile=${style}` : "",
  ].filter(Boolean).join("\n");
}

async function aiTailor(
  req: GenerateRequest,
  role: RoleNorm,
  companyName?: string,
  model: "claude" | "gemini" = "gemini",
  premium = false,
  companyContext?: CompanyContext,
  signal?: AbortSignal,
): Promise<{ content: RC; atsScore: number; model: string }> {
  const providerTrace = new Map<LlmProvider, string>();
  const onProvider = (provider: LlmProvider, resolvedModel: string) => providerTrace.set(provider, resolvedModel);
  const prompt = [
    `TARGET COMPANY: ${companyName ?? "(generic)"}`,
    `TARGET ROLE: ${role?.title ?? req.roleSlug ?? "(from JD)"}`,
    companyContextText(companyContext)
      ? `COMPANY CONTEXT (catalog metadata plus explicitly labeled style inference; not an employer rule and never a source of candidate facts):\n${companyContextText(companyContext)}`
      : "",
    role ? `ROLE REQUIRED SKILLS: ${role.required_skills.join(", ")}` : "",
    role?.typical_bullets?.length ? `ROLE BULLET STYLE EXAMPLES (do not copy facts): ${role.typical_bullets.slice(0, 4).join(" | ")}` : "",
    req.jdText ? `JOB DESCRIPTION:\n${req.jdText.slice(0, 6000)}` : "",
    impactFactsText(req) ? `STRUCTURED IMPACT FACTS (use these exact facts when strengthening bullets):\n${impactFactsText(req)}` : "",
    `USER PROFILE (JSON, the only source of truth):\n${JSON.stringify(req.profile)}`,
    `Return JSON: {headline, contact, summary, skills[], experiences:[{title,company,period,bullets[]}], education:[{degree,school,year,detail}], projects:[{name,detail}], certifications[], languages[], achievements[]}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const text = await chat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: prompt },
    ],
    { json: true, temperature: 0.4, model, signal, onProvider },
  );

  const raw = JSON.parse(stripFence(text) || "{}");
  const content = polishContent(parseGeneratedContent(raw, req), req, role, companyName, premium);
  const aiCandidate = { content, atsScore: scoredResume(req, role, companyName, content) };
  // Never let a provider response regress below the deterministic factual
  // baseline. This also gives every tier a stable result during provider
  // quality variance or partial/malformed model output.
  const localBaseline = localTailor(req, role, companyName, premium, companyContext);
  let best = localBaseline.atsScore > aiCandidate.atsScore ? localBaseline : aiCandidate;

  // ---- Tier-aware ATS optimization ----
  // Free receives one focused repair pass towards 85. Premium receives up to
  // three toward 99. Every candidate version is re-scored and only a
  // non-regressing result is kept; the score itself is never floored/faked.
  // Target-role builds without a pasted JD are optimized too — against the
  // canonical role's skill bank — instead of skipping all passes and
  // plateauing at 70-74.
  const hasTargetContext = Boolean(req.jdText?.trim() || role?.required_skills?.length || req.roleSlug);
  if (hasTargetContext) {
    const targetBank = targetKeywordBank(req, role);
    const jdPresent = Boolean(req.jdText?.trim());
    const targetScore = premium ? PREMIUM_ATS_TARGET : FREE_ATS_TARGET;
    const maxPasses = premium ? 3 : 1;
    for (let pass = 0; pass < maxPasses; pass++) {
      const plan = repairPlan(req, role, best.content);
      if (best.atsScore >= targetScore || (!plan.missing.length && !plan.weakBullets.length)) break;
      const supportedMissing = supportedMissingKeywords(targetBank, req, best.content, role);
      try {
        const refinePrompt = [
          `You previously wrote this ATS resume (JSON) for a ${role?.title ?? req.roleSlug ?? "role"}${companyName ? ` at ${companyName}` : ""}:`,
          JSON.stringify(best.content),
          `Current ATS score estimate: ${best.atsScore}/100.`,
          companyContextText(companyContext)
            ? `Catalog/inferred company context for tone and keyword targeting only. It is not an employer rule; do not turn it into invented candidate facts:\n${companyContextText(companyContext)}`
            : "",
          `The target job description mentions these keywords that are still missing or under-represented:`,
          plan.missing.slice(0, 18).join(", "),
          plan.title.length
            ? `Priority title / headline terms supported by the profile: ${plan.title.join(", ")}`
            : "",
          plan.hardSkills.length
            ? `Supported hard-skill terms to surface more explicitly: ${plan.hardSkills.join(", ")}`
            : "",
          plan.softSkills.length
            ? `Supported collaboration / leadership terms to surface more explicitly: ${plan.softSkills.join(", ")}`
            : "",
          plan.domainTerms.length
            ? `Supported domain / environment terms to weave in where truthful: ${plan.domainTerms.join(", ")}`
            : "",
          plan.weakBullets.length
            ? `These bullets are still weak because they lack measurable detail or recruiter-searchable wording. Rewrite them with stronger wording, but only if the source facts support it: ${plan.weakBullets.join(" | ")}`
            : "",
          impactFactsText(req)
            ? `Use these structured impact facts when they apply to the matching experience, and prefer them over generic phrasing: ${impactFactsText(req)}`
            : "",
          supportedMissing.length
            ? `These missing keywords are SUPPORTED by the candidate's real profile or explicit skill list, so prioritize weaving them into the summary, skills, projects, education detail, or existing bullets where truthful: ${supportedMissing.join(", ")}`
            : `Prioritize keywords that are clearly supported by the candidate's existing profile facts.`,
          `Revise the resume toward an ATS score of ${targetScore}/100 by improving keyword match and bullet quality. Preserve facts, but be more explicit and recruiter-searchable. Prefer repairing the headline, summary, skills, projects, and existing bullets before adding new wording elsewhere. Keep bullets concise, action-led, and metric-aware when the source facts support it.`,
          `IMPORTANT: avoid duplicate synonym stuffing. Prefer one clean label instead of pairs like "AWS" plus "Amazon Web Services", or "CI/CD" plus "continuous integration", unless both are truly necessary.`,
          `STRICT RULES: do not invent employers, job titles, dates, degrees, certifications, tools, or fake metrics. Use only facts already present. Keep the SAME JSON schema and return JSON only.`,
        ].join("\n\n");
        const refined = await chat(
          [
            { role: "system", content: SYSTEM },
            { role: "user", content: refinePrompt },
          ],
          { json: true, temperature: 0.15, model, signal, onProvider },
        );
        const refinedContent = polishContent(parseGeneratedContent(JSON.parse(stripFence(refined) || "{}"), req), req, role, companyName, premium);
        // The optimization pass may improve phrasing in the summary, skills,
        // and bullets — all of which polishContent already evidence-guards
        // per-bullet (numbers + named entities must exist in the source
        // profile, otherwise the original bullet is restored). Credentials
        // are hard facts with no guard, so they stay locked to the first pass.
        refinedContent.education = best.content.education;
        refinedContent.projects = best.content.projects;
        refinedContent.certifications = best.content.certifications;
        refinedContent.languages = best.content.languages;
        refinedContent.achievements = best.content.achievements;
        const refinedScore = scoredResume(req, role, companyName, refinedContent);
        // Coverage acceptance only applies with a real JD — without one
        // keywordCoverage's empty-JD default would make both sides 0.65 and
        // the comparison meaningless.
        const improvedCoverage = jdPresent ? keywordCoverage(req.jdText!, JSON.stringify(refinedContent)) : 0;
        const currentCoverage = jdPresent ? keywordCoverage(req.jdText!, JSON.stringify(best.content)) : 0;
        // Accept on higher score, or on higher coverage ONLY if the total
        // score didn't regress (coverage alone must not buy a worse resume).
        if (refinedScore > best.atsScore || (improvedCoverage > currentCoverage && refinedScore >= best.atsScore)) {
          best = { content: refinedContent, atsScore: refinedScore };
        } else {
          break;
        }
      } catch {
        break;
      }
    }

    // Final deterministic pass — close remaining profile-supported keyword
    // gaps without another LLM round-trip. Premium gets a wider vocabulary
    // budget; free still gets enough coverage to reach its target when the
    // candidate supplied the necessary evidence.
    if (best.atsScore < targetScore) {
      const closed = closeKeywordGaps(req, role, best.content, premium ? 24 : 12);
      const closedScore = scoredResume(req, role, companyName, closed);
      if (closedScore > best.atsScore) best = { content: closed, atsScore: closedScore };
    }
  }

  return {
    ...best,
    model: [...providerTrace].map(([provider, resolved]) => `${provider}:${resolved}`).join(",") || `${model}:unknown`,
  };
}

export async function tailor(
  req: GenerateRequest,
  role: RoleNorm,
  companyName?: string,
  model: "claude" | "gemini" = "gemini",
  premium = false,
  companyContext?: CompanyContext,
): Promise<{ content: RC; atsScore: number; model: string }> {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 70_000);
  try {
    return await aiTailor(req, role, companyName, model, premium, companyContext, controller.signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[tailor-local-fallback] ${message.slice(0, 240)}`);
    return { ...localTailor(req, role, companyName, premium, companyContext), model: "local-fallback" };
  } finally {
    clearTimeout(deadline);
  }
}
