"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge, Button, FieldError, Input, Label, Notice, Textarea } from "@/components/ui/primitives";
import { CopyableId } from "@/components/ui/admin/copyable-id";
import { ConfirmActionDialog } from "@/components/ui/admin/confirm-action-dialog";
import { rowActivation } from "../row-activation";
import { useAdminConfirm } from "../confirm-dialog";
import LegalMarkdown from "@/components/LegalMarkdown";
import { adminFetchJson } from "../admin-helpers";

type LegalVersion = {
  id: string;
  document_key: "terms" | "privacy";
  title: string;
  version_number: number;
  status: "draft" | "scheduled" | "published" | "superseded";
  body_markdown: string;
  change_summary: string;
  material_change: boolean;
  effective_at: string;
  content_digest: string;
  updated_at: string;
  acceptance_count?: number;
};

function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60_000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const legalFormSchema = z.object({
  summary: z.string().trim().min(3, "Add a short change summary.").max(300, "Keep the change summary under 300 characters."),
  effectiveAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Pick a valid effective date and time."),
  material: z.boolean(),
  body: z.string().trim().min(20, "Add at least 20 characters of document content.").max(200000),
});

type LegalFormValues = z.infer<typeof legalFormSchema>;

const emptyLegalDraft = (): LegalFormValues => ({ summary: "", effectiveAt: localDateTime(), material: true, body: "" });

