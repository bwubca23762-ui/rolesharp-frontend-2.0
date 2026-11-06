import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { q } from "../lib/db";
import { connection } from "../lib/queue";
import { claimWorkItemById, completeWorkItem, failWorkItem, heartbeatWorkItem } from "../lib/jobs-workflow/claims";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { claimNotificationOutbox, deliverNotificationOutbox, prepareDailyDigest } from "../lib/jobs-workflow/digests";
import { workflowFlagEnabled } from "../lib/jobs-workflow/flags";
import { materializeCampaignMatches } from "../lib/jobs-workflow/matches";
import {
  NotificationOutboxQueueMessage,
  WorkflowQueueMessage,
} from "../lib/jobs-workflow/queues";
import { scheduleDueWorkflowItems } from "../lib/jobs-workflow/scheduler";
import { assertFakeTransportIsIsolated, createLocalNotificationTransport } from "../lib/jobs-workflow/local-sink";

const owner = `recommendation-agent:${process.pid}:${randomUUID()}`;
const notificationTransport = process.env.NOTIFICATION_TRANSPORT?.trim() || "provider";
if (!new Set(["provider", "local_sink"]).has(notificationTransport)) {
  throw new Error("unsupported_notification_transport");
}
if (notificationTransport === "local_sink") assertFakeTransportIsIsolated();

let workers: Worker[] = [];
let scheduler: NodeJS.Timeout | undefined;
let tickInFlight: Promise<void> | null = null;
let stopping = false;

function event(level: "info" | "error", name: string, fields: Record<string, unknown> = {}) {
  const record = JSON.stringify({ level, service: "recommendation-agent", event: name, ...fields });
  if (level === "error") console.error(record); else console.log(record);
}

async function tick() {
  if (stopping || tickInFlight) return tickInFlight ?? Promise.resolve();
  tickInFlight = (async () => {
    const startedAt = Date.now();
    try {
      const scheduled = await scheduleDueWorkflowItems();
      event("info", "scheduler_tick", { scheduled, durationMs: Date.now() - startedAt });
    } catch (error) {
      event("error", "scheduler_tick_failed", {
        category: error instanceof Error ? error.name : "scheduler_error",
        durationMs: Date.now() - startedAt,
      });
    } finally {
      tickInFlight = null;
    }
  })();
  return tickInFlight;
}

async function processWorkflow(queueName: "jobs-match" | "jobs-digest", value: unknown) {
  const payload = WorkflowQueueMessage.parse(value);
  const kind = queueName === "jobs-match" ? "jobs_match" : "jobs_digest";
  if (!(await workflowFlagEnabled("jobs_daily_matches"))) return { skipped: "disabled" };
  const item = await claimWorkItemById({
    id: payload.workItemId,
    expectedKind: kind,
    expectedVersion: payload.version,
    owner,
    leaseSeconds: 90,
  });
  if (!item) return { skipped: "not_claimable" };

  let leaseLost = false;
  const heartbeat = setInterval(() => {
    void heartbeatWorkItem(item.id, owner, 90)
      .then((owned) => { if (!owned) leaseLost = true; })
      .catch(() => { leaseLost = true; });
  }, 30_000);

  try {
    let resultReferenceId: string | undefined;
    if (kind === "jobs_match") await materializeCampaignMatches(item.aggregateId);
    else resultReferenceId = (await prepareDailyDigest(item.aggregateId)).digestId ?? undefined;
    if (leaseLost) throw new Error("workflow_lease_lost");
    const completed = await completeWorkItem({ id: item.id, owner, resultReferenceId });
    if (!completed) throw new Error("workflow_completion_ownership_lost");
    event("info", "workflow_completed", { queue: queueName, workItemId: item.id });
    return { completed: item.id };
  } catch (error) {
    const category = error instanceof Error && /^[a-z0-9_.-]{1,80}$/iu.test(error.message)
      ? error.message.toLocaleLowerCase("en") : "workflow_processing_failed";
    const failed = await failWorkItem({
      id: item.id, owner, category, outcome: "retryable", retryDelaySeconds: 30,
    });
    if (!failed) {
      event("error", "workflow_failure_ownership_lost", { queue: queueName, workItemId: item.id, category });
      throw error;
    }
    event("error", "workflow_retryable", { queue: queueName, workItemId: item.id, category });
    return { retryable: item.id, category };
  } finally {
    clearInterval(heartbeat);
  }
}

