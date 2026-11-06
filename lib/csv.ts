export function csvCell(value: unknown) {
  const raw = value == null ? "" : typeof value === "object" ? (JSON.stringify(value) ?? String(value)) : String(value);
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
