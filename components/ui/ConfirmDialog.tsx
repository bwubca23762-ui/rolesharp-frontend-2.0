"use client";

import { useState } from "react";
import AccessibleDialog from "./AccessibleDialog";
import { Button, Input, Label } from "./primitives";

/**
 * The one confirmation surface for user-facing destructive and renaming
 * actions, built on AccessibleDialog so it inherits the focus trap, Escape
 * handling, scroll lock, and focus restoration that already existed.
 *
 * Written because the workspace was asking for these decisions with native
 * confirm() / prompt() / alert() — including renaming a resume through
 * window.prompt. Native dialogs cannot be styled, cannot say which resume they
 * mean beyond one line of plain text, are suppressible by the browser ("prevent
 * this page from creating additional dialogs" kills the flow silently), and
 * block the whole thread. The app already shipped both AccessibleDialog and a
 * Toast system; nothing here is new capability, it is the existing capability
 * finally reaching the pages that needed it.
 *
 * `defaultValue` turns this into a prompt: present means the dialog collects a
 * value and hands it to onConfirm, absent means it is a yes/no.
 */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive = false,
  defaultValue,
  inputLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  defaultValue?: string;
  inputLabel?: string;
  onConfirm: (value: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const isPrompt = defaultValue !== undefined;

  async function confirm() {
    if (busy || (isPrompt && !value.trim())) return;
    setBusy(true);
    try {
      await onConfirm(value.trim());
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessibleDialog label={title} onClose={onCancel}>
      <form
        className="grid gap-4 p-5"
        onSubmit={(event) => { event.preventDefault(); void confirm(); }}
      >
        <div>
          <h2 className="text-lg font-bold! text-[var(--color-text)]">{title}</h2>
          {body && <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">{body}</p>}
        </div>
        {isPrompt && (
          <div>
            <Label htmlFor="confirm-dialog-value">{inputLabel ?? "Name"}</Label>
            <Input
              id="confirm-dialog-value"
              value={value}
              autoFocus
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            type="submit"
            variant={destructive ? "danger" : "primary"}
            disabled={busy || (isPrompt && !value.trim())}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </form>
    </AccessibleDialog>
  );
}
