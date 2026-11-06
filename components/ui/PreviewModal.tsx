"use client";
import { useState, type ReactNode } from "react";
import { FileText, X } from "@/app/icons";
import AccessibleDialog from "./AccessibleDialog";

type Props = {
  /** Whether the floating launcher is offered at all. */
  visible: boolean;
  /** Accessible name for the launcher. */
  fabLabel: string;
  /** Visible launcher text. */
  fabText?: string;
  /** Accessible name for the dialog. */
  dialogLabel: string;
  /** Heading rendered inside the dialog. */
  title: string;
  closeLabel?: string;
  /** Receives a close callback for bodies that dismiss themselves. */
  children: (close: () => void) => ReactNode;
};

/**
 * The mobile result launcher and its dialog.
 *
 * Every tool hides its desktop result rail on small screens, so this floating
 * button is the only way back to the result. Five pages carried their own copy
 * of this markup; sharing it keeps the focus trap, the close affordance and the
 * heading structure identical across all of them.
 *
 * The launcher and the dialog stay independently conditional, matching the
 * original pages: an open dialog is not torn out from under the user if the
 * content backing the launcher goes away mid-interaction.
 */
export default function PreviewModal({
  visible,
  fabLabel,
  fabText = "Preview",
  dialogLabel,
  title,
  closeLabel = "Close preview",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      {visible && (
        <button className="preview-fab" onClick={() => setOpen(true)} aria-label={fabLabel}>
          <FileText size={18} /> {fabText}
        </button>
      )}
      {open && (
        <AccessibleDialog label={dialogLabel} onClose={close}>
          <div className="preview-modal-head">
            <strong>{title}</strong>
            <button className="icon-btn-sm" onClick={close} aria-label={closeLabel}><X size={18} /></button>
          </div>
          <div className="preview-modal-body">{children(close)}</div>
        </AccessibleDialog>
      )}
    </>
  );
}
