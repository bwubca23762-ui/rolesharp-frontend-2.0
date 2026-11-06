"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { TOOLS } from "@/lib/tools-registry";
import { toolWorkspaceForPath } from "@/lib/tool-workspaces";

const ENTRY_LABELS: Record<string, string> = { "/build": "Resume builder", "/resume-maker": "Manual resume maker", "/resume-builder": "Resume builder guide", "/resume-tailoring": "Resume tailoring guide", "/interview-prep": "Practice session", "/jobs": "Find jobs" };

export default function ToolWorkspaceNav() {
  const pathname = usePathname();
  const workspace = toolWorkspaceForPath(pathname);
  if (!workspace) return null;
  return (
    <nav aria-label="Current tool workspace" className="border-b border-[var(--hairline)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6">
        <Link href="/tools" className="inline-flex min-h-11 items-center text-sm text-[var(--muted-fg)]">All workspaces</Link>
        <span aria-hidden="true" className="text-[var(--muted-fg)]">/</span>
        <Link href={workspace.href} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--fg)]">{workspace.title}</Link>
        <details key={pathname} className="basis-full text-sm">
          <summary className="min-h-11 cursor-pointer content-center text-[var(--muted-fg)]">Related tools</summary>
          <ul className="flex min-w-0 flex-wrap gap-2 pb-3">
            {workspace.paths.map((href) => (
              <li key={href} className="min-w-0"><Link href={href} aria-current={pathname === href ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg border border-[var(--hairline)] px-3 py-2 ${pathname === href ? "bg-[var(--surface-2)] font-semibold text-[var(--primary)]" : "text-[var(--fg)] hover:bg-[var(--surface-2)]"}`}>
                {ENTRY_LABELS[href] ?? TOOLS.find((tool) => tool.href === href)?.name ?? workspace.title}
              </Link></li>
            ))}
          </ul>
        </details>
      </div>
    </nav>
  );
}
