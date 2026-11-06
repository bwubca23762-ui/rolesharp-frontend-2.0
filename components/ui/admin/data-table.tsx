"use client";

import * as React from "react";
import { Inbox, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Columns3, Download, Rows3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./table";
import { Skeleton } from "./skeleton";
import { EmptyState } from "./empty";
import { Button } from "./button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "./tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./dropdown-menu";

export type DataTableStatus = "loading" | "error" | "success";
export type DataTableDensity = "compact" | "standard" | "comfortable";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  cell: (row: T) => React.ReactNode;
}

export interface DataTablePagination {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}

/** Opt-in row selection — drives the floating bulk-action dock. */
export interface DataTableSelection<T = unknown> {
  selected: Set<string>;
  onToggle: (key: string) => void;
  onClear: () => void;
  /** Contextual batch buttons rendered in the dock. */
  actions?: React.ReactNode;
  /** Rows in the current page (select-all knows what it covers). */
  rows?: T[];
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[] | undefined;
  status: DataTableStatus;
  error?: string;
  onRetry?: () => void;
  rowKey: (row: T) => string | number;
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: React.ReactNode;
  empty?: { icon?: React.ReactNode; title?: React.ReactNode; description?: React.ReactNode };
  /** A horizontally-arranged cluster of row actions (see <RowActions />). */
  rowActions?: (row: T) => React.ReactNode;
  pagination?: DataTablePagination;
  skeletonRows?: number;
  className?: string;
  ariaLabel?: string;
  /** Export filename base for the current-view CSV/JSON button ("users" → users.csv). */
  exportName?: string;
  /** Silence the unused-generic lint when callers don't bind rows. */
  _phantom?: T;
  /** Enables row checkboxes + the floating bulk-action dock. */
  selection?: DataTableSelection<T>;
  /** Sticky frosted header — on by default. */
  stickyHeader?: boolean;
}

/** Flatten a rendered cell (string | number | element tree) to its text content. */
function nodeToText(node: React.ReactNode): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return nodeToText(props?.children);
  }
  if (Array.isArray(node)) return node.map(nodeToText).join(" ");
  return "";
}

