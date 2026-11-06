"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "../admin-shared";
import { useAdminRefreshSignal } from "../admin-shared";
import { Badge, type BadgeVariant, Button, FieldError, Input, Label, Notice, Select, Textarea } from "@/components/ui/primitives";
import { rowActivation } from "../row-activation";
import { useAdminConfirm } from "../confirm-dialog";
import { adminFetchJson } from "../admin-helpers";

type Version = {
  id: string;
  publication_key: string;
  internal_name: string;
  version_number: number;
  status: "draft" | "scheduled" | "published" | "superseded";
  category: string;
  preference_category: string;
  audience: string;
  surface: string;
  severity: string;
  material: boolean;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  content_digest: string;
  effective_at: string;
  expires_at: string | null;
};

type State = {
  publication_version_id: string;
  reached: number;
  read: number;
  dismissed: number;
};

type MutateAction = "create" | "update_draft" | "schedule" | "publish_now" | "delete_draft";

/** Type-to-confirm phrase guarding each irreversible action. */
const CONFIRM_PHRASE: Partial<Record<MutateAction, string>> = {
  schedule: "SCHEDULE NOTICE",
  publish_now: "PUBLISH NOTICE",
  delete_draft: "DELETE DRAFT",
};

const CONFIRM_TITLE: Partial<Record<MutateAction, string>> = {
  schedule: "Schedule notice",
  publish_now: "Publish notice now",
  delete_draft: "Delete draft",
};

const CATEGORIES = ["service", "security", "legal", "product", "career"];
const PREFERENCES = ["essential", "product_updates", "career_tips"];
const AUDIENCES = ["all_authenticated", "free", "premium", "student"];
const SURFACES = ["inbox", "banner", "both"];
const SEVERITIES = ["info", "success", "warning", "critical"];

const notificationsFormSchema = z.object({
  publicationKey: z.string().trim().min(1, "A publication key is required."),
  internalName: z.string().trim().min(1, "Name the publication."),
  category: z.string().min(1, "Pick a category."),
  preferenceCategory: z.string().min(1, "Pick a preference category."),
  audience: z.string().min(1, "Pick an audience."),
  surface: z.string().min(1, "Pick a surface."),
  severity: z.string().min(1, "Pick a severity."),
  material: z.boolean(),
  title: z.string().trim().min(1, "A title is required.").max(150, "Keep the title under 150 characters."),
  body: z.string().refine((value) => value.trim().length > 0, "The body is required."),
  ctaLabel: z.string().max(100, "Keep the CTA label under 100 characters."),
  // The API and 049_in_app_notifications.sql store in-app CTA URLs as
  // app-relative paths (/pricing, /daily-matches). An absolute http(s) URL
  // passed the old client validation and then failed the API schema.
  ctaUrl: z.string().trim().refine((value) => value === "" || /^\/[^/]/.test(value), "CTA URLs must be app-relative paths starting with a single slash (e.g. /pricing)."),
  effectiveAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Pick a valid effective date and time."),
  expiresAt: z.string().refine((value) => value === "" || !Number.isNaN(new Date(value).getTime()), "Pick a valid expiry date and time."),
});

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;

const emptyNotificationsDraft = (): NotificationsFormValues => ({
  publicationKey: "product_update",
  internalName: "Product update",
  category: "product",
  preferenceCategory: "product_updates",
  audience: "all_authenticated",
  surface: "inbox",
  severity: "info",
  material: false,
  title: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
  effectiveAt: localDateTime(),
  expiresAt: "",
});

