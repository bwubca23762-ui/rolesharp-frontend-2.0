import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import {
  buildCareerSummary,
  buildResumeSummary,
  splitInputLines,
  strengthenBullets,
  tailorExperienceToPosting,
} from "@/lib/micro-generators";
import { buildResignationLetter } from "@/lib/resignation-letter";
import { buildConversionPlan, buildHeadlines } from "@/lib/headline-converter";
import { buildThankYouNote, buildNegotiationEmail } from "@/lib/offer-communications";
import { buildOnboardingPlan } from "@/lib/onboarding-plan";
import { buildReferencePrep } from "@/lib/reference-prep";
import { buildGeneratorVariants, wovenKeywordsFrom } from "@/lib/generator-variants";
import { analyzeCoverLetter } from "@/lib/cover-letter-analyzer";
import { historyUserIdFromRequest, recordToolRun } from "@/lib/tool-runs-server";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";

export const runtime = "nodejs";

// The four free generators share one route because they share one contract:
// text in, restructured text out, nothing invented. No account, because the
// point is that a visitor produces something useful before deciding whether to
// sign up. 94% of signups never generated anything; this is where that starts.
const Body = z.discriminatedUnion("tool", [
  z.object({
    tool: z.literal("bullets"),
    text: z.string().min(3).max(8000),
  }),
  z.object({
    tool: z.literal("summary"),
    role: z.string().max(160),
    years: z.string().max(60).optional(),
    skills: z.string().max(2000).optional(),
    evidence: z.string().max(8000).optional(),
  }),
  z.object({
    tool: z.literal("career"),
    roles: z.string().min(3).max(4000),
    skills: z.string().max(2000).optional(),
  }),
  z.object({
    tool: z.literal("experience"),
    bullets: z.string().min(3).max(8000),
    posting: z.string().min(3).max(20000),
  }),
  z.object({
    tool: z.literal("resignation"),
    name: z.string().max(120),
    role: z.string().max(160),
    company: z.string().max(160),
    manager: z.string().max(120).optional(),
    noticeDate: z.string().max(10).optional(),
    noticePeriod: z.string().max(40).optional(),
    lastDay: z.string().max(10).optional(),
    tone: z.enum(["grateful", "neutral", "brief"]),
    reason: z.string().max(600).optional(),
    thanks: z.string().max(1200).optional(),
    handover: z.string().max(600).optional(),
  }),
  z.object({
    tool: z.literal("headlines"),
    role: z.string().min(2).max(100),
    skills: z.string().max(600).optional(),
    achievement: z.string().max(300).optional(),
  }),
  z.object({
    tool: z.literal("convert"),
    docText: z.string().min(50).max(30_000),
    direction: z.enum(["cv-to-resume", "resume-to-cv"]),
  }),
  z.object({
    tool: z.literal("letter-analyzer"),
    letterText: z.string().min(50).max(20_000),
  }),
  z.object({
    tool: z.literal("thankyou"),
    interviewer: z.string().max(120).optional(),
    role: z.string().max(100),
    company: z.string().max(120).optional(),
    topic: z.string().min(3).max(300),
    nextStep: z.string().max(200).optional(),
  }),
  z.object({
    tool: z.literal("negotiation"),
    role: z.string().min(2).max(100),
    company: z.string().max(120).optional(),
    offerBase: z.number().int().min(0).max(100_000_000),
    targetBase: z.number().int().min(0).max(100_000_000).nullable().optional(),
    currency: z.string().max(8).optional(),
    recruiter: z.string().max(120).optional(),
    evidence: z.string().max(600).optional(),
  }),
  z.object({
    tool: z.literal("onboarding"),
    role: z.string().min(2).max(100),
    company: z.string().max(120).optional(),
    manager: z.string().max(120).optional(),
    goals: z.string().max(1200).optional(),
    context: z.string().max(1200).optional(),
  }),
  z.object({
    tool: z.literal("reference"),
    referenceName: z.string().min(1).max(120),
    referenceRole: z.string().max(120).optional(),
    relationship: z.string().max(80).optional(),
    role: z.string().min(2).max(100),
    company: z.string().max(120).optional(),
    points: z.string().max(2000).optional(),
    reminders: z.string().max(2000).optional(),
  }),
]);

