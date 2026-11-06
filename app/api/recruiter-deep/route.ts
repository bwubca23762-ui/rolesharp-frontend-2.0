import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { checkResume } from "@/lib/resume-checker";

export const runtime = "nodejs";

// Premium: the recruiter deep-read. The free checker already shows a 6-second
// skim (recruiterFeedback); this is the full pass a hiring manager does before
// deciding on an interview — section by section, in reading order, with what
// to change tonight. Deterministic only: same engine as the free checker, no
// model call, nothing invented about the person.
const Body = z.object({
  resumeText: z.string().min(80).max(40_000),
  targetRole: z.string().trim().max(120).optional(),
  targetCompany: z.string().trim().max(120).optional(),
});

type Note = { kind: string; heading: string; point: string; quote?: string };

function bulletsOf(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^\s*[-*•·‣o]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter((l) => l.length >= 25 && l.length <= 400 && /\s/.test(l) && /^[A-Z(]/.test(l));
}

function sectionsOf(text: string): Array<{ name: string; lines: string[] }> {
  const KNOWN = /^(professional\s+)?(summary|profile|objective|skills?|technical skills|core skills|experience|work experience|employment|education|projects?|certifications?|achievements?|languages)\b:?$/i;
  const out: Array<{ name: string; lines: string[] }> = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.length <= 40 && KNOWN.test(line)) {
      current = { name: line.replace(/:$/, ""), lines: [] };
      out.push(current);
    } else if (current && line) {
      current.lines.push(line);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "recruiter-deep", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  if (!user.premium) return NextResponse.json({ error: "premium_required", upgrade: true }, { status: 402 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste your resume text first." }, { status: 400 });
  const { resumeText, targetRole, targetCompany } = parsed.data;

  // Reuse the exact scoring engine so the deep read can never contradict the
  // free score — same numbers, more words around them.
  const result = checkResume({
    resumeText,
    targetRole,
    targetCompany,
    companyType: "general",
  });
  const score = result.score;
  const bullets = bulletsOf(resumeText);
  const sections = sectionsOf(resumeText);
  const quantified = bullets.filter((b) => /\d|%|\$|x\b/i.test(b));

  const notes: Note[] = [];

  // Reading order = how a reviewer actually moves through the page.
  if (!result.detected.email || !result.detected.phone) {
    notes.push({
      kind: "concern",
      heading: "Header",
      point: !result.detected.email && !result.detected.phone
        ? "I have no way to reach you. Email and phone both missing — this goes back in the stack no matter how good the content is."
        : `Missing ${!result.detected.email ? "an email" : "a phone number"}. Recruiters contact through whichever is faster for them; give them both.`,
    });
  }

  const summarySection = sections.find((s) => /summary|profile|objective/i.test(s.name));
  if (!summarySection) {
    notes.push({
      kind: "concern",
      heading: "Opening",
      point: "No summary at the top. I read the first three lines to decide whether to keep going — right now those lines are contact details or a job title with no story.",
    });
  } else {
    const joined = summarySection.lines.join(" ");
    if (joined.length < 80) {
      notes.push({ kind: "question", heading: "Summary", point: "Your summary is very short. Say what you do, for whom, and the scale you've done it at — three clauses, one sentence.", quote: joined.slice(0, 160) });
    }
    if (/\b(passionate|hard.?working|detail.?oriented|team player|go.?getter)\b/i.test(joined)) {
      notes.push({ kind: "concern", heading: "Summary", point: "The summary spends words on adjectives every applicant claims. Replace one adjective clause with a fact only you can write.", quote: joined.match(/\b(passionate|hard.?working|detail.?oriented|team player|go.?getter)\b/i)?.[0] });
    }
  }

  const skillsSection = sections.find((s) => /skills/i.test(s.name));
  if (bullets.length >= 3) {
    const ratio = quantified.length / bullets.length;
    if (ratio >= 0.5) {
      notes.push({ kind: "strength", heading: "Experience", point: `${quantified.length} of ${bullets.length} bullets carry a number. This reads as someone who measures their work — I can defend this resume to a hiring manager as-is.` });
    } else {
      notes.push({
        kind: "concern",
        heading: "Experience",
        point: `Only ${quantified.length} of ${bullets.length} bullets say what changed or by how much. Pick the two most important bullets and add one number to each tonight — volume, time saved, revenue, error rate. That single edit moves the Impact score more than anything else on the page.`,
      });
    }
    const repeatedRole = bullets.filter((b) => /^responsible for/i.test(b)).length;
    if (repeatedRole >= 2) {
      notes.push({ kind: "concern", heading: "Experience", point: `${repeatedRole} bullets start with "responsible for". That phrase describes the job description, not your work in it — rewrite each as "[action verb] + [what] + [outcome]" instead.` });
    }
  }

  const hardGroup = result.keywordGroups.find((g) => g.label === "Hard skills");
  if (!skillsSection) {
    notes.push({ kind: "concern", heading: "Skills", point: "There is no Skills section. Keyword-searching recruiters filter on exact skill names — without the section, you don't appear in their search results at all." });
  } else if (hardGroup && hardGroup.coverage < 60) {
    notes.push({ kind: "question", heading: "Skills", point: `${Math.round(hardGroup.coverage)}% of the role's hard-skill terms appear in your resume${targetRole ? ` for ${targetRole}` : ""}. Check the missing list below — any of them you've genuinely used belong in the Skills section verbatim.` });
  }

  if (score >= 85) {
    notes.push({ kind: "strength", heading: "Overall", point: `At ${score}/100 this resume is in the top band I see. Spend your remaining time on the application itself — the referral or the cover letter now earns you more than another editing pass here.` });
  } else if (score >= 65) {
    notes.push({ kind: "question", heading: "Overall", point: `At ${score}/100 you're competitive but not safe. The fastest remaining wins are listed above — none of them need new experience, just clearer writing about what you've done.` });
  } else {
    notes.push({ kind: "concern", heading: "Overall", point: `At ${score}/100 this would likely be screened out before a human reads it carefully. Fix the header, structure, and keyword gaps flagged above first — they're mechanical, fast, and each adds real points.` });
  }

  return NextResponse.json({
    score,
    grade: result.grade,
    verdict: result.verdict,
    breakdown: result.breakdown,
    missingKeywords: result.missingKeywords.slice(0, 12),
    quickWins: result.quickWins.slice(0, 5),
    deepRead: {
      readingOrderNotes: notes,
      bulletStats: {
        total: bullets.length,
        quantified: quantified.length,
        ratio: bullets.length ? Math.round((quantified.length / bullets.length) * 100) : 0,
      },
      sectionsFound: sections.map((s) => s.name),
      targetEcho: targetCompany ? `Read against ${targetCompany}${targetRole ? ` · ${targetRole}` : ""}` : targetRole ? `Read against ${targetRole}` : "General read — add a target role for sharper keywords",
    },
  });
}
