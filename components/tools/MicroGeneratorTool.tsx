"use client";

import { useEffect, useState } from "react";
import { FileText } from "@/app/icons";
import { Button, Card, Label, Input, Select, Textarea, Notice, AtsSealNotice } from "@/components/ui/primitives";
import type { AtsSeal } from "@/lib/ats-extract";
import { useSession } from "@/app/session-context";
import { useWorkspaceDraft } from "@/lib/workspace-context";

export type MicroTool = "summary" | "bullets" | "experience" | "career" | "resignation" | "thankyou" | "negotiation" | "onboarding" | "reference";

type BulletReview = { original: string; improved: string; notes: string[] };
type Ranked = { bullet: string; matched: string[] };
type GenVariant = { id: string; label: string; badge: string; text: string; wordCount: number; charCount: number };

const REQUEST_TIMEOUT_MS = 20_000;
const hint = "text-xs leading-5 text-[var(--muted-fg)]";
const fieldGap = "mt-3.5";

const SAMPLE_PREVIEW: Record<MicroTool, string> = {
  summary:
    "Senior Software Engineer with 7+ years of experience building high-throughput payment and ledger services in TypeScript, PostgreSQL, and Kafka. Cut failed subscription renewals by 18% and reduced p95 checkout latency from 420ms to 150ms across 1.8M monthly transactions.",
  bullets:
    "• Re-architected subscription billing retry pipeline in TypeScript and PostgreSQL, reducing involuntary churn by 18% across 140K active accounts.\n• Streamlined multi-currency checkout flow and idempotency keys, cutting p95 API latency by 64% (420ms → 150ms).",
  experience:
    "• Built and maintained PostgreSQL + Kafka payment settlement pipelines handling $42M in monthly volume with 99.98% uptime.\n• Reduced month-end reconciliation breaks by 41% by automating ledger discrepancy alerts.",
  career:
    "Operations-turned-Data Analyst combining 6 years of front-line supply-chain execution with SQL, Python, and Power BI reporting. Built automated inventory exception dashboards used daily by 4 regional warehouses.",
  resignation:
    "Dear Priya,\n\nPlease accept this letter as formal notice that I am resigning from my position as Senior Data Analyst at Fictional Payments. My last working day will be November 15, 2026, following my two-week notice period.\n\nThank you for the support and opportunities over the past three years. Over the next two weeks, I will document my active SQL pipelines and hand over the monthly close dashboards cleanly.\n\nSincerely,\nAlex Morgan",
  thankyou:
    "Subject: Thank you — Data Analyst interview\n\nHi Priya,\n\nThank you for taking the time to speak with me today about the Data Analyst role at Fictional Payments. I especially enjoyed our discussion on how your team handles reconciliation breaks during month-end close, and it reinforced how directly my SQL and automated exception-tracking work applies.\n\nI look forward to the take-home review next week.\n\nBest regards,\nAlex",
  negotiation:
    "Hi Taylor,\n\nThank you for sharing the offer for the Data Analyst role at Fictional Payments. I'm excited about the team and the month-end close automation roadmap we discussed.\n\nBased on the scope of the role and my track record cutting monthly close time from 6 hours to 2 across 320+ invoices, I would love to find a way to get closer to USD 96,000 base (up from USD 88,000). If we can bridge that gap to USD 96,000, I am ready to sign immediately.\n\nBest regards,\nAlex",
  onboarding:
    "30-60-90 day plan — Senior Data Analyst at Fictional Payments\n\nDAY 1–30 · Learn the landscape\n- Meet Priya in week 1: ask what a great first 90 days looks like for them, and which stakeholder to know first.\n- Map the stakeholders: one conversation each with the people your work touches. Ask what they wish worked better.\n- Learn the landscape: the monthly close pipeline and its dashboards. Read before you propose.\n- Ship one small, safe win end-to-end — a fix, a doc, a cleanup — to learn how work actually moves here.\n- Keep a day-one journal: every surprise, acronym, and question. It becomes your onboarding doc for the next person.\nCheck-in (day 30): \"Here is what I have learned, here is where I can add the most first. Does that match what you need?\"\n\nDAY 31–60 · Own a lane\n- Take full ownership of one area connected to your first goal: automate the reconciliation exceptions.\n- Establish the baseline: measure how the thing you own performs today, so day-90 claims have a before.\n- Set a weekly feedback loop with your manager — 15 minutes, same slot, no agenda theatre.\n- Build one relationship outside your team (a peer team, a customer, a support lane).\n- Draft the plan for your second goal: [the second outcome you were hired for].\nCheck-in (day 60): \"Here is the baseline, here is the plan, here is where I need a decision from you.\"\n\nDAY 61–90 · Deliver and extend\n- Land a measurable improvement on automate the reconciliation exceptions and document the before/after.\n- Present a short written review: what you learned in 90 days, what you would do next, where you see waste or risk.\n- Propose your next 90 days in one page — priorities, not tasks.\n- Make one process permanently better (a checklist, a template, an automation) so your onboarding is not the last thing you improved.\nCheck-in (day 90): \"Here is the result against the baseline, here is what I propose next. Where do you agree and where would you push back?\"\n\nThis scaffold is yours to mark up — the specifics that matter (systems, metrics, stakeholders) are the ones you and your manager name in week 1.",
  reference:
    "Prep for our reference call — Data Analyst at Fictional Payments\n\nHi Jordan,\n\nThank you for agreeing to be my reference. A quick prep so nothing catches you off guard — everything below is just a reminder of work you saw first-hand.\n\nTHE ROLE I AM INTERVIEWING FOR\nData Analyst at Fictional Payments. The interviewer may ask how we worked together and what my work was actually like.\n\nTALKING POINTS THAT WOULD HELP (all your call — say only what you feel is true)\n1. The reconciliation tracker I built that the team still uses — a one-line example you remember beats a general endorsement.\n2. How I handled the quarter the invoice volume doubled — a one-line example you remember beats a general endorsement.\n\nREMAINDERS OF THE WORK WE DID\n- The month-end close automation we shipped in Q2\n- The weekly reporting pack I handed over when I rotated off\n\nLOGISTICS\n- The company usually emails you directly to schedule a 15–20 minute call. If you have not heard anything within a week of my interview, tell me and I will nudge them.\n- Skip anything you are unsure about — 'I did not work with them on that' is a perfectly good answer.\n\nThank you again. Happy to return the favor for you any time.\n\n— Sent as prep before the call. Use whatever feels true; drop the rest.",
};

