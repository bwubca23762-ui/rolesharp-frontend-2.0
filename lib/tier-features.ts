// What each tier can DO, not just how much it gets. One map so every gate in
// the app answers the same question the same way — a route that needs to know
// whether DOCX is allowed asks this, never re-derives it from premiumSource.
// Client-safe on purpose: no server imports here, so admin views and client
// components can render the matrix from the same source the server enforces.
//
//   - Platform Premium (paid/admin): the career cockpit — DOCX, tool history,
//     Cover Letter 2.0, full-market Daily Matches.
//   - Student Premium: build-and-learn — the generators and a student-filtered
//     Daily Matches, but none of the cockpit artifacts, so the paid tier still
//     has a concrete upgrade trigger.
//   - Auto-Apply is false everywhere today: it is reserved for the future
//     one-time Job Search Pack (premiumSource "pack"), so no current tier
//     cannibalizes that SKU.

export type TierFeatures = {
  docxExport: boolean;
  toolHistory: boolean;
  coverLetterAI: boolean;
  dailyMatches: "none" | "student" | "full";
  autoApply: boolean;
  cleanPdf: boolean;
};

export function featuresFor(premiumSource: string | null | undefined, premium: boolean): TierFeatures {
  if (!premium) {
    return { docxExport: false, toolHistory: false, coverLetterAI: false, dailyMatches: "none", autoApply: false, cleanPdf: false };
  }
  if (premiumSource === "student") {
    return { docxExport: false, toolHistory: false, coverLetterAI: true, dailyMatches: "student", autoApply: false, cleanPdf: true };
  }
  return { docxExport: true, toolHistory: true, coverLetterAI: true, dailyMatches: "full", autoApply: false, cleanPdf: true };
}

/** The tier columns of the admin matrix, in display order. */
export const TIER_COLUMNS: { id: string; label: string; source: string | null; premium: boolean }[] = [
  { id: "free", label: "Free", source: null, premium: false },
  { id: "student", label: "Student", source: "student", premium: true },
  { id: "premium", label: "Premium", source: "paid", premium: true },
];

/** The function rows of the admin matrix, in display order. `planned` rows
 * have flags in the map but NO implementing route yet — the matrix renders
 * them as "Planned" so the console never advertises a ✓ for vapor. */
export const FEATURE_ROWS: { key: keyof TierFeatures; label: string; hint: string; planned?: boolean }[] = [
  { key: "cleanPdf", label: "Clean PDF export", hint: "Download without the free watermark" },
  { key: "docxExport", label: "DOCX export", hint: "Word files for portals that require them — including generator output (E3)" },
  { key: "toolHistory", label: "Tool-run history", hint: "ATS checks and generator runs saved to the account trail, shown on the dashboard" },
  { key: "coverLetterAI", label: "Cover Letter 2.0", hint: "AI letters grounded in the resume and the job description" },
  { key: "dailyMatches", label: "Daily Matches", hint: "Emailed job matches — student tier sees internships and entry-level only" },
  { key: "autoApply", label: "Auto-Apply", hint: "Reserved for the one-time Job Search Pack — not part of any subscription tier" },
];