/** `datetime-local` needs a local-clock string, not the UTC that toISOString gives. */
function localDateTime(value?: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 86400_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Choice({
  label,
  value,
  options,
  disabled,
  onChange,
  error,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <Label htmlFor={`nv-choice-${label.toLowerCase().replace(/\W+/g, "-")}`}>{label}</Label>
      <Select
        id={`nv-choice-${label.toLowerCase().replace(/\W+/g, "-")}`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => <option key={option}>{option}</option>)}
      </Select>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export default function NotificationsView({ canEdit, canPublish }: { canEdit: boolean; canPublish: boolean }) {
  const { ask, dialog } = useAdminConfirm();
  const [versions, setVersions] = useState<Version[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const loadedVersion = useRef("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // Six admin views reported failure and stayed silent on success, so an
  // operator could not tell a save from a no-op — the form simply sat there
  // either way. The confirmation clears whenever a new action starts.
  const [saved, setSaved] = useState("");

  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: emptyNotificationsDraft(),
  });

  const selected = useMemo(
    () => versions.find((item) => item.id === selectedId) ?? null,
    [selectedId, versions],
  );

  const load = useCallback(async () => {
    try {
      const result = await adminFetchJson<{ versions: Version[]; states: State[] }>("/api/admin/notifications", { cache: "no-store" });
      if (!result.ok || !result.data) throw new Error(result.error);
      const data = result.data;
      setVersions(data.versions ?? []);
      setStates(data.states ?? []);
      setError(""); setSaved("");
    } catch {
      setError("Publications are temporarily unavailable.");
    }
  }, []);

  useAdminRefreshSignal(load);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected || (form.formState.isDirty && loadedVersion.current === selected.id)) return;
    loadedVersion.current = selected.id;
    form.reset({
      publicationKey: selected.publication_key,
      internalName: selected.internal_name,
      category: selected.category,
      preferenceCategory: selected.preference_category,
      audience: selected.audience,
      surface: selected.surface,
      severity: selected.severity,
      material: selected.material,
      title: selected.title,
      body: selected.body,
      ctaLabel: selected.cta_label ?? "",
      ctaUrl: selected.cta_url ?? "",
      effectiveAt: localDateTime(selected.effective_at),
      expiresAt: selected.expires_at ? localDateTime(selected.expires_at) : "",
    });
  }, [selected, form]);

  function newDraft() {
    loadedVersion.current = "";
    setSelectedId("");
    form.reset(emptyNotificationsDraft());
  }

  function mutate(action: MutateAction) {
    const expected = CONFIRM_PHRASE[action];
    if (!expected) { void performMutate(action); return; }
    const willSaveEdits = action !== "delete_draft" && form.formState.isDirty;
    ask({
      title: CONFIRM_TITLE[action] ?? expected,
      body: willSaveEdits
        ? "Unsaved form edits are saved to the draft first, then the action applies to the selected notice version. Recorded in the audit log."
        : "This applies to the selected notice version and is recorded in the audit log.",
      word: expected,
      run: async () => {
        // Save-then-act: schedule/publish previously acted on the SAVED row,
        // silently ignoring on-screen edits (stale publishes or
        // notification_schedule_must_be_future on edited effective times).
        if (willSaveEdits) {
          if (!await form.trigger()) throw new Error("Correct the highlighted fields before publishing.");
          const saved = await performMutate("update_draft");
          if (!saved) throw new Error("Draft save failed.");
        }
        if (!await performMutate(action, expected)) throw new Error("Notification action failed.");
      },
    });
  }

  async function performMutate(action: MutateAction, confirmation?: string): Promise<boolean> {
    setBusy(action);
    setError(""); setSaved("");

    // create/update arrive validated from handleSubmit; operational actions
    // act on the saved version and just read the current form state.
    const formValues = form.getValues();
    const fields = {
      internalName: formValues.internalName,
      category: formValues.category,
      preferenceCategory: formValues.preferenceCategory,
      audience: formValues.audience,
      surface: formValues.surface,
      severity: formValues.severity,
      material: formValues.material,
      title: formValues.title,
      body: formValues.body,
      ctaLabel: formValues.ctaLabel || null,
      ctaUrl: formValues.ctaUrl || null,
      effectiveAt: formValues.effectiveAt,
      expiresAt: formValues.expiresAt || null,
    };
    try {
      if (action === "create" || action === "update_draft") {
        fields.effectiveAt = new Date(formValues.effectiveAt).toISOString();
        fields.expiresAt = formValues.expiresAt ? new Date(formValues.expiresAt).toISOString() : null;
      }
      const payload =
        action === "create" ? { action, publicationKey: formValues.publicationKey, ...fields }
        : action === "update_draft" ? { action, versionId: selectedId, ...fields }
        : { action, versionId: selectedId, confirmation };
      const result = await adminFetchJson<{ version?: Version }>("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!result.ok || !result.data) throw new Error(result.error || "notification_change_failed");
      const data = result.data;
      if (action === "create" || action === "update_draft") form.reset(formValues);
      setSelectedId(data.version?.id ?? "");
      await load(); setSaved("Change saved.");
      toast.success("Change saved.");
      if (action === "delete_draft") newDraft();
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.replaceAll("_", " ") : "Notification change failed.";
      setError(message); toast.error(message);
      return false;
    } finally {
      setBusy("");
    }
  }

  const editable = !selected || selected.status === "draft";
  const locked = !editable || !canEdit;

  return (
    <>
      <PageHeader

        title="In-app notifications"
        desc="Draft, preview, schedule, and publish durable notices. Published content is immutable; per-user read and dismissal state is lazy and deduplicated."
        onRefresh={() => void load()}
      />

      <div className="admin-table-card">
        <div className="admin-table-toolbar">
          {canEdit && <Button variant="outline" size="compact" onClick={newDraft}>New draft</Button>}
        </div>
        {error && <Notice variant="danger" role="alert">{error}</Notice>}
      {saved && !error && <Notice variant="success" role="status">{saved}</Notice>}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Publication</th><th>Status</th><th>Audience</th>
                <th>Effective</th><th>Reached</th><th>Read</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => {
                const state = states.find((item) => item.publication_version_id === version.id);
                const tone: BadgeVariant = version.status === "published" ? "success" : version.status === "draft" ? "warning" : "info";
                return (
                  <tr key={version.id} {...rowActivation(() => setSelectedId(version.id))}>
                    <td>
                      <span className="cell-main">{version.title}</span>
                      <span className="admin-data-row-detail">{version.publication_key} · v{version.version_number}</span>
                    </td>
                    <td><Badge variant={tone}>{version.status}</Badge></td>
                    <td>{version.audience}</td>
                    <td>{new Date(version.effective_at).toLocaleString()}</td>
                    <td>{state?.reached ?? 0}</td>
                    <td>{state?.read ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-chart-card" style={{ marginTop: 20 }}>
        <h2>{selected ? `${selected.internal_name} v${selected.version_number}` : "New publication draft"}</h2>
        <p className="text-[var(--muted-fg)]">
          {editable ? "Preview copy and targeting before publication." : "This published version is immutable."}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nv-publication-key">Publication key</Label>
            <Input id="nv-publication-key"
              error={Boolean(form.formState.errors.publicationKey)}
              disabled={!!selected || !canEdit}
              {...form.register("publicationKey")}
            />
            <FieldError>{form.formState.errors.publicationKey?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="nv-internal-name">Internal name</Label>
            <Input id="nv-internal-name" error={Boolean(form.formState.errors.internalName)} disabled={locked} {...form.register("internalName")} />
            <FieldError>{form.formState.errors.internalName?.message}</FieldError>
          </div>
          <Controller
            name="category"
            control={form.control}
            render={({ field, fieldState }) => (
              <Choice label="Category" value={field.value} options={CATEGORIES} disabled={locked} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            name="preferenceCategory"
            control={form.control}
            render={({ field, fieldState }) => (
              <Choice label="Preference" value={field.value} options={PREFERENCES} disabled={locked} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            name="audience"
            control={form.control}
            render={({ field, fieldState }) => (
              <Choice label="Audience" value={field.value} options={AUDIENCES} disabled={locked} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            name="surface"
            control={form.control}
            render={({ field, fieldState }) => (
              <Choice label="Surface" value={field.value} options={SURFACES} disabled={locked} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <Controller
            name="severity"
            control={form.control}
            render={({ field, fieldState }) => (
              <Choice label="Severity" value={field.value} options={SEVERITIES} disabled={locked} onChange={field.onChange} error={fieldState.error?.message} />
            )}
          />
          <div>
            <Label htmlFor="nv-effective">Effective</Label>
            <Input id="nv-effective" type="datetime-local" error={Boolean(form.formState.errors.effectiveAt)} disabled={locked} {...form.register("effectiveAt")} />
            <FieldError>{form.formState.errors.effectiveAt?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="nv-expires-optional">Expires (optional)</Label>
            <Input id="nv-expires-optional" type="datetime-local" error={Boolean(form.formState.errors.expiresAt)} disabled={locked} {...form.register("expiresAt")} />
            <FieldError>{form.formState.errors.expiresAt?.message}</FieldError>
          </div>
        </div>

        <Label>
          <input type="checkbox" disabled={locked} {...form.register("material")} />
          {" "}Material banner notice
        </Label>
        <Label>
          Title
          <Input error={Boolean(form.formState.errors.title)} disabled={locked} {...form.register("title")} />
        </Label>
        <FieldError>{form.formState.errors.title?.message}</FieldError>
        <Label>
          Body
          <Textarea style={{ minHeight: 130 }} error={Boolean(form.formState.errors.body)} disabled={locked} {...form.register("body")} />
        </Label>
        <FieldError>{form.formState.errors.body?.message}</FieldError>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="nv-cta-label">CTA label</Label>
            <Input id="nv-cta-label" error={Boolean(form.formState.errors.ctaLabel)} disabled={locked} {...form.register("ctaLabel")} />
            <FieldError>{form.formState.errors.ctaLabel?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="nv-internal-cta-url">Internal CTA URL</Label>
            <Input id="nv-internal-cta-url" error={Boolean(form.formState.errors.ctaUrl)} disabled={locked} {...form.register("ctaUrl")} />
            <FieldError>{form.formState.errors.ctaUrl?.message}</FieldError>
          </div>
        </div>

        <div className="admin-ops-banner" style={{ marginTop: 16 }}>
          <div>
            <b>{form.watch("title") || "Notification preview"}</b>
            <p>{form.watch("body") || "Draft body preview."}</p>
            {form.watch("ctaLabel") && form.watch("ctaUrl") && <span>{form.watch("ctaLabel")} → {form.watch("ctaUrl")}</span>}
          </div>
        </div>

        <div className="admin-row-actions" style={{ marginTop: 16 }}>
          {canEdit && editable && (
            <Button isLoading={!!busy} onClick={() => void form.handleSubmit(() => mutate(selected ? "update_draft" : "create"))()}>
              Save draft
            </Button>
          )}
          {canPublish && selected?.status === "draft" && (
            <>
              <Button variant="outline" isLoading={!!busy} onClick={() => void mutate("schedule")}>Schedule</Button>
              <Button isLoading={!!busy} onClick={() => void mutate("publish_now")}>Publish now</Button>
            </>
          )}
          {canEdit && selected?.status === "draft" && (
            <Button variant="danger" isLoading={!!busy} onClick={() => void mutate("delete_draft")}>Delete draft</Button>
          )}
        </div>
      </div>
      {dialog}
    </>
  );
}
