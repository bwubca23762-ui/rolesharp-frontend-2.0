"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function shortId(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

/**
 * Renders a long identifier (UUID, order id, crypto address) truncated on screen
 * with a copy-to-clipboard affordance and the full value in the title. Replaces
 * the raw 36-char strings that used to blow out table cells and detail rows.
 */
export function CopyableId({ value, className }: { value: string | null | undefined; className?: string }) {
  const [copied, setCopied] = React.useState(false);
  if (!value) return <span className={cn("text-admin-muted-fg", className)}>—</span>;
  const id = value;

  function copy() {
    void navigator.clipboard
      ?.writeText(id)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success("Identifier copied to clipboard.");
      })
      .catch(() => {});
  }

  return (
    <span className={cn("inline-flex items-center gap-1 font-mono", className)}>
      <span title={id}>{shortId(id)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy full identifier"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-admin-muted-fg hover:text-admin-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-ring"
      >
        {copied ? <Check size={13} className="text-admin-success" /> : <Copy size={13} />}
      </button>
    </span>
  );
}
