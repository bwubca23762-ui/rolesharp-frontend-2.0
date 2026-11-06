"use client";

import { useCallback, useState } from "react";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import { Button } from "@/components/ui/primitives";

// Type-to-confirm for high-blast-radius admin actions (audit A-H3: user
// PERMANENT delete was guarded the same as +5 credits). The confirm word is
// derived from the action so the operator must read what they are agreeing to.
export function ConfirmDialog({
  open,
  title,
  body,
  confirmWord,
  busy = false,
  danger = true,
  onConfirm,
  onClose,
}: {
  /** Controlled by the parent; the dialog renders while truthy. */
  open: boolean;
  title: string;
  body: string;
  /** The exact word the operator must type. Use something action-specific ("DELETE", the email, the unit name). */
  confirmWord: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim() === confirmWord;

  // The dialog is controlled by the parent's target state. Rendering while
  // closed mounted a permanent "Permanently delete account" prompt over
  // /admin/users on every page load — with an empty email in the body — and
  // no Cancel click could dismiss it because the render never depended on
  // `open`. Closed means not rendered; typed text resets so reopening starts
  // clean.
  if (!open) return null;

  function close() {
    setTyped("");
    onClose();
  }

  // Async-then-close: a synchronous close kills the busy feedback the moment
  // the mutation starts. Awaiting keeps "Working..." up until the action
  // settles; on rejection the dialog stays open so the operator sees the
  // parent's error and can retry without re-typing the confirm word.
  async function confirm() {
    if (!ready || busy) return;
    try {
      await onConfirm();
    } catch {
      return;
    }
    close();
  }

  return (
    <AccessibleDialog label={title} onClose={close}>
      <h3 className="m-0 text-lg font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{body}</p>
      <p className="mt-4 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        Type <strong className="font-[family-name:var(--font-mono)] text-[var(--color-danger)] dark:text-[var(--color-danger)]">{confirmWord}</strong> to confirm.
      </p>
      <input
        autoFocus
        type="text"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") confirm();
        }}
        aria-label={`Type ${confirmWord} to confirm`}
        className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text)]"
      />
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" size="compact" onClick={close} disabled={busy}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} size="compact" disabled={!ready || busy} isLoading={busy} onClick={confirm}>
          {busy ? "Working..." : "Confirm"}
        </Button>
      </div>
    </AccessibleDialog>
  );
}

export type AdminConfirmSpec = {
  title: string;
  body: string;
  /** The exact word the operator must type. Derive it from the action so the copy stays readable ("APPLY", "PURGE", the unit name). */
  word: string;
  /** The work to perform once the word is typed. The dialog closes itself; the view keeps rendering its own busy/Notice states. */
  run: () => void | Promise<void>;
};

/**
 * The one entry point for admin destructive flows: `ask(spec)` opens the
 * staged type-to-confirm dialog and `dialog` renders it (spread it into the
 * view's JSX once). This replaces the native confirm()/prompt() calls the
 * admin views still used — native dialogs are unstyled, block the thread, and
 * are silently suppressible by the browser, while this one inherits the
 * AccessibleDialog focus trap and reads which entity it acts on.
 */
export function useAdminConfirm() {
  const [spec, setSpec] = useState<AdminConfirmSpec | null>(null);
  const ask = useCallback((next: AdminConfirmSpec) => setSpec(next), []);
  const close = useCallback(() => setSpec(null), []);
  const dialog = spec ? (
    <ConfirmDialog
      open
      title={spec.title}
      body={spec.body}
      confirmWord={spec.word}
      // The promise must FLOW THROUGH: `void spec.run()` returns undefined,
      // ConfirmDialog awaits it in 0ms and closes before the request settles,
      // so the operator loses the busy state and can't see in-dialog errors.
      onConfirm={() => spec.run()}
      onClose={close}
    />
  ) : null;
  return { ask, dialog };
}