export default function LegalView({ canEdit, canPublish }: { canEdit: boolean; canPublish: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [versions, setVersions] = useState<LegalVersion[]>([]);
  const [documentKey, setDocumentKey] = useState<"terms" | "privacy">("terms");
  const [selectedId, setSelectedId] = useState("");
  const loadedVersion = useRef("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [pendingDeleteDraft, setPendingDeleteDraft] = useState(false);
  // Six admin views reported failure and stayed silent on success, so an
  // operator could not tell a save from a no-op — the confirmation clears
  // whenever a new action starts.
  const [saved, setSaved] = useState("");

  const form = useForm<LegalFormValues>({
    resolver: zodResolver(legalFormSchema),
    defaultValues: emptyLegalDraft(),
  });

  const selected = useMemo(() => versions.find((version) => version.id === selectedId) ?? null, [selectedId, versions]);
  const load = useCallback(async () => {
    setError(""); setSaved("");
    try {
      const result = await adminFetchJson<{ versions: LegalVersion[] }>(`/api/admin/legal?document=${documentKey}`, { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error(result.error || "legal_list_failed");
      const data = result.data;
      setVersions(data.versions ?? []);
    } catch {
      setError("Legal versions are temporarily unavailable.");
    }
  }, [documentKey]);

  useAdminRefreshSignal(load);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected || (form.formState.isDirty && loadedVersion.current === selected.id)) return;
    loadedVersion.current = selected.id;
    form.reset({
      summary: selected.change_summary,
      effectiveAt: localDateTime(selected.effective_at),
      material: selected.material_change,
      body: selected.body_markdown,
    });
  }, [selected, form]);

  function startDraft() {
    loadedVersion.current = "";
    setSelectedId("");
    form.reset(emptyLegalDraft());
  }

  function mutate(action: "create" | "update_draft" | "schedule" | "publish_now" | "delete_draft", values?: LegalFormValues) {
    // Type-to-confirm, matching offers-view. These publish the immutable
    // document users are legally held to; the offer views already required
    // typing a phrase for the same risk class, while this one — arguably the
    // higher-stakes of the two — accepted a single OK.
    const willSaveEdits = (action === "schedule" || action === "publish_now") && form.formState.isDirty;
    const saveEditsNote = willSaveEdits
      ? " Unsaved form edits are saved to the draft first, then the action applies."
      : "";
    if (action === "schedule") {
      ask({
        title: "Schedule legal version",
        body: `Schedule this exact immutable version? Its content cannot be changed afterward.${saveEditsNote}`,
        word: "SCHEDULE LEGAL",
        run: async () => {
          if (willSaveEdits) {
            if (!await form.trigger()) throw new Error("Correct the highlighted fields before scheduling.");
            const saved = await performMutate("update_draft");
            if (!saved) throw new Error("Draft save failed.");
          }
          if (!await performMutate(action)) throw new Error("Legal scheduling failed.");
        },
      });
      return;
    }
    if (action === "publish_now") {
      ask({
        title: "Publish legal version",
        body: `Publish this exact immutable version now? Its content cannot be changed afterward.${saveEditsNote}`,
        word: "PUBLISH LEGAL",
        run: async () => {
          if (willSaveEdits) {
            if (!await form.trigger()) throw new Error("Correct the highlighted fields before publishing.");
            const saved = await performMutate("update_draft");
            if (!saved) throw new Error("Draft save failed.");
          }
          if (!await performMutate(action)) throw new Error("Legal publishing failed.");
        },
      });
      return;
    }
    void performMutate(action, values);
  }

  async function performMutate(action: "create" | "update_draft" | "schedule" | "publish_now" | "delete_draft", values?: LegalFormValues): Promise<boolean> {
    setBusy(action);
    setError(""); setSaved("");
    // Schedule/publish/delete act on the saved version, not the unsaved form
    // edits, so they never require values; create/update always receive them
    // from handleSubmit.
    const formValues = values ?? form.getValues();
    try {
      const payload = action === "create"
        ? { action, documentKey, bodyMarkdown: formValues.body, changeSummary: formValues.summary, materialChange: formValues.material, effectiveAt: new Date(formValues.effectiveAt).toISOString() }
        : action === "update_draft"
          ? { action, versionId: selectedId, bodyMarkdown: formValues.body, changeSummary: formValues.summary, materialChange: formValues.material, effectiveAt: new Date(formValues.effectiveAt).toISOString() }
          : { action, versionId: selectedId };
      const result = await adminFetchJson<{ version?: LegalVersion | null }>("/api/admin/legal", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.ok || !result.data) throw new Error(result.error || "legal_change_failed");
      const data = result.data;
      if (action === "create" || action === "update_draft") form.reset(formValues);
      setSelectedId(data.version?.id ?? "");
      await load(); setSaved("Change saved.");
      toast.success("Change saved.");
      if (action === "delete_draft") startDraft();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.replaceAll("_", " ") : "The legal change was not applied.";
      setError(message); toast.error(message);
      return false;
    } finally {
      setBusy("");
    }
  }

  const editable = !selected || selected.status === "draft";
  return <>
    <PageHeader title="Legal documents" desc="Create drafts, freeze exact content when scheduling or publishing, and preserve acceptance against content digests. Qualified legal review remains an external approval requirement." onRefresh={() => { void load(); }} />
    <div className="admin-table-card">
      <div className="admin-table-toolbar">
        <select className="admin-table-filter" aria-label="Legal document" value={documentKey} onChange={(event) => { setDocumentKey(event.target.value as "terms" | "privacy"); startDraft(); }}>
          <option value="terms">Terms of Service</option><option value="privacy">Privacy Policy</option>
        </select>
        {canEdit && <Button variant="outline" size="compact" type="button" onClick={startDraft}>New draft</Button>}
      </div>
      {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {saved && !error && <Notice variant="success" role="status">{saved}</Notice>}
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Version</th><th>Status</th><th>Effective</th><th>Change</th><th>Digest</th></tr></thead><tbody>
        {versions.map((version) => <tr key={version.id} {...rowActivation(() => setSelectedId(version.id))}><td><span className="cell-main">v{version.version_number}</span><span className="admin-data-row-detail"><CopyableId value={version.id} /></span></td><td><Badge variant={version.status === "published" ? "success" : version.status === "draft" ? "warning" : "info"}>{version.status}</Badge></td><td>{new Date(version.effective_at).toLocaleString()}</td><td>{version.change_summary}</td><td><code>{version.content_digest.slice(0, 12)}…</code></td></tr>)}
        {!versions.length && <tr><td colSpan={5} className="text-[var(--muted-fg)]">No versions found.</td></tr>}
      </tbody></table></div>
    </div>
    <div className="admin-chart-card" style={{ marginTop: 20 }}>
      <h2>{selected ? `${selected.title} v${selected.version_number}` : `New ${documentKey} draft`}</h2>
      <p className="text-[var(--muted-fg)]">{selected && selected.status !== "draft" ? "This version is immutable." : "Draft content remains editable until scheduling or publication."}</p>
      {selected && <p className="mb-4 text-sm"><b>{selected.acceptance_count ?? 0}</b> recorded exact-version acceptance{selected.acceptance_count === 1 ? "" : "s"}.</p>}
      <Label htmlFor="legal-summary">Change summary</Label>
      <Input id="legal-summary" error={Boolean(form.formState.errors.summary)} disabled={!canEdit || !editable} {...form.register("summary")} />
      <FieldError>{form.formState.errors.summary?.message}</FieldError>
      <Label htmlFor="legal-effective">Effective time</Label>
      <Input id="legal-effective" type="datetime-local" error={Boolean(form.formState.errors.effectiveAt)} disabled={!canEdit || !editable} {...form.register("effectiveAt")} />
      <FieldError>{form.formState.errors.effectiveAt?.message}</FieldError>
      <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}><input type="checkbox" disabled={!canEdit || !editable} {...form.register("material")} /> Material change requiring exact reacceptance</label>
      <Label htmlFor="legal-body">Markdown body</Label>
      <div className="my-3 flex gap-2" aria-label="Legal content view"><Button variant={preview ? "outline" : "primary"} size="compact" aria-pressed={!preview} onClick={() => setPreview(false)}>Edit Markdown</Button><Button variant={preview ? "primary" : "outline"} size="compact" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</Button></div>
      {preview ? <div className="prose min-h-[360px] rounded-xl border border-[var(--border)] p-5"><LegalMarkdown markdown={form.watch("body") || "Draft preview"} /></div> : <Textarea id="legal-body" style={{ minHeight: 360, fontFamily: "var(--font-mono)" }} error={Boolean(form.formState.errors.body)} disabled={!canEdit || !editable} {...form.register("body")} />}
      <FieldError>{form.formState.errors.body?.message}</FieldError>
      <div className="admin-row-actions" style={{ marginTop: 16 }}>
        {canEdit && editable && (!selected ? <Button isLoading={Boolean(busy)} onClick={() => void form.handleSubmit((values) => mutate("create", values))()}>Save draft</Button> : <Button isLoading={Boolean(busy)} onClick={() => void form.handleSubmit((values) => mutate("update_draft", values))()}>Save draft</Button>)}
        {canPublish && selected?.status === "draft" && <><Button variant="outline" isLoading={Boolean(busy)} onClick={() => void mutate("schedule")}>Schedule</Button><Button isLoading={Boolean(busy)} onClick={() => void mutate("publish_now")}>Publish now</Button></>}
        {canEdit && selected?.status === "draft" && <Button variant="danger" isLoading={Boolean(busy)} onClick={() => setPendingDeleteDraft(true)}>Delete draft</Button>}
      </div>
    </div>
    <ConfirmActionDialog
      open={pendingDeleteDraft}
      title="Delete draft"
      description="Delete this draft? Published and scheduled versions cannot be deleted."
      confirmLabel="Delete draft"
      busy={busy === "delete_draft"}
      onConfirm={async () => { if (!await performMutate("delete_draft")) throw new Error("Draft deletion failed."); setPendingDeleteDraft(false); }}
      onClose={() => setPendingDeleteDraft(false)}
    />
    {dialog}
  </>;
}
