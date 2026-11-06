import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { q } from "../lib/db";
import { connection } from "../lib/queue";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { claimWorkItemById, completeWorkItem, failWorkItem, heartbeatWorkItem, type WorkItemKind } from "../lib/jobs-workflow/claims";
import { prepareDailyDigest } from "../lib/jobs-workflow/digests";
import { workflowFlagEnabled } from "../lib/jobs-workflow/flags";
import { materializeCampaignMatches } from "../lib/jobs-workflow/matches";
import { prepareApplicationPackage } from "../lib/jobs-workflow/packages";
import { assertQueueAllowlist, JOBS_WORKFLOW_QUEUES, parseQueueArgument, WorkflowQueueMessage, type JobsWorkflowQueueName } from "../lib/jobs-workflow/queues";

const kindByQueue = {
  "jobs-match": "jobs_match",
  "jobs-digest": "jobs_digest",
  "application-package": "application_package",
} as const satisfies Record<JobsWorkflowQueueName, WorkItemKind>;

const selected = parseQueueArgument(process.argv, JOBS_WORKFLOW_QUEUES);
assertQueueAllowlist(selected, JOBS_WORKFLOW_QUEUES);
const owner = `jobs-workflow:${process.pid}:${randomUUID()}`;

async function boundaryEnabled(workItemId: string, kind: WorkItemKind): Promise<boolean> {
  if (kind === "jobs_digest") return workflowFlagEnabled("jobs_daily_matches");
  if (kind === "application_package") return workflowFlagEnabled("role_apply_prepare");
  const mode = (await q<{ mode: string }>(
    `select c.mode from job_work_items w join job_campaigns c on c.id=w.aggregate_id
     where w.id=$1 and w.kind='jobs_match'`, [workItemId],
  ))[0]?.mode;
  return mode === "daily_matches"
    ? workflowFlagEnabled("jobs_daily_matches")
    : mode === "role_apply" ? workflowFlagEnabled("role_apply_prepare") : false;
}

async function processPayload(queueName: JobsWorkflowQueueName, value: unknown) {
  const payload = WorkflowQueueMessage.parse(value);
  const kind = kindByQueue[queueName];
  if (!(await boundaryEnabled(payload.workItemId, kind))) return { skipped: "disabled" };
  const item = await claimWorkItemById({
    id: payload.workItemId, expectedKind: kind, expectedVersion: payload.version, owner, leaseSeconds: 90,
  });
  if (!item) return { skipped: "not_claimable" };
  const heartbeat = setInterval(() => void heartbeatWorkItem(item.id, owner, 90), 30_000);
  try {
    let resultReferenceId: string | undefined;
    if (kind === "jobs_match") await materializeCampaignMatches(item.aggregateId);
    if (kind === "jobs_digest") resultReferenceId = (await prepareDailyDigest(item.aggregateId)).digestId ?? undefined;
    if (kind === "application_package") resultReferenceId = (await prepareApplicationPackage(item.aggregateId)).packageId ?? undefined;
    await completeWorkItem({ id: item.id, owner, resultReferenceId });
    return { completed: item.id };
  } catch (error) {
    const category = error instanceof Error && /^[a-z0-9_.-]{1,80}$/iu.test(error.message)
      ? error.message.toLocaleLowerCase("en") : "workflow_processing_failed";
    await failWorkItem({ id: item.id, owner, category, outcome: "retryable", retryDelaySeconds: 30 });
    return { retryable: item.id, category };
  } finally {
    clearInterval(heartbeat);
  }
}

let workers: Worker[] = [];

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[jobs-workflow] ${signal}; draining`);
  const drain = Promise.all(workers.map((worker) => worker.close()));
  await Promise.race([drain, new Promise((resolve) => setTimeout(resolve, 60_000))]);
  await connection.quit().catch(() => connection.disconnect());
  process.exit(0);
}
async function main() {
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
  if (process.argv.includes("--once")) {
    const items = await q<{ id: string; kind: WorkItemKind }>(
      `select id,kind from job_work_items where status in ('pending','retryable')
       and available_at<=now() order by created_at limit 100`,
    );
    for (const item of items) {
      const queueName = (Object.entries(kindByQueue).find(([, kind]) => kind === item.kind)?.[0]) as JobsWorkflowQueueName | undefined;
      if (queueName && selected.includes(queueName)) await processPayload(queueName, { workItemId: item.id, version: 1 });
    }
    await stop("once complete");
    return;
  }
  workers = selected.map((queueName) => new Worker(
    queueName,
    (job: Job) => processPayload(queueName as JobsWorkflowQueueName, job.data),
    { connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 2 },
  ));
  console.log(`jobs workflow worker up; queues=${selected.join(",")}`);
}

main().catch((error) => {
  console.error("[jobs-workflow] startup_failed", error instanceof Error ? error.name : "unknown_error");
  process.exitCode = 1;
});