export default function MicroGeneratorTool({ tool, cta }: { tool: MicroTool; cta: string }) {
  const { draft } = useWorkspaceDraft();
  const [role, setRole] = useState("");
  const [years, setYears] = useState("");
  const [skills, setSkills] = useState("");
  const [evidence, setEvidence] = useState("");
  const [text, setText] = useState("");
  const [roles, setRoles] = useState("");
  const [posting, setPosting] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [manager, setManager] = useState("");
  const [noticeDate, setNoticeDate] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [lastDay, setLastDay] = useState("");
  const [tone, setTone] = useState("neutral");
  const [reason, setReason] = useState("");
  const [handover, setHandover] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [variants, setVariants] = useState<GenVariant[]>([]);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const [reviews, setReviews] = useState<BulletReview[] | null>(null);
  const [ranked, setRanked] = useState<Ranked[] | null>(null);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [seal, setSeal] = useState<AtsSeal | null>(null);
  const { session } = useSession();

  const premiumExportable = true;
  const exportTitle =
    tool === "thankyou"
      ? "Thank You Note"
      : tool === "negotiation"
        ? "Negotiation Email"
        : tool === "resignation"
          ? "Resignation Letter"
          : tool === "career"
            ? "Career Summary"
            : tool === "onboarding"
              ? "30-60-90 Day Plan"
              : tool === "reference"
                ? "Reference Prep"
                : tool === "bullets"
                  ? "Resume Bullet Points"
                  : tool === "experience"
                    ? "Work Experience"
                    : "Professional Summary";

  const [premiumKnown, setPremiumKnown] = useState(false);
  useEffect(() => {
    setPremiumKnown(Boolean(session?.premium));
  }, [session?.premium]);

  const docxExportable = premiumExportable && (session?.features?.docxExport ?? false);

  function fillSample() {
    setError("");
    if (tool === "summary") {
      setRole("Senior Software Engineer");
      setYears("7 years");
      setSkills("TypeScript, PostgreSQL, Kafka, Node.js, AWS");
      setEvidence("Cut failed subscription renewals by 18% across 140K accounts\nReduced p95 checkout API latency from 420ms to 150ms");
    } else if (tool === "bullets") {
      setText(
        "Responsible for the subscription billing retry service in TypeScript\nWorked on improving checkout API latency and database queries\nHelped onboard 4 junior engineers and reviewed pull requests",
      );
    } else if (tool === "experience") {
      setText(
        "Built PostgreSQL and Kafka settlement pipelines processing $42M/mo with 99.98% uptime\nAutomated month-end ledger reconciliation alerts, cutting manual breaks by 41%\nLed migration from monolith to Node.js services across 3 product squads",
      );
      setPosting(
        "We are hiring a Senior Backend Engineer with strong PostgreSQL, Kafka, Node.js, distributed systems reliability, and payment settlement experience.",
      );
    } else if (tool === "career") {
      setRoles("Senior Data Analyst | Fictional Payments | 2023 - Present\nOperations Analyst | Example Logistics | 2020 - 2023");
      setSkills("SQL, Python, Power BI, Tableau, Stakeholder Management, Forecasting");
    } else if (tool === "resignation") {
      setName("Alex Morgan");
      setRole("Senior Data Analyst");
      setCompany("Fictional Payments");
      setManager("Priya Raman");
      setNoticeDate(new Date().toISOString().slice(0, 10));
      setNoticePeriod("2 weeks");
      setTone("grateful");
      setEvidence("Your mentorship during the billing data migration\nThe collaborative analytics team culture");
      setHandover("Document all active SQL pipelines and transition the monthly close dashboard");
    } else if (tool === "thankyou") {
      setManager("Priya Sharma");
      setRole("Senior Data Analyst");
      setCompany("Fictional Payments");
      setHandover("the technical SQL take-home review next Tuesday");
      setReason("How the analytics team automates month-end reconciliation checks across multi-currency ledgers");
    } else if (tool === "negotiation") {
      setRole("Senior Data Analyst");
      setCompany("Fictional Payments");
      setManager("Taylor Brooks");
      setTone("USD");
      setNoticePeriod("88000");
      setLastDay("96000");
      setEvidence("Cut monthly close from 6 hours to 2 across 320+ invoices\nBuilt automated SQL reconciliation tracker used daily by 18 analysts");
    } else if (tool === "onboarding") {
      setRole("Senior Data Analyst");
      setCompany("Fictional Payments");
      setManager("Priya Raman");
      setReason("Automate the reconciliation exceptions\nGive leadership a trusted weekly numbers pack");
      setEvidence("The monthly close pipeline and its dashboards\nThe support escalation lane for data requests");
    } else if (tool === "reference") {
      setName("Jordan Lee");
      setManager("Analytics Manager at Example Logistics");
      setTone("worked together for two years");
      setRole("Senior Data Analyst");
      setCompany("Fictional Payments");
      setReason("The reconciliation tracker I built that the team still uses\nHow I handled the quarter the invoice volume doubled");
      setEvidence("The month-end close automation we shipped in Q2\nThe weekly reporting pack I handed over when I rotated off");
    }
  }

  function fillFromWorkspace() {
    if (!draft) return;
    if (draft.targetRole) setRole(draft.targetRole);
    if (draft.targetCompany) setCompany(draft.targetCompany);
    if (draft.jdText) setPosting(draft.jdText);
    if (draft.resumeText) {
      const lines = draft.resumeText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 20)
        .slice(0, 6)
        .join("\n");
      if (tool === "bullets" || tool === "experience") setText(lines);
      else if (tool === "summary" || tool === "negotiation") setEvidence(lines);
    }
  }

  function clearAll() {
    setRole("");
    setYears("");
    setSkills("");
    setEvidence("");
    setText("");
    setRoles("");
    setPosting("");
    setName("");
    setCompany("");
    setManager("");
    setNoticeDate("");
    setNoticePeriod("");
    setLastDay("");
    setReason("");
    setHandover("");
    setOutput("");
    setVariants([]);
    setActiveVariant(null);
    setReviews(null);
    setRanked(null);
    setUnsupported([]);
    setWarnings([]);
    setError("");
  }

  async function download(kind: "pdf" | "docx") {
    setExportError("");
    setSeal(null);
    if (!output || exporting) return;
    setExporting(kind);
    try {
      const response = await fetch(`/api/tools/export-${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: exportTitle,
          text: displayOutput,
        }),
      });
      if (response.status === 402) {
        setExportError(
          kind === "pdf"
            ? "PDF export is a Premium feature. Upgrade to download watermark-free."
            : "DOCX export is part of Platform Premium. Upgrade to download editable Word files.",
        );
        return;
      }
      if (!response.ok) throw new Error();
      const sealValue = response.headers.get("X-Ats-Seal");
      if (sealValue) {
        try {
          setSeal(JSON.parse(decodeURIComponent(sealValue)) as AtsSeal);
        } catch {}
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${tool}-output.${kind}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Could not export right now. Try again in a moment.");
    } finally {
      setExporting(null);
    }
  }

  function body() {
    if (tool === "bullets") return { tool, text };
    if (tool === "summary") return { tool, role, years, skills, evidence };
    if (tool === "career") return { tool, roles, skills };
    if (tool === "resignation") {
      return { tool, name, role, company, manager, noticeDate, noticePeriod, lastDay, tone, reason, thanks: evidence, handover };
    }
    if (tool === "thankyou") return { tool, interviewer: manager, role, company, topic: reason, nextStep: handover };
    if (tool === "negotiation") {
      return {
        tool,
        role,
        company,
        offerBase: Number(noticePeriod.replace(/\D/g, "")) || 0,
        targetBase: Number(lastDay.replace(/\D/g, "")) || null,
        currency: tone,
        recruiter: manager,
        evidence,
      };
    }
    if (tool === "onboarding") return { tool, role, company, manager, goals: reason, context: evidence };
    if (tool === "reference") {
      return { tool, referenceName: name, referenceRole: manager, relationship: tone, role, company, points: reason, reminders: evidence };
    }
    return { tool, bullets: text, posting };
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    setOutput("");
    setReviews(null);
    setRanked(null);
    setUnsupported([]);
    setWarnings([]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/tools/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body()),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result?.error || `Could not generate (HTTP ${response.status}).`);
        return;
      }
      if (result.tool === "bullets") setReviews(result.reviews ?? []);
      else if (result.tool === "experience") {
        setRanked(result.ranked ?? []);
        setUnsupported(result.unsupported ?? []);
      } else if (result.tool === "resignation" || result.tool === "negotiation" || result.tool === "onboarding" || result.tool === "reference") {
        setOutput(result.output ?? result.letter ?? "");
        setWarnings(result.warnings ?? []);
      } else {
        setOutput(result.output ?? "");
      }
      setVariants(result.variants ?? []);
      setActiveVariant(null);
    } catch {
      setError(controller.signal.aborted ? "That took too long. Try again." : "Network error — nothing was generated.");
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  function sendToMaker(textToUse: string, bullets?: string[]) {
    try {
      sessionStorage.setItem(
        "rolesharp-maker-import",
        JSON.stringify({
          tool,
          text: textToUse,
          bullets: bullets ?? (reviews ?? []).map((r) => r.improved),
        }),
      );
    } catch {}
    window.location.href = "/resume-maker";
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Select the text and copy manually.");
    }
  }

  const disabled =
    busy ||
    (tool === "bullets" && text.trim().length < 3) ||
    (tool === "summary" && role.trim().length < 2) ||
    (tool === "career" && roles.trim().length < 3) ||
    (tool === "experience" && (text.trim().length < 3 || posting.trim().length < 3)) ||
    (tool === "resignation" && (name.trim().length < 2 || role.trim().length < 2 || company.trim().length < 2)) ||
    (tool === "thankyou" && (role.trim().length < 2 || reason.trim().length < 3)) ||
    (tool === "negotiation" && role.trim().length < 2) ||
    (tool === "onboarding" && role.trim().length < 2) ||
    (tool === "reference" && (name.trim().length < 1 || role.trim().length < 2));

  const activeVariantData = activeVariant ? variants.find((v) => v.id === activeVariant) ?? null : null;
  const displayOutput = activeVariantData?.text ?? output;
  const hasAnyResult = Boolean(output || (reviews && reviews.length > 0) || (ranked && ranked.length > 0));

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
      <Card as="section" aria-labelledby="mg-details" className="min-w-0">
        <header className="mb-5 border-b border-[var(--hairline)] pb-4">
          <h2 id="mg-details" className="text-xl font-semibold tracking-tight">Your details</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="outline" size="compact" onClick={fillSample}>
              Use sample details
            </Button>
            {draft?.resumeText && (
              <Button type="button" variant="outline" size="compact" onClick={fillFromWorkspace}>
                Use active resume
              </Button>
            )}
            <Button type="button" variant="ghost" size="compact" onClick={clearAll}>Clear</Button>
          </div>
        </header>

        {tool === "summary" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mg-role">Your role</Label>
                <Input id="mg-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior software engineer" />
              </div>
              <div>
                <Label htmlFor="mg-years">Years of experience</Label>
                <Input id="mg-years" value={years} onChange={(e) => setYears(e.target.value)} placeholder="7 years" />
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-skills">Skills</Label>
              <Textarea id="mg-skills" rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="TypeScript, PostgreSQL, Kafka" />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-evidence">Your strongest results, one per line</Label>
              <Textarea id="mg-evidence" rows={4} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Cut failed renewals by 18%" />
            </div>
          </>
        )}

        {tool === "career" && (
          <>
            <div>
              <Label htmlFor="mg-roles">Your roles, one per line as Title | Company | Dates</Label>
              <Textarea
                id="mg-roles"
                rows={4}
                value={roles}
                onChange={(e) => setRoles(e.target.value)}
                placeholder={"Senior Engineer | Fictional Payments | 2022 - Present\nEngineer | Example Systems | 2019 - 2021"}
              />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-career-skills">Core skills</Label>
              <Textarea id="mg-career-skills" rows={2} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Go, Kafka, PostgreSQL" />
            </div>
          </>
        )}

        {tool === "resignation" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mg-name">Your name</Label>
                <Input id="mg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Raman" />
              </div>
              <div>
                <Label htmlFor="mg-res-role">Your job title</Label>
                <Input id="mg-res-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Data Analyst" />
              </div>
              <div>
                <Label htmlFor="mg-company">Company</Label>
                <Input id="mg-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Fictional Payments" />
              </div>
              <div>
                <Label htmlFor="mg-manager">Addressed to</Label>
                <Input id="mg-manager" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Your manager's name" />
              </div>
              <div>
                <Label htmlFor="mg-notice-date">Date on letter</Label>
                <Input id="mg-notice-date" type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="mg-notice-period">Notice period</Label>
                <Input id="mg-notice-period" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value)} placeholder="2 weeks, 30 days" />
              </div>
              <div>
                <Label htmlFor="mg-last-day">Last working day</Label>
                <Input id="mg-last-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="mg-tone">Tone</Label>
                <Select id="mg-tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="neutral">Neutral and professional</option>
                  <option value="grateful">Warm and grateful</option>
                  <option value="brief">As short as it can be</option>
                </Select>
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-reason">Reason for leaving (optional)</Label>
              <Input id="mg-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-thanks">Anything you want to thank them for</Label>
              <Textarea id="mg-thanks" rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="One per line." />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-handover">Handover plan</Label>
              <Input id="mg-handover" value={handover} onChange={(e) => setHandover(e.target.value)} placeholder="Optional" />
            </div>
          </>
        )}

        {tool === "thankyou" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mg-interviewer">Interviewer&apos;s name</Label>
                <Input id="mg-interviewer" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Priya Sharma" />
              </div>
              <div>
                <Label htmlFor="mg-role-t">Role interviewed for</Label>
                <Input id="mg-role-t" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Data Analyst" />
              </div>
              <div>
                <Label htmlFor="mg-company-t">Company</Label>
                <Input id="mg-company-t" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Fictional Payments" />
              </div>
              <div>
                <Label htmlFor="mg-nextstep">Next step mentioned</Label>
                <Input id="mg-nextstep" value={handover} onChange={(e) => setHandover(e.target.value)} placeholder="the take-home review" />
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-topic-t">One specific thing you discussed</Label>
              <Textarea id="mg-topic-t" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="How your team handles reconciliation breaks at month-end" />
            </div>
          </>
        )}

        {tool === "onboarding" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mg-role-o">The new role</Label>
                <Input id="mg-role-o" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Data Analyst" />
              </div>
              <div>
                <Label htmlFor="mg-company-o">Company</Label>
                <Input id="mg-company-o" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Fictional Payments" />
              </div>
              <div>
                <Label htmlFor="mg-manager-o">Your manager (optional)</Label>
                <Input id="mg-manager-o" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Priya Raman" />
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-goals-o">What you were hired to achieve, one per line</Label>
              <Textarea id="mg-goals-o" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={"Automate the reconciliation exceptions\nGive leadership a trusted weekly numbers pack"} />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-context-o">Systems and context to learn first, one per line</Label>
              <Textarea id="mg-context-o" rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="The monthly close pipeline and its dashboards" />
            </div>
          </>
        )}

        {tool === "reference" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mg-name-r">Reference&apos;s name</Label>
                <Input id="mg-name-r" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
              </div>
              <div>
                <Label htmlFor="mg-rrole-r">Their role (optional)</Label>
                <Input id="mg-rrole-r" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Analytics Manager at Example Logistics" />
              </div>
              <div>
                <Label htmlFor="mg-rel-r">How you know each other</Label>
                <Input id="mg-rel-r" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="worked together for two years" />
              </div>
              <div>
                <Label htmlFor="mg-trole-r">Role you are interviewing for</Label>
                <Input id="mg-trole-r" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Senior Data Analyst" />
              </div>
              <div>
                <Label htmlFor="mg-company-r">Company (optional)</Label>
                <Input id="mg-company-r" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Fictional Payments" />
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-points-r">What you hope they cover, one per line</Label>
              <Textarea id="mg-points-r" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={"The reconciliation tracker I built that the team still uses\nHow I handled the quarter the invoice volume doubled"} />
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-reminders-r">Reminders of the work you did together, one per line</Label>
              <Textarea id="mg-reminders-r" rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="The month-end close automation we shipped in Q2" />
            </div>
          </>
        )}

        {tool === "negotiation" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="mg-role-n">Role</Label>
                <Input id="mg-role-n" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Data Analyst" />
              </div>
              <div>
                <Label htmlFor="mg-company-n">Company</Label>
                <Input id="mg-company-n" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Fictional Payments" />
              </div>
              <div>
                <Label htmlFor="mg-recruiter">Recruiter&apos;s name</Label>
                <Input id="mg-recruiter" value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <Label htmlFor="mg-currency">Currency</Label>
                <Input id="mg-currency" value={tone} onChange={(e) => setTone(e.target.value)} placeholder="USD / GBP / INR" maxLength={8} />
              </div>
              <div>
                <Label htmlFor="mg-offer">Offered base (annual)</Label>
                <Input id="mg-offer" inputMode="numeric" value={noticePeriod} onChange={(e) => setNoticePeriod(e.target.value.replace(/\D/g, ""))} placeholder="52000" />
              </div>
              <div>
                <Label htmlFor="mg-target">Your target base (annual)</Label>
                <Input id="mg-target" inputMode="numeric" value={lastDay} onChange={(e) => setLastDay(e.target.value.replace(/\D/g, ""))} placeholder="58000" />
              </div>
            </div>
            <div className={fieldGap}>
              <Label htmlFor="mg-evidence-n">Your real results, one per line</Label>
              <Textarea
                id="mg-evidence-n"
                rows={3}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder={"Cut monthly close from 6 hours to 2 across 320 invoices\nReconciliation tracker the team still uses daily"}
              />
            </div>
          </>
        )}

        {(tool === "bullets" || tool === "experience") && (
          <div>
            <Label htmlFor="mg-text">
              {tool === "bullets" ? "What you did, one line each" : "Your experience bullets, one per line"}
            </Label>
            <Textarea
              id="mg-text"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"Responsible for the billing migration\nWorked on improving the checkout flow"}
            />
          </div>
        )}

        {tool === "experience" && (
          <div className={fieldGap}>
            <Label htmlFor="mg-posting">Paste the job posting</Label>
            <Textarea id="mg-posting" rows={5} value={posting} onChange={(e) => setPosting(e.target.value)} placeholder="Paste the requirements section." />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--hairline)] pt-4">
          <Button onClick={run} disabled={disabled} isLoading={busy}>
            {busy ? "Working..." : cta}
          </Button>
          <span className={hint}>No account needed. The draft uses the details you provide.</span>
        </div>

        {error && <Notice variant="danger" role="alert" className="mt-4">{error}</Notice>}
      </Card>

      <Card as="section" aria-labelledby="mg-result" className="min-w-0 lg:sticky lg:top-24">
        <header className="mb-4 flex flex-wrap items-center gap-2 border-b border-[var(--hairline)] pb-4">
          <FileText size={19} aria-hidden="true" className="text-[var(--muted-fg)]" />
          <h2 id="mg-result" className="text-xl font-semibold tracking-tight">{hasAnyResult ? "Your draft" : "Example output"}</h2>
        </header>
        <p className="sr-only" role="status">{hasAnyResult ? "Your draft is ready." : ""}</p>
        {!hasAnyResult ? (
          <div>
            <p className="mb-3 text-sm leading-6 text-[var(--muted-fg)]">Use the example as a reference, then add your details to write your own draft.</p>
            <div className="rounded-lg border border-[#dcd3c3] bg-[#fbf7ef] px-4 py-5 text-[#202936] sm:px-6 sm:py-6">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{SAMPLE_PREVIEW[tool]}</pre>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button as="a" href="/build" variant="outline" size="sm">Open resume builder</Button>
              <Button as="a" href="/checker" variant="ghost" size="sm">Check a resume</Button>
            </div>
          </div>
        ) : (
          <>
            {output && (
              <div>
                <Label htmlFor="mg-output">{tool === "resignation" ? "Your letter" : "Result"}</Label>
                {variants.length > 0 && (
                  <div role="group" aria-label="Draft versions" className="mb-3 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      aria-pressed={activeVariant === null}
                      onClick={() => setActiveVariant(null)}
                      className={`min-h-10 rounded-lg border px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${
                        activeVariant === null
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-fg)] hover:text-[var(--fg)]"
                      }`}
                    >
                      Primary
                    </button>
                    {variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        aria-pressed={activeVariant === v.id}
                        onClick={() => setActiveVariant(v.id)}
                        title={v.badge}
                        className={`min-h-10 rounded-lg border px-3 text-sm font-semibold transition-colors motion-reduce:transition-none ${
                          activeVariant === v.id
                            ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                            : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted-fg)] hover:text-[var(--fg)]"
                        }`}
                      >
                        {v.label} · {v.wordCount}w
                      </button>
                    ))}
                  </div>
                )}
                <Textarea id="mg-output" rows={tool === "resignation" ? 12 : 6} readOnly value={displayOutput} />
                {activeVariantData && (
                  <p className="mt-1.5 text-xs text-[var(--muted-fg)]">
                    <span className="font-semibold">{activeVariantData.label}</span> — {activeVariantData.badge} · {activeVariantData.wordCount} words · {activeVariantData.charCount} chars
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => copy(displayOutput)}>
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  {premiumExportable && premiumKnown && (
                    <Button variant="outline" size="sm" onClick={() => download("pdf")} aria-disabled={exporting !== null} isLoading={exporting === "pdf"}>
                      PDF
                    </Button>
                  )}
                  {docxExportable && (
                    <Button variant="outline" size="sm" onClick={() => download("docx")} aria-disabled={exporting !== null} isLoading={exporting === "docx"}>
                      DOCX
                    </Button>
                  )}
                  {(tool === "summary" || tool === "career") && (
                    <Button variant="outline" size="sm" onClick={() => sendToMaker(displayOutput)}>
                      Add to manual resume
                    </Button>
                  )}
                </div>
                <AtsSealNotice seal={seal} className="mt-3" />
                {exportError && (
                  <Notice variant="info" className="mt-3">
                    {exportError}{" "}
                    <a href="/pricing" className="font-semibold underline underline-offset-2">
                      See Premium plans
                    </a>
                  </Notice>
                )}
              </div>
            )}

            {warnings.length > 0 && (
              <Notice variant="warning" title="Read these before you send it" className="mt-4">
                <ul className="list-disc pl-5 space-y-1">
                  {warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Notice>
            )}

            {reviews && (
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--fg)]">
                  {reviews.length} improved {reviews.length === 1 ? "bullet" : "bullets"}
                </p>
                <div className="space-y-2.5">
                  {reviews.map((review, index) => (
                    <Card key={index} variant="outline" padding="sm">
                      <p className="text-sm font-semibold text-[var(--fg)]">{review.improved}</p>
                      {review.notes.length > 0 && (
                        <ul className={`mt-1.5 list-disc pl-5 space-y-0.5 ${hint}`}>
                          {review.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => copy(reviews.map((r) => r.improved).join("\n"))}>
                    {copied ? "Copied" : "Copy all"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => sendToMaker(displayOutput)}>
                    Add bullets to a resume
                  </Button>
                  <Button as="a" href="/resume-fixer" variant="ghost" size="sm">
                    Open resume fixer
                  </Button>
                </div>
              </div>
            )}

            {ranked && (
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--fg)]">Ranked against the posting</p>
                <div className="space-y-2.5">
                  {ranked.map((entry, index) => (
                    <Card key={index} variant="outline" padding="sm">
                      <p className="text-sm text-[var(--fg)]">{entry.bullet}</p>
                      <p className={`mt-1 ${hint}`}>
                        {entry.matched.length ? `Matches: ${entry.matched.slice(0, 8).join(", ")}` : "No overlap with the posting yet."}
                      </p>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={() => copy(ranked.map((r) => r.bullet).join("\n"))}>
                    {copied ? "Copied" : "Copy ranked bullets"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => sendToMaker(ranked.map((r) => r.bullet).join("\n"), ranked.map((r) => r.bullet))}>
                    Send to manual builder
                  </Button>
                </div>
                {unsupported.length > 0 && (
                  <Notice variant="warning" title="Nothing you pasted supports these" className="mt-4">
                    <p>{unsupported.join(", ")}.</p>
                    <p className="mt-1">We will not write these for you. If you have done the work, add it in your own words.</p>
                  </Notice>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
