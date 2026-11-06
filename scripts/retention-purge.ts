/**
 * Data retention purge — run daily via crontab on the VPS:
 *   40 3 * * * cd /opt/resume-ai/current && set -a && . /opt/resume-ai/.env && set +a && npx tsx scripts/retention-purge.ts >> /var/log/retention-purge.log 2>&1
 *
 * Every window below was already written down somewhere as a promise and then
 * never implemented: 019 says page_views keeps 90 days, 044 says product_events
 * keeps 60, and the seeded privacy policy (047) tells users in plain text that
 * "terminal notification-outbox transport metadata is purged after 30 days".
 * Nothing deleted anything. This script is what makes those sentences true.
 *
 * Deletes are batched rather than issued as one unbounded statement: page_views
 * is the highest-volume table here and a single DELETE over months of rows
 * holds one long transaction, blocks autovacuum, and bloats the table. Each
 * batch is its own transaction, so an interrupted run loses nothing and the
 * next night resumes where it stopped.
 */
import { q, hasDb } from "../lib/db";

if (!hasDb()) {
  console.error("retention-purge: No DATABASE_URL configured — aborting.");
  process.exit(1);
}

const BATCH = 5_000;
// A cap, not a target: it stops a first run over a large backlog from spending
// the whole night in one table. Whatever is left is collected tomorrow.
const MAX_BATCHES_PER_TABLE = 200;

/**
 * Delete rows matching `where` in batches, newest-safe: ctid is the physical
 * row pointer, so the subquery picks an arbitrary bounded set without needing
 * the table to have a sortable key. Returns the number of rows removed.
 */
async function purge(table: string, where: string, label: string): Promise<number> {
  let total = 0;
  for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
    const deleted = await q<{ id: string }>(
      `delete from ${table}
       where ctid = any (array(
         select ctid from ${table} where ${where} limit ${BATCH}
       ))
       returning ctid::text as id`,
    );
    total += deleted.length;
    if (deleted.length < BATCH) return total;
  }
  console.warn(`[${label}] hit the ${MAX_BATCHES_PER_TABLE}-batch cap with rows still pending; next run continues`);
  return total;
}

async function main() {
  const results: Record<string, number> = {};
  const run = async (label: string, table: string, where: string) => {
    try {
      results[label] = await purge(table, where, label);
      console.log(`[${label}] purged ${results[label]}`);
    } catch (e) {
      // One unpurgeable table must not stop the rest: a missing table on an
      // older schema is not a reason to keep every other promise unkept.
      results[label] = -1;
      console.error(`[${label}] FAILED:`, e instanceof Error ? e.message : e);
    }
  };

  // 019_traffic_analytics.sql: "keep 90 days of raw data, delete older".
  await run("page_views", "page_views", "created_at < now() - interval '90 days'");

  // 044_privacy_safe_product_events.sql: "may delete rows older than 60 days".
  await run("product_events", "product_events", "created_at < now() - interval '60 days'");

  // 032/050 set purge_after = terminal_at + 30 days when a row reaches a
  // terminal state. The column existed and was populated; nothing read it.
  // This is the row the privacy policy names explicitly.
  await run("notification_outbox", "notification_outbox", "purge_after is not null and purge_after < now()");
  await run("communication_recipients", "communication_recipients", "purge_after is not null and purge_after < now()");

  // email_log holds recipient address + subject with no user link, so account
  // deletion could never reach it (lib/db.ts now deletes by address as well).
  // 90 days is the deliverability-debugging window; nothing reads it older.
  await run("email_log", "email_log", "created_at < now() - interval '90 days'");

  // ipn_quarantine bodies carry payout addresses. The table exists so a wrong
  // IPN secret stays recoverable, so this window is deliberately the longest
  // one here: a NOWPayments order six months stale cannot be replayed into a
  // useful grant anyway, and holding payment data past that point is cost with
  // no recovery upside. Successful replays already delete their own row.
  await run("ipn_quarantine", "ipn_quarantine", "received_at < now() - interval '180 days'");

  // A revocation only has to outlive the token it revokes. Past expires_at the
  // token fails its own exp check, so the row stops meaning anything.
  await run("revoked_sessions", "revoked_sessions", "expires_at < now()");

  const failed = Object.entries(results).filter(([, n]) => n === -1).map(([k]) => k);
  console.log(`retention-purge done: ${Object.entries(results).filter(([, n]) => n >= 0).map(([k, n]) => `${k}=${n}`).join(" ")}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error("retention-purge fatal:", e); process.exit(1); });