function csvCell(value: string): string {
  const safe = value.replace(/"/g, '""').replace(/[\r\n]+/g, " ");
  return /[",]/.test(safe) ? `"${safe}"` : safe;
}

const DENSITY_ROW: Record<DataTableDensity, string> = {
  compact: "[&_td]:py-1.5 [&_th]:py-1.5 [&_td]:text-[12.5px]",
  standard: "",
  comfortable: "[&_td]:py-4 [&_th]:py-3",
};

const DENSITY_LABEL: Record<DataTableDensity, string> = {
  compact: "Compact",
  standard: "Standard",
  comfortable: "Comfortable",
};

const DENSITY_STORAGE_KEY = "rs-admin-table-density";

export function DataTable<T>({
  columns,
  data,
  status,
  error,
  onRetry,
  rowKey,
  title,
  description,
  toolbar,
  empty,
  rowActions,
  pagination,
  skeletonRows = 5,
  className,
  ariaLabel,
  exportName,
  selection,
  stickyHeader = true,
}: DataTableProps<T>) {
  const isEmpty = status === "success" && (!data || data.length === 0);
  const showPagination = status === "success" && !!pagination && pagination.pageCount > 1;

  const [density, setDensity] = React.useState<DataTableDensity>("standard");
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
      if (saved === "compact" || saved === "standard" || saved === "comfortable") setDensity(saved);
    } catch {}
  }, []);
  function applyDensity(next: DataTableDensity) {
    setDensity(next);
    try {
      localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {}
  }

  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(new Set());
  const visibleColumns = columns.filter((column) => !hiddenColumns.has(column.id));
  const allColumnsHidden = visibleColumns.length === 0;

  function exportView(format: "csv" | "json") {
    const rows = data ?? [];
    if (!rows.length) return;
    const header = visibleColumns.map((c) => c.id);
    const lines = rows.map((row) => {
      const record: Record<string, string> = {};
      for (const column of visibleColumns) {
        // Row actions columns are rendered, not data — skip them.
        record[column.id] = nodeToText(column.cell(row)).trim();
      }
      return record;
    });
    let blob: Blob;
    if (format === "json") {
      blob = new Blob([JSON.stringify(lines, null, 2)], { type: "application/json" });
    } else {
      const csv = [header.map(csvCell).join(","), ...lines.map((record) => header.map((id) => csvCell(record[id] ?? "")).join(","))].join("\n");
      blob = new Blob([csv], { type: "text/csv" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName || "admin-table"}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"} (${format.toUpperCase()}).`);
  }

  const densityMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Row density" title="Row density">
          <Rows3 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Row density</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(DENSITY_LABEL) as DataTableDensity[]).map((level) => (
          <DropdownMenuCheckboxItem key={level} checked={density === level} onCheckedChange={() => applyDensity(level)}>
            {DENSITY_LABEL[level]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columnMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Toggle columns" title="Toggle columns">
          <Columns3 className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-auto">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={!hiddenColumns.has(column.id)}
            onCheckedChange={(checked) => {
              setHiddenColumns((prev) => {
                const next = new Set(prev);
                if (checked) next.delete(column.id);
                else next.add(column.id);
                // Never allow hiding every column — keep the last one visible.
                if (next.size >= columns.length) return prev;
                return next;
              });
            }}
          >
            {typeof column.header === "string" || typeof column.header === "number" ? column.header : column.id}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const exportMenu = exportName ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Export current view" title="Export current view">
          <Download className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export current view</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportView("csv")}>CSV (.csv)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportView("json")}>JSON (.json)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  const selectionCount = selection?.selected.size ?? 0;

  return (
    <>
      <Card className={cn("overflow-hidden", className)}>
        {(title || description || toolbar) && (
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
            <div className="space-y-1.5">
              {title && <CardTitle>{title}</CardTitle>}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {toolbar}
              <span className="flex items-center gap-0.5">
                {densityMenu}
                {columnMenu}
                {exportMenu}
              </span>
            </div>
          </CardHeader>
        )}
        <CardContent>
          {status === "error" ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-admin-border px-6 py-14 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" aria-hidden>
                <AlertTriangle className="size-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-admin-fg">Failed to load data</h3>
                <p className="mx-auto max-w-sm text-sm text-admin-muted-fg">{error || "Something went wrong. Try again."}</p>
              </div>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw /> Try again
                </Button>
              )}
            </div>
          ) : isEmpty ? (
            <EmptyState
              icon={empty?.icon ?? <Inbox className="size-6" />}
              title={empty?.title ?? "No records found"}
              description={empty?.description ?? "Adjust your filters or check back later."}
            />
          ) : (
            <div className={cn("space-y-4", DENSITY_ROW[density])}>
              <Table aria-label={ariaLabel}>
                <TableHeader
                  className={cn(
                    stickyHeader && "sticky top-0 z-10 bg-admin-surface/95 backdrop-blur-md shadow-[inset_0_-1px_0_var(--color-admin-border)]",
                  )}
                >
                  <TableRow className="hover:bg-transparent">
                    {selection && status === "success" && (
                      <TableHead className="w-9 pr-0">
                        <input
                          type="checkbox"
                          aria-label="Select all rows on this page"
                          className="size-4 accent-[var(--color-admin-primary)]"
                          checked={!!data?.length && data.every((row) => selection.selected.has(String(rowKey(row))))}
                          onChange={() => {
                            const rows = data ?? [];
                            const everyChecked = rows.every((row) => selection.selected.has(String(rowKey(row))));
                            for (const row of rows) {
                              const key = String(rowKey(row));
                              if (everyChecked === selection.selected.has(key)) selection.onToggle(key);
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    {visibleColumns.map((column) => (
                      <TableHead
                        key={column.id}
                        className={cn(column.align === "right" && "text-right", column.align === "center" && "text-center", column.headerClassName)}
                      >
                        {column.header}
                      </TableHead>
                    ))}
                    {rowActions && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status === "loading"
                    ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                        <TableRow key={rowIndex} aria-hidden>
                          {selection && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                          {columns.map((column) => (
                            <TableCell key={column.id}>
                              <Skeleton className="h-4" />
                            </TableCell>
                          ))}
                          {rowActions && (
                            <TableCell>
                              <Skeleton className="h-8 w-28" />
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    : allColumnsHidden
                      ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-8 text-center text-sm text-admin-muted-fg">
                            All columns are hidden — re-enable some from the columns menu.
                          </TableCell>
                        </TableRow>
                      )
                      : (data ?? []).map((row) => {
                          const key = String(rowKey(row));
                          const isSelected = selection?.selected.has(key) ?? false;
                          return (
                            <TableRow key={key} className={cn(isSelected && "bg-[var(--color-admin-primary)]/[0.06]")}>
                              {selection && (
                                <TableCell className="pr-0">
                                  <input
                                    type="checkbox"
                                    aria-label="Select row"
                                    className="size-4 accent-[var(--color-admin-primary)]"
                                    checked={isSelected}
                                    onChange={() => selection.onToggle(key)}
                                  />
                                </TableCell>
                              )}
                              {visibleColumns.map((column) => (
                                <TableCell key={column.id} className={cn(column.align === "right" && "text-right", column.align === "center" && "text-center", column.className)}>
                                  {column.cell(row)}
                                </TableCell>
                              ))}
                              {rowActions && (
                                <TableCell className="text-right">
                                  {rowActions(row)}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                </TableBody>
              </Table>
              {showPagination && pagination && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-admin-border pt-4 text-sm text-admin-muted-fg">
                  <span>
                    Page <b className="font-semibold text-admin-fg">{pagination.page}</b> of {pagination.pageCount} · {pagination.total} records
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => pagination.onPage(pagination.page - 1)}>
                      <ChevronLeft /> Prev
                    </Button>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pageCount} onClick={() => pagination.onPage(pagination.page + 1)}>
                      Next <ChevronRight />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating glass bulk-action dock — rises when 1+ rows are checked. */}
      {selection && selectionCount > 0 && status === "success" && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-admin-border bg-[rgba(11,17,32,0.88)] px-4 py-2.5 shadow-[0_24px_60px_-18px_rgba(2,6,16,0.8)] backdrop-blur-xl"
        >
          <span className="rsx-pill active">{selectionCount} selected</span>
          <span className="flex flex-wrap items-center gap-2">{selection.actions}</span>
          <Button variant="ghost" size="sm" onClick={selection.onClear} aria-label="Clear selection">
            <X className="size-3.5" /> Clear
          </Button>
        </div>
      )}
    </>
  );
}

/** Horizontal action cluster. Never vertically stack row actions — always one row. */
export function RowActions({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-row items-center justify-end gap-2", className)} {...props}>
      {children}
    </div>
  );
}

interface RowActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name + tooltip text. */
  label: string;
  destructive?: boolean;
}

/** Compact icon-only row action with a tooltip. Use inside <RowActions />. */
export function RowActionButton({ label, destructive, className, children, ...props }: RowActionButtonProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={cn("h-8 w-8", destructive && "text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950", className)}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
