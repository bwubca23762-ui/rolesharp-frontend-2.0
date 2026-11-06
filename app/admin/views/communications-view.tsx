"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge, Button, FieldError, Input, Label, Notice, Select, Textarea } from "@/components/ui/primitives";
import { rowActivation } from "../row-activation";
import { useAdminConfirm } from "../confirm-dialog";
import { adminFetchJson } from "../admin-helpers";
import CommunicationInspector from "../panels/communication-inspector";

type CommunicationClass = "essential" | "marketing";
type PreferenceCategory = "essential" | "product_updates" | "career_tips";
type Audience = "all_verified" | "free" | "premium" | "student";

type Version = {
  id: string;
  campaign_key: string;
  internal_name: string;
  version_number: number;
  status: string;
  communication_class: CommunicationClass;
  preference_category: PreferenceCategory;
  audience: Audience;
  subject: string;
  preheader: string | null;
  text_body: string;
  html_body: string;
  reply_to: string | null;
  content_digest: string;
  scheduled_at: string | null;
};

type Runtime = {
  transport_mode: string;
  globally_paused: boolean;
  max_batch_size: number;
  max_per_minute: number;
  max_per_day: number;
};

type MutateAction =
  | "create" | "update_draft" | "test_sink" | "schedule" | "activate_now"
  | "pause" | "resume" | "cancel" | "admit" | "delete_draft";

/** Type-to-confirm phrase guarding each action that touches live campaign state. */
const CONFIRM_PHRASE: Partial<Record<MutateAction, string>> = {
  test_sink: "TEST SINK",
  schedule: "SCHEDULE CAMPAIGN",
  activate_now: "ACTIVATE CAMPAIGN",
  pause: "PAUSE CAMPAIGN",
  resume: "RESUME CAMPAIGN",
  cancel: "CANCEL CAMPAIGN",
  admit: "ADMIT RECIPIENTS",
  delete_draft: "DELETE DRAFT",
};

const CONFIRM_TITLE: Partial<Record<MutateAction, string>> = {
  test_sink: "Send test sink",
  schedule: "Schedule campaign",
  activate_now: "Activate campaign now",
  pause: "Pause campaign",
  resume: "Resume campaign",
  cancel: "Cancel campaign",
  admit: "Admit recipients",
  delete_draft: "Delete draft",
};

const AUDIENCES: Audience[] = ["all_verified", "free", "premium", "student"];
/** Statuses where the campaign exists in the outbox and can still be steered. */
const LIVE_STATUSES = ["scheduled", "active", "paused"];

const communicationsFormSchema = z.object({
  campaignKey: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/, "Use 3–64 lowercase letters, numbers, or underscores, starting with a letter."),
  internalName: z.string().trim().min(1, "Name the campaign.").max(160),
  communicationClass: z.enum(["essential", "marketing"]),
  preferenceCategory: z.enum(["essential", "product_updates", "career_tips"]),
  audience: z.enum(["all_verified", "free", "premium", "student"]),
  subject: z.string().trim().min(1, "A subject line is required.").max(180, "Keep the subject under 180 characters."),
  preheader: z.string().max(200, "Keep the preheader under 200 characters."),
  textBody: z.string().max(20000).refine((value) => value.trim().length > 0, "The plain-text body is required."),
  htmlBody: z.string().max(50000).refine((value) => value.trim().length > 0, "The HTML body is required."),
  replyTo: z.string().trim().max(320).refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid reply-to email address."),
  scheduledAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Pick a valid schedule date and time."),
});

type CommunicationsFormValues = z.infer<typeof communicationsFormSchema>;

const emptyCommunicationsDraft = (): CommunicationsFormValues => ({
  campaignKey: "product_update_email",
  internalName: "Product update email",
  communicationClass: "marketing",
  preferenceCategory: "product_updates",
  audience: "all_verified",
  subject: "",
  preheader: "",
  textBody: "",
  htmlBody: "",
  replyTo: "",
  scheduledAt: localDateTime(),
});

