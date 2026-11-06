import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { listApplications, listUserTickets } from "@/lib/db";
import { listCampaigns } from "@/lib/jobs-workflow/campaigns";
import { listJobMatches } from "@/lib/jobs-workflow/matches";
import { listApplicationPackages } from "@/lib/jobs-workflow/packages";
import { listApplicationAttempts } from "@/lib/mail/dispatch";
import { listMailboxConnections } from "@/lib/mail/connections";

export const runtime = "nodejs";

/**
 * One request for the whole dashboard snapshot.
 *
 * WorkspaceOverview used to fan out to seven endpoints in parallel on every
 * load. Each was a separate HTTP round trip that re-ran currentUser() and then
 * took its own connection from a pool of ten — so a single dashboard open
 * could occupy most of the pool, and two users landing together could exhaust
 * it. The seven GET handlers are thin: authenticate, then one list call scoped
 * by user.id. Doing that once here is the same work with one auth check and
 * one pool checkout.
 *
 * allSettled, not all: the client's per-source degradation is the good part of
 * this screen and must survive the batching. One failing source names itself in
 * `unavailable` and the rest of the dashboard still renders, exactly as before.
 * Promise.all would have converted any single failure into a blank page.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const sources = [
    ["applications", () => listApplications(user.id, { limit: 100 }).then((r) => r.applications)],
    ["campaigns", () => listCampaigns(user.id)],
    ["matches", () => listJobMatches({ userId: user.id, status: "eligible", limit: 50 }).then((r) => r.matches)],
    ["packages", () => listApplicationPackages(user.id, 50)],
    ["attempts", () => listApplicationAttempts(user.id, 100)],
    ["connections", () => listMailboxConnections(user.id)],
    ["tickets", () => listUserTickets(user.id)],
  ] as const;

  const settled = await Promise.allSettled(sources.map(([, read]) => read()));

  const payload: Record<string, unknown> = {};
  const unavailable: string[] = [];
  settled.forEach((result, index) => {
    const key = sources[index][0];
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      payload[key] = result.value;
      return;
    }
    // null, not [] — the client distinguishes "this source is down" from "you
    // have none of these", and rendering an empty state for an outage is the
    // failure mode this whole screen was built to avoid.
    payload[key] = null;
    unavailable.push(key);
    if (result.status === "rejected") {
      console.error(`[workspace-overview] ${key}:`, result.reason instanceof Error ? result.reason.message : result.reason);
    }
  });

  return NextResponse.json({ ...payload, unavailable }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
