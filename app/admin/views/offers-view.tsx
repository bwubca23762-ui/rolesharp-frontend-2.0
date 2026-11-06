"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge, Button, FieldError, Input, Label, Notice, Textarea } from "@/components/ui/primitives";
// Not @/lib/env: client component. lib/limits.ts carries the same defaults with
// no process access.
import { DEFAULT_STUDENT_MONTHLY_LIMIT } from "@/lib/limits";
import { rowActivation } from "../row-activation";
import { useAdminConfirm } from "../confirm-dialog";

type OfferVersion = {
  id: string;
  offer_key: string;
  title: string;
  version_number: number;
  status: "draft" | "scheduled" | "published" | "superseded";
  public_name: string;
  public_summary: string;
  call_to_action: string;
  terms_snapshot: {
    schemaVersion: 1;
    eligibility: { kind: "verified_academic_email"; lifetimeClaimsPerNormalizedEmail: 1; lifetimeClaimsPerAccount: 1 };
    grant: { kind: "premium_days"; days: number; premiumSource: "student" };
    benefits: { tailoredResumesPerMonth: number; features: string[] };
    verification: { tokenTtlHours: number };
  };
  content_digest: string;
  effective_at: string;
  enrollment_ends_at: string | null;
};

type Distribution = { version_number: number; claims: number; grants: number };
const defaultTerms = {
  schemaVersion: 1 as const,
  eligibility: { kind: "verified_academic_email" as const, lifetimeClaimsPerNormalizedEmail: 1 as const, lifetimeClaimsPerAccount: 1 as const },
  grant: { kind: "premium_days" as const, days: 180, premiumSource: "student" as const },
  benefits: { tailoredResumesPerMonth: DEFAULT_STUDENT_MONTHLY_LIMIT, features: ["premium_writing_model", "cover_letters", "interview_prep", "clean_pdf_export", "all_templates"] },
  verification: { tokenTtlHours: 24 },
};
function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const offersFormSchema = z.object({
  name: z.string().trim().min(1, "A public name is required.").max(120, "Keep the public name under 120 characters."),
  summary: z.string().trim().min(1, "A public summary is required.").max(300, "Keep the public summary under 300 characters."),
  cta: z.string().trim().min(1, "A call to action is required.").max(80, "Keep the call to action under 80 characters."),
  days: z.number({ error: "Grant days must be a number." }).int("Grant days must be a whole number.").min(1, "Grant at least 1 day.").max(3650, "Grant days cannot exceed 3650."),
  resumes: z.number({ error: "Resumes per month must be a number." }).int("Resumes per month must be a whole number.").min(1, "Allow at least 1 resume per month.").max(1000, "Resumes per month cannot exceed 1000."),
  ttl: z.number({ error: "Token TTL must be a number." }).int("Token TTL must be a whole number.").min(1, "Tokens must live at least 1 hour.").max(168, "Token TTL cannot exceed 168 hours."),
  features: z.string().refine((value) => value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).length > 0, "Add at least one feature key."),
  effectiveAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Pick a valid effective date and time."),
});

type OffersFormValues = z.infer<typeof offersFormSchema>;

const emptyOffersDraft = (): OffersFormValues => ({
  name: "Student Premium",
  summary: "6 months of RoleSharp Premium, free for verified students.",
  cta: "Activate 6 months free",
  days: 180,
  resumes: DEFAULT_STUDENT_MONTHLY_LIMIT,
  ttl: 24,
  features: defaultTerms.benefits.features.join("\n"),
  effectiveAt: localDateTime(),
});

