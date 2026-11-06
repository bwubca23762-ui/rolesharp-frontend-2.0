"use client";

/**
 * A sortable column header.
 *
 * No table in the admin panel had one, and none carried `aria-sort`, so the
 * sort state of a list was not conveyed to assistive technology because there
 * was no sort state at all.
 *
 * The button inside the <th> is what makes this keyboard-operable; putting the
 * handler on the <th> itself would repeat the mouse-only mistake the version
 * tables made. `aria-sort` stays on the <th>, which is where the ARIA table
 * pattern expects it.
 */
export type SortState = { column: string; dir: "asc" | "desc" };

export function SortableHeader({
  column,
  label,
  sort,
  onSort,
  numeric = false,
}: {
  column: string;
  label: string;
  sort: SortState;
  onSort: (next: SortState) => void;
  numeric?: boolean;
}) {
  const active = sort.column === column;
  return (
    <th
      className={numeric ? "num-col" : undefined}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="admin-sort-button"
        // Re-clicking the active column flips direction; a new column starts
        // descending, which is what someone sorting by "credits" or "joined"
        // almost always means first.
        onClick={() => onSort({ column, dir: active && sort.dir === "desc" ? "asc" : "desc" })}
      >
        {label}
        <span aria-hidden="true">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
