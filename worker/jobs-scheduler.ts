import { connection } from "../lib/queue";
import { scheduleDueWorkflowItems } from "../lib/jobs-workflow/scheduler";
import { submitToIndexNow } from "../lib/indexnow";
import { env } from "../lib/env";
import { q } from "../lib/db";

let stopping = false;

// Real-time indexing for the public jobs surface: after each tick, ping
// IndexNow for the country job-listing pages whose underlying listings were
// re-seen by the ingestor within the last interval (~fresh ingestion). The
// scheduler runs every 60s, so a country only pings while its data is
// actually moving, and dedup comes free: a quiet market emits nothing.
// Fire-and-log — an indexing ping must never fail scheduling.
async function pingFreshJobMarkets() {
  try {
    const base = env.siteUrl;
    const rows = await q<{ country_code: string }>(
      `select distinct lower(country_code) as country_code
       from jobs
       where last_seen_at > now() - interval '90 seconds'
         and expires_at > now()`,
    );
    if (!rows.length) return;
    const urls = rows.map((row) => `${base}/jobs/${row.country_code}`);
    const ping = await submitToIndexNow(urls);
    if (ping.ok) console.log(`[jobs-scheduler] indexnow markets=${urls.length}`);
  } catch (error) {
    console.warn(`[jobs-scheduler] indexnow ping skipped: ${error instanceof Error ? error.name : "unknown"}`);
  }
}

async function tick() {
  if (stopping) return;
  try {
    const scheduled = await scheduleDueWorkflowItems();
    if (scheduled > 0) console.log(`[jobs-scheduler] scheduled=${scheduled}`);
    await pingFreshJobMarkets();
  } catch (error) {
    const code = error instanceof Error ? error.name : "scheduler_error";
    console.error(`[jobs-scheduler] ${code}`);
  }
}

async function stop() {
  if (stopping) return;
  stopping = true;
  await connection.quit().catch(() => connection.disconnect());
  process.exit(0);
}

async function main() {
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  await tick();
  if (process.argv.includes("--once")) {
    await stop();
    return;
  }
  // Keep the scheduler alive between ticks. systemd supervises this process;
  // an unref'ed timer lets Node exit and creates a restart loop while flags are off.
  setInterval(tick, 60_000);
  console.log("jobs scheduler up; scheduling only (no queue consumers)");
}

main().catch((error) => {
  console.error("[jobs-scheduler] startup_failed", error instanceof Error ? error.name : "unknown_error");
  process.exitCode = 1;
});