function splitSkills(value: string | undefined): string[] {
  return (value ?? "").split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "tools-generate", 30);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const body = parsed.data;

  // Premium history (Platform Premium toolHistory): the five grid generators
  // record a run after they succeed. Resolved lazily and only for the tools
  // that record — anonymous and free calls pay one cookie read at most.
  const historyUserId = await historyUserIdFromRequest();
  const recordRun = (tool: string, summary?: string | null) => {
    if (historyUserId) recordToolRun(historyUserId, tool, { summary });
  };

  if (body.tool === "bullets") {
    recordRun("bullets", null);
    return NextResponse.json({ tool: "bullets", reviews: strengthenBullets(body.text) });
  }

  if (body.tool === "summary") {
    const output = buildResumeSummary({
      role: body.role,
      years: body.years,
      skills: splitSkills(body.skills),
      evidence: splitInputLines(body.evidence ?? ""),
    });
    recordRun("summary", body.role);
    const skillList = splitSkills(body.skills);
    return NextResponse.json({
      tool: "summary",
      output,
      variants: buildGeneratorVariants(output, skillList),
      wovenKeywords: wovenKeywordsFrom(output, [body.role, body.skills ?? "", body.evidence ?? ""]),
    });
  }

  if (body.tool === "career") {
    // "Senior Engineer | Fictional Payments | 2022 - Present", one per line:
    // the same pipe shape the resume forms already use for education.
    const roles = splitInputLines(body.roles).map((line) => {
      const [title = "", company = "", period = ""] = line.split("|").map((part) => part.trim());
      return { title, company, period };
    });
    recordRun("career", body.roles.split("|")[0]?.trim() || null);
    const careerSkills = splitSkills(body.skills);
    const careerOutput = buildCareerSummary(roles, careerSkills);
    return NextResponse.json({
      tool: "career",
      output: careerOutput,
      variants: buildGeneratorVariants(careerOutput, careerSkills),
      wovenKeywords: wovenKeywordsFrom(careerOutput, careerSkills),
    });
  }

  if (body.tool === "resignation") {
    // The parsed body is already the generator's input shape; the discriminant
    // is simply ignored rather than destructured away.
    recordRun("resignation", body.role);
    return NextResponse.json({ tool: "resignation", ...buildResignationLetter(body) });
  }

  if (body.tool === "headlines") {
    const result = buildHeadlines({
      role: body.role,
      skills: body.skills ?? "",
      achievement: body.achievement,
    });
    return NextResponse.json({ tool: "headlines", ...result });
  }

  if (body.tool === "convert") {
    const plan = buildConversionPlan(body.docText, body.direction);
    return NextResponse.json({ tool: "convert", plan });
  }

  if (body.tool === "thankyou") {
    const note = buildThankYouNote({
      interviewer: body.interviewer ?? "",
      role: body.role,
      company: body.company ?? "",
      topic: body.topic,
      nextStep: body.nextStep,
    });
    recordRun("thankyou", body.role);
    return NextResponse.json({
      tool: "thankyou",
      output: note,
      variants: buildGeneratorVariants(note, [body.role]),
    });
  }

  if (body.tool === "negotiation") {
    const result = buildNegotiationEmail({
      role: body.role,
      company: body.company ?? "",
      offerBase: body.offerBase,
      targetBase: body.targetBase ?? 0,
      currency: body.currency ?? "",
      evidence: (body.evidence ?? "").split(/\r?\n/),
      recruiter: body.recruiter,
    });
    recordRun("negotiation", body.role);
    return NextResponse.json({
      tool: "negotiation",
      output: result.email,
      warnings: result.warnings,
      variants: buildGeneratorVariants(result.email, [body.role]),
    });
  }

  if (body.tool === "onboarding") {
    const result = buildOnboardingPlan({
      role: body.role,
      company: body.company ?? "",
      manager: body.manager,
      goals: body.goals,
      context: body.context,
    });
    recordRun("onboarding", body.role);
    return NextResponse.json({ tool: "onboarding", output: result.output, warnings: result.warnings });
  }

  if (body.tool === "reference") {
    const result = buildReferencePrep({
      referenceName: body.referenceName,
      referenceRole: body.referenceRole,
      relationship: body.relationship ?? "",
      targetRole: body.role,
      company: body.company,
      points: body.points,
      reminders: body.reminders,
    });
    recordRun("reference", body.role);
    return NextResponse.json({ tool: "reference", output: result.output, warnings: result.warnings });
  }

  if (body.tool === "letter-analyzer") {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
    if (!(await getEntitlement(user)).features.coverLetterAI) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });
    return NextResponse.json({ tool: "letter-analyzer", analysis: analyzeCoverLetter(body.letterText) });
  }

  const tailored = tailorExperienceToPosting(splitInputLines(body.bullets), body.posting);
  recordRun("experience", null);
  return NextResponse.json({ tool: "experience", ...tailored });
}
