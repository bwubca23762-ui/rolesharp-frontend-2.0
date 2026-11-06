import type { ReactNode } from "react";
import { Info } from "@/app/icons";
import { Badge } from "@/components/ui/primitives";

type SampleStatus = "fictional" | "simulated" | "reviewed" | "permissioned";

const statusLabels: Record<SampleStatus, string> = {
  fictional: "Fictional sample",
  simulated: "Simulated workflow",
  reviewed: "Reviewed example",
  permissioned: "Permissioned outcome",
};

export function SampleProvenance({
  status,
  detail,
  className = "",
}: {
  status: SampleStatus;
  detail: string;
  className?: string;
}) {
  return (
    // Semantic aliases, not the light+dark: palette pair. Canvas is a different
    // axis from theme by design — an ink section sits inside a light page
    // without pulling the document into dark mode — so `dark:` never fires
    // there and the light value renders straight onto the ink surface. That is
    // how this line put #52647A on #1A2740 at 2.45:1 in the landing hero.
    // --muted-fg resolves to exactly the same colour as the pair did on both
    // ordinary themes, and to the ink muted inside a canvas.
    <div className={`flex flex-wrap items-center gap-2 text-xs leading-5 text-[var(--muted-fg)] ${className}`}>
      <Badge variant={status === "fictional" || status === "simulated" ? "neutral" : "primary"}>
        {statusLabels[status]}
      </Badge>
      <span className="inline-flex items-center gap-1.5">
        <Info size={14} className="shrink-0 text-[var(--primary)]" />
        {detail}
      </span>
    </div>
  );
}

export function ProductDemo({
  title,
  context,
  status = "fictional",
  provenance,
  children,
  className = "",
}: {
  title: string;
  context: string;
  status?: SampleStatus;
  provenance: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // Semantic aliases throughout, for the reason given in SampleProvenance:
    // this figure is rendered inside canvas sections, where `dark:` cannot help.
    <figure className={`overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-lg)] ${className}`}>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F6C75B]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#047857]" />
          </span>
          <strong className="truncate text-sm text-[var(--fg)]">{title}</strong>
        </div>
        <span className="text-xs font-semibold text-[var(--muted-fg)]">{context}</span>
      </div>
      <div>{children}</div>
      <figcaption className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 sm:px-5">
        <SampleProvenance status={status} detail={provenance} />
      </figcaption>
    </figure>
  );
}
