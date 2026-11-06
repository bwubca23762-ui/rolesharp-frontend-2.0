import { q } from "./db";
import { hasDb } from "./db/core";
import { currentUser } from "./auth";
import { getEntitlement } from "./entitlements";
import type { ToolRun } from "./tool-runs";

// ── Tool-run history, server half (Platform Premium) ──
// The visible answer to "what does Premium give me on the tools": every run a
// premium account makes is recorded with its outcome, and the dashboard lists
// the trail. Recording is fire-and-forget — history must never make a tool
// slower or fail a run that already succeeded.

/**
 * Resolve the caller's history eligibility from the session cookies. Returns
 * null for anonymous and free accounts — the tools stay fully usable
 * logged-out; history is a Premium perk layered on top, never a gate. Never
 * throws.
 */
export async function historyUserIdFromRequest(): Promise<string | null> {
  try {
    const user = await currentUser();
    if (!user) return null;
    return (await getEntitlement(user)).features.toolHistory ? user.id : null;
  } catch {
    return null;
  }
}

/** Never await me in the request path — log-and-drop on failure. */
export function recordToolRun(userId: string, tool: string, data: { score?: number | null; summary?: string | null } = {}): void {
  if (!hasDb()) return;
  const summary = data.summary?.slice(0, 160) ?? null;
  const score = typeof data.score === "number" && Number.isFinite(data.score) ? Math.round(data.score) : null;
  q(
    "insert into tool_runs (user_id, tool, score, summary) values ($1, $2, $3, $4)",
    [userId, tool, score, summary],
  ).catch((error) => console.error("[tool-runs] record failed", error));
}

/** The premium account's own trail, newest first. */
export async function listToolRuns(userId: string, limit = 25): Promise<ToolRun[]> {
  if (!hasDb()) return [];
  return q<ToolRun>(
    "select tool, score, summary, created_at from tool_runs where user_id = $1 order by created_at desc limit $2",
    [userId, Math.min(100, Math.max(1, limit))],
  );
}
