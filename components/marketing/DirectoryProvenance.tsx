import type { ReactNode } from "react";
import { FileText, Grid, Info, Server } from "@/app/icons";
import { Badge } from "@/components/ui/primitives";

export type DirectoryEvidenceKind =
  | "curated"
  | "database"
  | "guidance"
  | "illustrative";

const evidenceLabels: Record<DirectoryEvidenceKind, string> = {
  curated: "Curated taxonomy",
  database: "Database-backed catalog",
  guidance: "General guidance",
  illustrative: "Illustrative sample",
};

const evidenceIcons: Record<DirectoryEvidenceKind, ReactNode> = {
  curated: <Grid size={14} aria-hidden="true" />,
  database: <Server size={14} aria-hidden="true" />,
  guidance: <Info size={14} aria-hidden="true" />,
  illustrative: <FileText size={14} aria-hidden="true" />,
};

/**
 * The one-line provenance badge stays: it tells the reader what the data IS
 * (curated vs database-backed) in a single row — that is honesty labeling,
 * not filler. The big "Evidence boundaries" essay card below it is what was
 * bloat; that one is retired.
 */
export function DirectoryEvidenceNote({
  kind,
  detail,
  className = "",
}: {
  kind: DirectoryEvidenceKind;
  detail: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs leading-5 text-[var(--muted-fg)] ${className}`}
    >
      <Badge variant={kind === "database" ? "primary" : "neutral"}>
        {evidenceIcons[kind]}
        {evidenceLabels[kind]}
      </Badge>
      <span>{detail}</span>
    </div>
  );
}

/**
 * Retired (owner decision 2026-10-18: pure workspaces). The
 * "Evidence boundaries — how to read this directory" essay card repeated
 * under every directory page renders nothing now. Its exports stay so
 * imports don't break.
 */
export function DirectoryMethodCard(_props?: {
  title?: string;
  description: string;
  items: readonly {
    kind: DirectoryEvidenceKind;
    detail: string;
  }[];
  className?: string;
}) {
  return null;
}