/** `datetime-local` needs a local-clock string, not the UTC that toISOString gives. */
function localDateTime() {
  const date = new Date(Date.now() + 86400_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function CommunicationsView({ canEdit, canPublish }: { canEdit: boolean; canPublish: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [versions, setVersions] = useState<Version[]>([]);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [previewWidth, setPreviewWidth] = useState<"mobile" | "desktop">("desktop");
  const loadedVersion = useRef("");
  // Six admin views reported failure and stayed silent on success, so an
  // operator could not tell a save from a no-op — the form simply sat there
  // either way. The confirmation clears whenever a new action starts.
  const [saved, setSaved] = useState("");

  const form = useForm<CommunicationsFormValues>({
    resolver: zodResolver(communicationsFormSchema),
    defaultValues: emptyCommunicationsDraft(),
  });

  const selected = useMemo(
    () => versions.find((version) => version.id === selectedId) ?? null,
    [versions, selectedId],
  );

  const load = useCallback(async () => {
    try {
      const result = await adminFetchJson<{ versions: Version[]; runtime: Runtime | null }>("/api/admin/communications", { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error(result.error);
      const data = result.data;
      setVersions(data.versions ?? []);
      setRuntime(data.runtime ?? null);
      setError(""); setSaved("");
    } catch {
      setError("Communications are temporarily unavailable.");
    }
  }, []);

  useAdminRefreshSignal(load);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected || (form.formState.isDirty && loadedVersion.current === selected.id)) return;
    loadedVersion.current = selected.id;
    form.reset({
      campaignKey: selected.campaign_key,
      internalName: selected.internal_name,
      communicationClass: selected.communication_class,
      preferenceCategory: selected.preference_category,
      audience: selected.audience,
      subject: selected.subject,
      preheader: selected.preheader ?? "",
      textBody: selected.text_body,
      htmlBody: selected.html_body,
      replyTo: selected.reply_to ?? "",
      scheduledAt: form.getValues("scheduledAt"),
    });
  }, [selected, form]);

  function newDraft() {
    loadedVersion.current = "";
    setSelectedId("");
    form.reset(emptyCommunicationsDraft());
  }

  function mutate(action: MutateAction) {
    const expected = CONFIRM_PHRASE[action];
    if (!expected) { void performMutate(action); return; }
    ask({
      title: CONFIRM_TITLE[action] ?? expected,
      body: "This applies to the saved campaign version and is recorded in the audit log. Save any content edits before continuing.",
      word: expected,
      run: () => performMutate(action, expected),
    });
  }

  async function performMutate(action: MutateAction, confirmation?: string) {
    setBusy(action);
    setError(""); setSaved("");

    // create/update always arrive validated from handleSubmit; operational
    // actions act on the saved version and just read the current form state.
    const formValues = form.getValues();
    const fields = {
      internalName: formValues.internalName,
      communicationClass: formValues.communicationClass,
      preferenceCategory: formValues.preferenceCategory,
      audience: formValues.audience,
      subject: formValues.subject,
      preheader: formValues.preheader || null,
      textBody: formValues.textBody,
      htmlBody: formValues.htmlBody,
      replyTo: formValues.replyTo || null,
    };
    try {
      const payload =
        action === "create" ? { action, campaignKey: formValues.campaignKey, ...fields }
        : action === "update_draft" ? { action, versionId: selectedId, ...fields }
        : action === "test_sink" ? { action, versionId: selectedId, recipient: "preview@example.test", confirmation }
        : action === "schedule" ? { action, versionId: selectedId, scheduledAt: new Date(formValues.scheduledAt).toISOString(), confirmation }
        : { action, versionId: selectedId, confirmation };
      const result = await adminFetchJson<{ version?: Version; testSink?: { accepted: boolean; transport: string; deliveryVerified: boolean }; admitted?: number; estimate?: { eligible: number; admitted: number } }>("/api/admin/communications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.ok || !result.data) throw new Error(result.error || "communication_change_failed");
      const data = result.data;
      if (action === "create" || action === "update_draft") form.reset(formValues);
      if (data.version?.id) setSelectedId(data.version.id);
      await load();
      // Surface what the backend actually did, not a generic "Change saved.":
      // test sink reports transport/subject, admit reports the recipient count.
      if (action === "test_sink" && data.testSink) {
        const detail = `Test sink ${data.testSink.accepted ? "accepted" : "not accepted"} via ${data.testSink.transport}. No real mailbox delivery was attempted.`;
        setSaved(detail); toast.success(detail);
      } else if (action === "admit" && data.estimate) {
        const detail = `Admitted ${data.admitted ?? 0} recipient(s) (${data.estimate.eligible} eligible before admission).`;
        setSaved(detail); toast.success(detail);
      } else {
        setSaved("Change saved.");
        toast.success("Change saved.");
      }
      if (action === "delete_draft") newDraft();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.replaceAll("_", " ") : "Communication change failed.";
      setError(message); toast.error(message);
      if (confirmation) throw cause;
    } finally {
      setBusy("");
    }
  }

  const editable = !selected || selected.status === "draft";
  const locked = !editable || !canEdit;
  const status = selected?.status ?? "";
  const isLive = LIVE_STATUSES.includes(status);

  return (
    <>
      <PageHeader

        title="Communications"
        desc="Separate campaign versions, explicit marketing consent, global suppression, bounded recipient admission, and one provider boundary. Production sending remains disabled by runtime control."
        onRefresh={() => void load()}
      />

      <div className="admin-chart-card">
        <h2>Runtime safety</h2>
        <p className="text-[var(--muted-fg)]">
          Transport: <strong>{runtime?.transport_mode ?? "disabled"}</strong>
          {" · "}globally paused: <strong>{runtime?.globally_paused ? "yes" : "no"}</strong>
          {" · "}batch {runtime?.max_batch_size ?? 25}
          {" · "}minute cap {runtime?.max_per_minute ?? 30}
          {" · "}daily cap {runtime?.max_per_day ?? 1000}
        </p>
      </div>

      <CommunicationInspector canRecover={canPublish} versionId={selectedId} />

      <div className="admin-table-card" style={{ marginTop: 20 }}>
        <div className="admin-table-toolbar">
          {canEdit && <Button variant="outline" size="compact" onClick={newDraft}>New draft</Button>}
        </div>
        {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {saved && !error && <Notice variant="success" role="status">{saved}</Notice>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Campaign</th><th>Status</th><th>Class</th><th>Audience</th><th>Digest</th></tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} {...rowActivation(() => setSelectedId(version.id))}>
                  <td>
                    <span className="cell-main">{version.subject}</span>
                    <span className="admin-data-row-detail">{version.campaign_key} · v{version.version_number}</span>
                  </td>
                  <td><Badge variant="info">{version.status}</Badge></td>
                  <td>{version.communication_class} / {version.preference_category}</td>
                  <td>{version.audience}</td>
                  <td>{version.content_digest.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-chart-card" style={{ marginTop: 20 }}>
        <h2>{selected ? `${selected.internal_name} v${selected.version_number}` : "New campaign draft"}</h2>
        <p className="text-[var(--muted-fg)]">
          {editable
            ? "Preview and test only with reserved .test addresses. Publishing never enables the worker or provider transport."
            : "Content is immutable. Operational state can only pause, resume, cancel, or admit recipients."}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cv-campaign-key">Campaign key</Label>
            <Input id="cv-campaign-key" error={Boolean(form.formState.errors.campaignKey)} disabled={!!selected || !canEdit} {...form.register("campaignKey")} />
            <FieldError>{form.formState.errors.campaignKey?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="cv-internal-name">Internal name</Label>
            <Input id="cv-internal-name" error={Boolean(form.formState.errors.internalName)} disabled={locked} {...form.register("internalName")} />
            <FieldError>{form.formState.errors.internalName?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="cv-class">Class</Label>
            <Select id="cv-class"
              disabled={locked}
              {...form.register("communicationClass", {
                onChange: (event) => {
                  // Essential mail is never gated on a marketing preference.
                  if (event.target.value === "essential") form.setValue("preferenceCategory", "essential");
                  else if (form.getValues("preferenceCategory") === "essential") form.setValue("preferenceCategory", "product_updates");
                },
              })}
            >
              <option>essential</option>
              <option>marketing</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="cv-preference">Preference</Label>
            <Select id="cv-preference" disabled={locked} {...form.register("preferenceCategory")}>
              <option disabled={form.watch("communicationClass") !== "essential"}>essential</option>
              <option disabled={form.watch("communicationClass") === "essential"}>product_updates</option>
              <option disabled={form.watch("communicationClass") === "essential"}>career_tips</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="cv-audience">Audience</Label>
            <Select id="cv-audience" disabled={locked} {...form.register("audience")}>
              {AUDIENCES.map((option) => <option key={option}>{option}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="cv-reply-to">Reply to</Label>
            <Input id="cv-reply-to" error={Boolean(form.formState.errors.replyTo)} disabled={locked} {...form.register("replyTo")} />
            <FieldError>{form.formState.errors.replyTo?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cv-subject">Subject</Label>
            <Input id="cv-subject" error={Boolean(form.formState.errors.subject)} disabled={locked} {...form.register("subject")} />
            <FieldError>{form.formState.errors.subject?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cv-preheader">Preheader</Label>
            <Input id="cv-preheader" error={Boolean(form.formState.errors.preheader)} disabled={locked} {...form.register("preheader")} />
            <FieldError>{form.formState.errors.preheader?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cv-plain-text">Plain text</Label>
            <Textarea id="cv-plain-text" rows={7} error={Boolean(form.formState.errors.textBody)} disabled={locked} {...form.register("textBody")} />
            <FieldError>{form.formState.errors.textBody?.message}</FieldError>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="cv-html">HTML</Label>
            <Textarea id="cv-html" rows={7} error={Boolean(form.formState.errors.htmlBody)} disabled={locked} {...form.register("htmlBody")} />
            <FieldError>{form.formState.errors.htmlBody?.message}</FieldError>
            <div className="mt-4 rounded-xl border border-[var(--border)] p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="mr-auto text-sm font-semibold">Email preview</h3><Button size="compact" variant={previewWidth === "mobile" ? "primary" : "outline"} aria-pressed={previewWidth === "mobile"} onClick={() => setPreviewWidth("mobile")}>Mobile</Button><Button size="compact" variant={previewWidth === "desktop" ? "primary" : "outline"} aria-pressed={previewWidth === "desktop"} onClick={() => setPreviewWidth("desktop")}>Desktop</Button></div>
              <p className="mb-3 text-sm"><b>{form.watch("subject") || "Subject preview"}</b><br />{form.watch("preheader")}</p>
              <iframe title="Sandboxed email preview" sandbox="" referrerPolicy="no-referrer" className="mx-auto h-96 max-w-full rounded-lg border border-[var(--border)] bg-white" style={{ width: previewWidth === "mobile" ? 375 : 720 }} srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${form.watch("htmlBody") || "<p>Email preview</p>"}</body></html>`} />
              <p className="mt-2 text-xs text-[var(--muted-fg)]">Scripts, forms, and remote resources are blocked in this preview. Test sink does not deliver to a real mailbox.</p>
            </div>
          </div>
          <div>
            <Label htmlFor="cv-schedule-at">Schedule at</Label>
            <Input id="cv-schedule-at" type="datetime-local" error={Boolean(form.formState.errors.scheduledAt)} {...form.register("scheduledAt")} />
            <p className="mt-1 text-xs text-admin-muted-fg">Your browser’s local time. The saved schedule is converted to UTC.</p>
            <FieldError>{form.formState.errors.scheduledAt?.message}</FieldError>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {canEdit && editable && (
            <Button size="compact" isLoading={!!busy} onClick={() => void form.handleSubmit(() => mutate(selected ? "update_draft" : "create"))()}>
              {selected ? "Save draft" : "Create draft"}
            </Button>
          )}
          {canEdit && status === "draft" && (
            <Button variant="outline" size="compact" disabled={form.formState.isDirty} isLoading={!!busy} onClick={() => void mutate("test_sink")}>Test sink</Button>
          )}
          {canPublish && status === "draft" && (
            <>
              <Button variant="outline" size="compact" disabled={form.formState.isDirty} isLoading={!!busy} onClick={() => void form.trigger("scheduledAt").then((valid) => { if (valid) mutate("schedule"); })}>Schedule</Button>
              <Button size="compact" disabled={form.formState.isDirty} isLoading={!!busy} onClick={() => void mutate("activate_now")}>Activate now</Button>
            </>
          )}
          {canPublish && isLive && (
            <Button variant="outline" size="compact" isLoading={!!busy} onClick={() => void mutate("admit")}>Admit recipients</Button>
          )}
          {canPublish && status === "active" && (
            <Button variant="outline" size="compact" isLoading={!!busy} onClick={() => void mutate("pause")}>Pause</Button>
          )}
          {canPublish && status === "paused" && (
            <Button variant="outline" size="compact" isLoading={!!busy} onClick={() => void mutate("resume")}>Resume</Button>
          )}
          {canPublish && isLive && (
            <Button variant="danger" size="compact" isLoading={!!busy} onClick={() => void mutate("cancel")}>Cancel</Button>
          )}
          {canEdit && status === "draft" && (
            <Button variant="danger" size="compact" isLoading={!!busy} onClick={() => void mutate("delete_draft")}>Delete draft</Button>
          )}
        </div>
      </div>
      {dialog}
    </>
  );
}
