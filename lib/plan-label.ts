// The one place the plan is turned into words. Every badge that reads the
// session goes through this, so a student account cannot read "Premium" on one
// surface and "Student" on another. The distinction is not cosmetic: students
// have their own allowance (STUDENT_MONTHLY_LIMIT), can spend credits past it
// when paid accounts cannot, and get their own win-back pricing.
//
// Structural param rather than SessionData: this is imported by client
// components and by the node suite, so it must not pull in app/session-context.
export function planLabel(session: { premium?: boolean; premiumSource?: string | null } | null | undefined) {
  if (!session?.premium) return "Free";
  return session.premiumSource === "student" ? "Student" : "Premium";
}