export default function OffersView({ canEdit, canPublish }: { canEdit: boolean; canPublish: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [versions, setVersions] = useState<OfferVersion[]>([]);
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // Six admin views reported failure and stayed silent on success, so an
  // operator could not tell a save from a no-op — the confirmation clears
  // whenever a new action starts.
  const [saved, setSaved] = useState("");

  const form = useForm<OffersFormValues>({
    resolver: zodResolver(offersFormSchema),
    defaultValues: emptyOffersDraft(),
  });

  const selected = useMemo(() => versions.find((version) => version.id === selectedId) ?? null, [selectedId, versions]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/offers", { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => ({})) as { versions?: OfferVersion[]; distribution?: Distribution[]; error?: string };
      if (!response.ok) throw new Error(data.error || "offer_list_failed");
      setVersions(data.versions ?? []);
      setDistribution(data.distribution ?? []);
      setError(""); setSaved("");
    } catch { setError("Offer versions are temporarily unavailable."); }
  }, []);
  useAdminRefreshSignal(load);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    form.reset({
      name: selected.public_name,
      summary: selected.public_summary,
      cta: selected.call_to_action,
      days: selected.terms_snapshot.grant.days,
      resumes: selected.terms_snapshot.benefits.tailoredResumesPerMonth,
      ttl: selected.terms_snapshot.verification.tokenTtlHours,
      features: selected.terms_snapshot.benefits.features.join("\n"),
      effectiveAt: localDateTime(selected.effective_at),
    });
  }, [selected, form]);

  // Starting a new draft intentionally keeps the current field values — only
  // the selection and the effective time reset.
  function startDraft() {
    setSelectedId("");
    form.reset({ ...form.getValues(), effectiveAt: localDateTime() });
  }
  function mutate(action: "create" | "update_draft" | "schedule" | "publish_now" | "delete_draft", values?: OffersFormValues) {
    const expected = action === "schedule" ? "SCHEDULE OFFER" : action === "publish_now" ? "PUBLISH OFFER" : action === "delete_draft" ? "DELETE DRAFT" : undefined;
    if (expected) {
      const willSaveEdits = action !== "delete_draft" && form.formState.isDirty;
      ask({
        title: action === "schedule" ? "Schedule offer" : action === "publish_now" ? "Publish offer now" : "Delete draft",
        body: willSaveEdits
          ? "Unsaved form edits are saved to the draft first, then the action applies to the selected offer version. Recorded in the audit log."
          : "This applies to the selected offer version and is recorded in the audit log.",
        word: expected,
        run: async () => {
          // Schedule/publish previously acted on the SAVED row, silently
          // ignoring the operator's on-screen edits (edited effective times
          // caused stale publishes or offer_schedule_must_be_future).
          if (willSaveEdits) {
            const saved = await performMutate("update_draft", form.getValues());
            if (!saved) return;
          }
          await performMutate(action, undefined, expected);
        },
      });
      return;
    }
    void performMutate(action, values);
  }

  async function performMutate(action: "create" | "update_draft" | "schedule" | "publish_now" | "delete_draft", values?: OffersFormValues, confirmation?: string): Promise<boolean> {
    setBusy(action); setError(""); setSaved("");
    // create/update arrive validated from handleSubmit; operational actions
    // act on the saved version and never read unsaved form edits.
    const formValues = values ?? form.getValues();
    const terms = { ...defaultTerms, grant: { ...defaultTerms.grant, days: formValues.days }, benefits: { tailoredResumesPerMonth: formValues.resumes, features: formValues.features.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) }, verification: { tokenTtlHours: formValues.ttl } };
    const payload = action === "create"
      ? { action, offerKey: "student_premium", publicName: formValues.name, publicSummary: formValues.summary, callToAction: formValues.cta, terms, effectiveAt: new Date(formValues.effectiveAt).toISOString(), enrollmentEndsAt: null }
      : action === "update_draft"
        ? { action, versionId: selectedId, publicName: formValues.name, publicSummary: formValues.summary, callToAction: formValues.cta, terms, effectiveAt: new Date(formValues.effectiveAt).toISOString(), enrollmentEndsAt: null }
        : { action, versionId: selectedId, confirmation };
    try {
      const response = await fetch("/api/admin/offers", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({})) as { version?: OfferVersion | null; error?: string };
      if (!response.ok) throw new Error(data.error || "offer_change_failed");
      setSelectedId(data.version?.id ?? ""); await load(); setSaved("Change saved."); toast.success("Change saved."); if (action === "delete_draft") startDraft();
      return true;
    } catch (cause) { const message = cause instanceof Error ? cause.message.replaceAll("_", " ") : "Offer change failed."; setError(message); toast.error(message); return false; }
    finally { setBusy(""); }
  }

  const editable = !selected || selected.status === "draft";
  return <>
    <PageHeader title="Offers" desc="Draft, schedule, and publish exact offer terms. Verification tokens, claims, and grants retain their original version and structured snapshot." onRefresh={() => { void load(); }} />
    <div className="admin-table-card"><div className="admin-table-toolbar">{canEdit && <Button variant="outline" size="compact" onClick={startDraft}>New draft</Button>}</div>
      {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {saved && !error && <Notice variant="success" role="status">{saved}</Notice>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Version</th><th>Status</th><th>Effective</th><th>Claims</th><th>Grants</th><th>Digest</th></tr></thead><tbody>
        {versions.map((version) => { const stats = distribution.find((row) => row.version_number === version.version_number); return <tr key={version.id} {...rowActivation(() => setSelectedId(version.id))}><td><span className="cell-main">v{version.version_number}</span><span className="admin-data-row-detail">{version.public_name}</span></td><td><Badge variant={version.status === "published" ? "success" : version.status === "draft" ? "warning" : "info"}>{version.status}</Badge></td><td>{new Date(version.effective_at).toLocaleString()}</td><td>{stats?.claims ?? 0}</td><td>{stats?.grants ?? 0}</td><td><code>{version.content_digest.slice(0, 12)}…</code></td></tr>; })}
      </tbody></table></div>
    </div>
    <div className="admin-chart-card" style={{ marginTop: 20 }}><h2>{selected ? `${selected.title} v${selected.version_number}` : "New Student Premium draft"}</h2><p className="text-[var(--muted-fg)]">{selected && selected.status !== "draft" ? "This version is immutable." : "Drafts are editable until scheduling or publication."}</p>
      <Label htmlFor="offer-name">Public name</Label><Input id="offer-name" error={Boolean(form.formState.errors.name)} disabled={!canEdit || !editable} {...form.register("name")} />
      <FieldError>{form.formState.errors.name?.message}</FieldError>
      <Label htmlFor="offer-summary">Public summary</Label><Input id="offer-summary" error={Boolean(form.formState.errors.summary)} disabled={!canEdit || !editable} {...form.register("summary")} />
      <FieldError>{form.formState.errors.summary?.message}</FieldError>
      <Label htmlFor="offer-cta">Call to action</Label><Input id="offer-cta" error={Boolean(form.formState.errors.cta)} disabled={!canEdit || !editable} {...form.register("cta")} />
      <FieldError>{form.formState.errors.cta?.message}</FieldError>
      <div className="grid gap-4 sm:grid-cols-3"><div>
            <Label htmlFor="ov-grant-days">Grant days</Label>
            <Input id="ov-grant-days" type="number" min={1} max={3650} error={Boolean(form.formState.errors.days)} disabled={!canEdit || !editable} {...form.register("days", { valueAsNumber: true })} />
            <FieldError>{form.formState.errors.days?.message}</FieldError>
          </div><div>
            <Label htmlFor="ov-resumes-month">Resumes / month</Label>
            <Input id="ov-resumes-month" type="number" min={1} max={1000} error={Boolean(form.formState.errors.resumes)} disabled={!canEdit || !editable} {...form.register("resumes", { valueAsNumber: true })} />
            <FieldError>{form.formState.errors.resumes?.message}</FieldError>
          </div><div>
            <Label htmlFor="ov-token-ttl-hours">Token TTL hours</Label>
            <Input id="ov-token-ttl-hours" type="number" min={1} max={168} error={Boolean(form.formState.errors.ttl)} disabled={!canEdit || !editable} {...form.register("ttl", { valueAsNumber: true })} />
            <FieldError>{form.formState.errors.ttl?.message}</FieldError>
          </div></div>
      <Label htmlFor="offer-effective">Effective time</Label><Input id="offer-effective" type="datetime-local" error={Boolean(form.formState.errors.effectiveAt)} disabled={!canEdit || !editable} {...form.register("effectiveAt")} />
      <FieldError>{form.formState.errors.effectiveAt?.message}</FieldError>
      <Label htmlFor="offer-features">Feature keys, one per line</Label><Textarea id="offer-features" style={{ minHeight: 150, fontFamily: "var(--font-mono)" }} error={Boolean(form.formState.errors.features)} disabled={!canEdit || !editable} {...form.register("features")} />
      <FieldError>{form.formState.errors.features?.message}</FieldError>
      <div className="admin-row-actions" style={{ marginTop: 16 }}>{canEdit && editable && <Button isLoading={Boolean(busy)} onClick={() => void form.handleSubmit((values) => mutate(selected ? "update_draft" : "create", values))()}>Save draft</Button>}{canPublish && selected?.status === "draft" && <><Button variant="outline" isLoading={Boolean(busy)} onClick={() => void mutate("schedule")}>Schedule</Button><Button isLoading={Boolean(busy)} onClick={() => void mutate("publish_now")}>Publish now</Button></>}{canEdit && selected?.status === "draft" && <Button variant="danger" isLoading={Boolean(busy)} onClick={() => void mutate("delete_draft")}>Delete draft</Button>}</div>
    </div>
    {dialog}
  </>;
}
