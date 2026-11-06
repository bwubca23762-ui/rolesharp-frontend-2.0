"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "./alert-dialog";
import { Button } from "./button";

/**
 * Guardrail for destructive admin actions (Phase 4: every delete/revoke/suspend
 * must confirm before executing). Two modes:
 *   - `requireReason`: the operator must type a reason before the confirm button
 *     enables (replaces the old window.prompt everywhere it was abused).
 *   - otherwise a plain confirm with a busy state.
 * Controlled by the parent; closed means not rendered, so typed state resets
 * cleanly each time it opens.
 */
export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  requireReason = false,
  minReasonLength = 1,
  reasonLabel = "Reason",
  reasonPlaceholder = "Required for the audit trail…",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  requireReason?: boolean;
  minReasonLength?: number;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  busy?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = React.useState("");

  function close() {
    setReason("");
    onClose();
  }

  // Await the action before closing: the dialog's whole point is the busy
  // state — closing synchronously flashes it away mid-flight and leaves the
  // operator with no feedback while the mutation is still running. A rejected
  // action keeps the dialog open with the error visible in the parent's
  // Notice, which is the correct recovery surface.
  async function handleConfirm() {
    if (busy) return;
    if (requireReason && reason.trim().length < minReasonLength) return;
    try {
      await onConfirm(reason.trim() || undefined);
    } catch {
      return; // parent surfaces the error; keep the dialog open to retry
    }
    close();
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {requireReason && (
          <div className="grid gap-1.5">
            <label htmlFor="confirm-action-reason" className="text-sm font-medium text-admin-fg">
              {reasonLabel}
            </label>
            <textarea
              id="confirm-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              autoFocus
              className="min-h-[80px] w-full resize-y rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-fg placeholder:text-admin-muted-fg focus:outline-none focus:ring-2 focus:ring-admin-ring"
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={busy || (requireReason && reason.trim().length < minReasonLength)}
            isLoading={busy}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
