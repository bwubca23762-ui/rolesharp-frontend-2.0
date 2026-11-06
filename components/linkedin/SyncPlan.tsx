"use client";
import { useState } from "react";
import { Button, Card, GeneratedOutput, Notice } from "@/components/ui/primitives";
import { useWorkspaceDraft } from "@/lib/workspace-context";
import { linkedinSyncPlan, type LinkedinSyncPlan } from "@/lib/linkedin-sync";

// LinkedIn sync (Phase 4): diff the pasted profile against the resume in
// the shared workspace draft. Runs entirely in the browser — the profile
// text is already in the checker, the resume is already in the workspace,
// and neither is uploaded anywhere new.

export default function LinkedinSync({ profileText }: { profileText: string }) {
  const { draft, loaded } = useWorkspaceDraft();
  const [plan, setPlan] = useState<LinkedinSyncPlan | null>(null);

  const resumeText = draft?.resumeText?.trim() ?? "";
  const canSync = profileText.trim().length > 40 && resumeText.length > 40;

  return (
    <Card className="mt-6 p-5">
      <p className="m-0 text-[0.7rem] font-bold! uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Sync with your resume · runs in your browser
      </p>
      <p className="mt-2 mb-0 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        Recruiter search runs on your LinkedIn text; your resume holds the evidence. This diff shows which evidenced
        terms your profile never mentions, which profile claims your resume does not back, and which sections LinkedIn
        needs. Load a resume into any tool first (checker, fixer, or builder) and it appears here.
      </p>
      {!loaded ? null : !canSync ? (
        <Notice variant="info" className="mt-3">
          {profileText.trim().length <= 40
            ? "Paste your LinkedIn profile above first."
            : "No resume in your workspace yet — open the ATS checker or builder and add one, then come back."}
        </Notice>
      ) : (
        <div className="mt-3">
          {!plan && (
            <Button onClick={() => setPlan(linkedinSyncPlan(profileText, resumeText))}>
              Compare profile with my resume
            </Button>
          )}
          {plan && (
            <div className="mt-2 space-y-3" role="status">
              <div>
                <p className="m-0 text-sm font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Headline</p>
                <p className="mt-1 mb-0 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                  {plan.headline.flagged ? "⚠ " : ""}{plan.headline.note}
                </p>
              </div>
              {plan.sectionGaps.length > 0 && (
                <div>
                  <p className="m-0 text-sm font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Sections LinkedIn needs</p>
                  <ul className="mt-1 mb-0 list-disc pl-5 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                    {plan.sectionGaps.map((gap) => <li key={gap}>{gap}</li>)}
                  </ul>
                </div>
              )}
              {plan.missingOnLinkedIn.length > 0 && (
                <GeneratedOutput
                  label="Evidenced terms your profile never mentions — add these to LinkedIn"
                  text={plan.missingOnLinkedIn.join(", ")}
                />
              )}
              {plan.missingOnResume.length > 0 && (
                <GeneratedOutput
                  label="Profile claims your resume does not back — evidence them or be ready to bridge"
                  text={plan.missingOnResume.join(", ")}
                />
              )}
              {plan.missingOnLinkedIn.length === 0 && plan.missingOnResume.length === 0 && plan.sectionGaps.length === 0 && !plan.headline.flagged && (
                <Notice variant="info">Profile and resume are aligned on vocabulary and sections. Keep them in step as you tailor.</Notice>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
