// One escaper for every HTML we generate (transactional email, contact
// forwarding, digests). Three near-copies existed and they did not agree:
// lib/invoice-email.ts left `'` unescaped, which is an injection vector in any
// single-quoted attribute, and invoice emails interpolate user-controlled
// names and payment references. This is the strict form — escape all five.
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character] ?? character);
}
