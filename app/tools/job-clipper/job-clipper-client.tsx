"use client";
import { useState } from "react";
import { Card, GeneratedOutput, Notice } from "@/components/ui/primitives";
import { bookmarkletSource } from "@/lib/job-clipper";

// Job clipper client (Phase 4): shows the bookmarklet code to copy. The
// code is deliberately TEXT, not a draggable javascript: link — browsers
// and CSPs increasingly refuse inline script URLs, and a pasted bookmark
// is the same one-click once installed.

export default function JobClipperClient({ siteUrl }: { siteUrl: string }) {
  // Server-provided site URL: `window` does not exist during SSR, and a
  // bookmarklet built from location.origin on a proxied origin could point
  // somewhere other than the canonical site.
  const source = bookmarkletSource(siteUrl);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked — the GeneratedOutput copy path below still works.
    }
  }

  return (
    <Card className="p-5">
      <h2 className="m-0 text-base font-bold! text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Install the clipper (once)</h2>
      <ol className="mt-2 mb-4 list-decimal space-y-1.5 pl-5 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
        <li>Copy the code below.</li>
        <li>Create a new bookmark in your browser — name it &ldquo;Clip to RoleSharp&rdquo;.</li>
        <li>Paste the code as the bookmark&rsquo;s URL and save.</li>
        <li>On any job posting, click the bookmark. The posting lands in your workspace.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-9 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 text-sm font-semibold text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface-2)] dark:text-[var(--color-dark-text)]"
        >
          {copied ? "Copied ✓" : "Copy bookmarklet code"}
        </button>
      </div>
      <div className="mt-4">
        <GeneratedOutput label="Bookmarklet code" text={source} />
      </div>
      <Notice variant="info" className="mt-4">
        The clipper reads only the page you run it on, in your own browser. Nothing is uploaded until you choose to
        generate with it — and job-posting text is processed like any text you paste.
      </Notice>
    </Card>
  );
}
