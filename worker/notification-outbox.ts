import { randomUUID } from "node:crypto";
import { Worker } from "bullmq";
import { connection } from "../lib/queue";
import { q } from "../lib/db";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { claimNotificationOutbox, deliverNotificationOutbox } from "../lib/jobs-workflow/digests";
import { workflowFlagEnabled } from "../lib/jobs-workflow/flags";
import { assertQueueAllowlist, NOTIFICATION_OUTBOX_QUEUES, NotificationOutboxQueueMessage, parseQueueArgument } from "../lib/jobs-workflow/queues";
import { assertFakeTransportIsIsolated, createLocalNotificationTransport } from "../lib/jobs-workflow/local-sink";

const selected = parseQueueArgument(process.argv, NOTIFICATION_OUTBOX_QUEUES);
assertQueueAllowlist(selected, NOTIFICATION_OUTBOX_QUEUES);
const notificationTransport = process.env.NOTIFICATION_TRANSPORT?.trim() || "provider";
if (!new Set(["provider", "local_sink"]).has(notificationTransport)) throw new Error("unsupported_notification_transport");
if (notificationTransport === "local_sink") assertFakeTransportIsIsolated();
const owner = `notification-outbox:${process.pid}:${randomUUID()}`;
let worker: Worker | undefined;

function deliver(outboxId: string) {
  return notificationTransport === "local_sink"
    ? deliverNotificationOutbox(outboxId, createLocalNotificationTransport(outboxId))
    : deliverNotificationOutbox(outboxId);
}

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[notification-outbox] ${signal}; draining`);
  let clean = true;
  if (worker) {
    clean = await Promise.race([
      worker.close().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 60_000)),
    ]);
  }
  if (!clean) {
    console.error("[notification-outbox] drain timeout; forcing disconnect");
    void worker?.disconnect();
    connection.disconnect();
    process.exit(1);
  }
  await connection.quit().catch(() => connection.disconnect());
  process.exit(0);
}
async function main() {
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
  if (process.argv.includes("--once")) {
    const rows = await q<{ id: string }>(
      `select id from notification_outbox
       where status='pending' or (status='claimed' and lease_expires_at<=now())
       order by created_at limit 100`,
    );
    for (const row of rows) {
      if (!(await workflowFlagEnabled("jobs_daily_matches"))) break;
      if (await claimNotificationOutbox(row.id, owner, 90)) await deliver(row.id);
    }
    await stop("once complete");
    return;
  }
  worker = new Worker("notification-outbox", async (job) => {
    const payload = NotificationOutboxQueueMessage.parse(job.data);
    if (!(await workflowFlagEnabled("jobs_daily_matches"))) return { skipped: "disabled" };
    if (!(await claimNotificationOutbox(payload.outboxId, owner, 90))) return { skipped: true };
    return { status: await deliver(payload.outboxId) };
  }, { connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 1 });
  console.log("notification outbox worker up; queue=notification-outbox");
}

main().catch((error) => {
  console.error("[notification-outbox] startup_failed", error instanceof Error ? error.name : "unknown_error");
  process.exitCode = 1;
});
