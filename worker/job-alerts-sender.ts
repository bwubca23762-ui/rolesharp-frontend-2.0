import { processDueAlerts } from "../lib/job-alerts";

// Job Alerts sender. Runs as a cron or systemd timer on a schedule (e.g.
// every hour) and processes alerts whose frequency window has elapsed.
// The sub-cap in lib/job-alerts.ts prevents alert emails from starving
// transactional mail out of the daily budget.

async function tick() {
  const processed = await processDueAlerts();
  if (processed > 0) console.log(`[job-alerts] sent ${processed} alert${processed === 1 ? "" : "s"}`);
}

let running = true;

async function loop() {
  while (running) {
    try {
      await tick();
    } catch (error) {
      console.error("[job-alerts] tick failed:", error instanceof Error ? error.message : error);
    }
    // Sleep 30 minutes between ticks
    for (let i = 0; i < 1800 && running; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

process.on("SIGTERM", () => { running = false; });
process.on("SIGINT", () => { running = false; });

loop().catch((err) => {
  console.error("[job-alerts] fatal:", err);
  process.exit(1);
});