function deliver(outboxId: string) {
  return notificationTransport === "local_sink"
    ? deliverNotificationOutbox(outboxId, createLocalNotificationTransport(outboxId))
    : deliverNotificationOutbox(outboxId);
}

async function processOutbox(value: unknown) {
  const payload = NotificationOutboxQueueMessage.parse(value);
  if (!(await workflowFlagEnabled("jobs_daily_matches"))) return { skipped: "disabled" };
  if (!(await claimNotificationOutbox(payload.outboxId, owner, 90))) return { skipped: "not_claimable" };
  const status = await deliver(payload.outboxId);
  event(status === "provider_accepted" ? "info" : "error", "digest_delivery", {
    outboxId: payload.outboxId, status,
  });
  return { status };
}

async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  if (scheduler) clearInterval(scheduler);
  event("info", "draining", { signal });
  await tickInFlight?.catch(() => undefined);
  const clean = await Promise.race([
    Promise.all(workers.map((worker) => worker.close())).then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 75_000)),
  ]);
  if (!clean) {
    event("error", "drain_timeout");
    workers.forEach((worker) => worker.disconnect());
    connection.disconnect();
    process.exitCode = 1;
    return;
  }
  await connection.quit().catch(() => connection.disconnect());
}

async function runOnce() {
  await tick();
  const items = await q<{ id: string; kind: "jobs_match" | "jobs_digest" }>(
    `select id,kind from job_work_items where kind in ('jobs_match','jobs_digest')
     and status in ('pending','retryable') and available_at<=now() order by created_at limit 100`,
  );
  for (const item of items) {
    await processWorkflow(item.kind === "jobs_match" ? "jobs-match" : "jobs-digest", {
      workItemId: item.id, version: 1,
    });
  }
  const outbox = await q<{ id: string }>(
    `select id from notification_outbox where status='pending'
     or (status='claimed' and lease_expires_at<=now()) order by created_at limit 100`,
  );
  for (const row of outbox) await processOutbox({ outboxId: row.id, version: 1 });
}

async function main() {
  const { workflowsEnabled } = jobsWorkflowConfig();
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
  if (process.argv.includes("--once")) {
    if (workflowsEnabled) await runOnce();
    else event("info", "idle", { reason: "jobs_workflows_disabled" });
    await stop("once_complete");
    return;
  }
  if (!workflowsEnabled) {
    // Matches auto-apply-agent. This one had no flag check at all, so with
    // workflows off it still attached three queue consumers and ran the scheduler
    // tick every 60s -- the opposite failure to auto-apply's, and the less
    // obvious one. Idle here consumes nothing and schedules nothing.
    event("info", "idle", { reason: "jobs_workflows_disabled", queues: [] });
    scheduler = setInterval(() => {}, 60_000);
    return;
  }
  workers = [
    new Worker("jobs-match", (job: Job) => processWorkflow("jobs-match", job.data), {
      connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 2,
    }),
    new Worker("jobs-digest", (job: Job) => processWorkflow("jobs-digest", job.data), {
      connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 2,
    }),
    new Worker("notification-outbox", (job: Job) => processOutbox(job.data), {
      connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 1,
    }),
  ];
  await tick();
  scheduler = setInterval(() => void tick(), 60_000);
  event("info", "started", { queues: ["jobs-match", "jobs-digest", "notification-outbox"] });
}

main().catch((error) => {
  event("error", "startup_failed", {
    category: error instanceof Error ? error.name : "unknown_error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
