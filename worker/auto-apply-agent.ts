import { randomUUID } from "node:crypto";
import { Worker, type Job } from "bullmq";
import { q } from "../lib/db";
import { connection } from "../lib/queue";
import { claimWorkItemById, completeWorkItem, failWorkItem, heartbeatWorkItem } from "../lib/jobs-workflow/claims";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { workflowFlagEnabled } from "../lib/jobs-workflow/flags";
import { assertFakeTransportIsIsolated, createFakeMailboxFetch } from "../lib/jobs-workflow/local-sink";
import { prepareApplicationPackage } from "../lib/jobs-workflow/packages";
import { MailboxDispatchQueueMessage, WorkflowQueueMessage } from "../lib/jobs-workflow/queues";
import { dispatchApplicationAttempt } from "../lib/mail/dispatch";

const owner = `auto-apply-agent:${process.pid}:${randomUUID()}`;
const mailAdapter = process.env.MAIL_ADAPTER?.trim() || "provider";
if (!new Set(["provider", "fake"]).has(mailAdapter)) throw new Error("unsupported_mail_adapter");
if (mailAdapter === "fake") assertFakeTransportIsIsolated();

let workers: Worker[] = [];
let idleTimer: NodeJS.Timeout | undefined;
let stopping = false;

function event(level: "info" | "error", name: string, fields: Record<string, unknown> = {}) {
  const record = JSON.stringify({ level, service: "auto-apply-agent", event: name, ...fields });
  if (level === "error") console.error(record); else console.log(record);
}

async function processPackage(value: unknown) {
  const payload = WorkflowQueueMessage.parse(value);
  if (!(await workflowFlagEnabled("role_apply_prepare"))) return { skipped: "disabled" };
  const item = await claimWorkItemById({
    id: payload.workItemId,
    expectedKind: "application_package",
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
    const resultReferenceId = (await prepareApplicationPackage(item.aggregateId)).packageId ?? undefined;
    if (leaseLost) throw new Error("workflow_lease_lost");
    const completed = await completeWorkItem({ id: item.id, owner, resultReferenceId });
    if (!completed) throw new Error("workflow_completion_ownership_lost");
    event("info", "package_completed", { workItemId: item.id, hasPackage: Boolean(resultReferenceId) });
    return { completed: item.id };
  } catch (error) {
    const category = error instanceof Error && /^[a-z0-9_.-]{1,80}$/iu.test(error.message)
      ? error.message.toLocaleLowerCase("en") : "application_package_failed";
    const failed = await failWorkItem({
      id: item.id, owner, category, outcome: "retryable", retryDelaySeconds: 30,
    });
    if (!failed) {
      event("error", "package_failure_ownership_lost", { workItemId: item.id, category });
      throw error;
    }
    event("error", "package_retryable", { workItemId: item.id, category });
    return { retryable: item.id, category };
  } finally {
    clearInterval(heartbeat);
  }
}

function dispatch(attemptId: string) {
  return mailAdapter === "fake"
    ? dispatchApplicationAttempt(attemptId, createFakeMailboxFetch(attemptId))
    : dispatchApplicationAttempt(attemptId);
}

async function processMailbox(value: unknown) {
  const payload = MailboxDispatchQueueMessage.parse(value);
  const status = await dispatch(payload.attemptId);
  event(status === "provider_accepted" ? "info" : "error", "mailbox_dispatch", {
    attemptId: payload.attemptId, status,
  });
  return { status };
}

async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  if (idleTimer) clearInterval(idleTimer);
  event("info", "draining", { signal });
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
  const items = await q<{ id: string }>(
    `select id from job_work_items where kind='application_package'
     and status in ('pending','retryable') and available_at<=now() order by created_at limit 100`,
  );
  for (const item of items) await processPackage({ workItemId: item.id, version: 1 });
  const attempts = await q<{ id: string }>(
    `select id from application_mail_attempts where status='queued'
     or (status='retryable' and retry_not_before<=now()) order by created_at limit 100`,
  );
  for (const attempt of attempts) await processMailbox({ attemptId: attempt.id, version: 1 });
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
    // Idle, do not exit. Throwing here made the unit exit 1, which systemd marks
    // failed -- and "workflows disabled" is the NORMAL production state, asserted
    // by deploy.sh's own preflight. So every deploy failed its activation check
    // on this unit and rolled the whole release back, and the admin health view
    // showed the agent down. Constructing no Worker is what makes this safe: no
    // queue is consumed and no mail can be sent while the flag is off.
    event("info", "idle", { reason: "jobs_workflows_disabled", queues: [] });
    idleTimer = setInterval(() => {}, 60_000);
    return;
  }
  workers = [
    new Worker("application-package", (job: Job) => processPackage(job.data), {
      connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 2,
    }),
    new Worker("mailbox-dispatch", (job: Job) => processMailbox(job.data), {
      connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 1,
    }),
  ];
  event("info", "started", { queues: ["application-package", "mailbox-dispatch"] });
}

main().catch((error) => {
  // Name alone ("Error") does not say which of the config, queue or connection
  // steps failed, and this exit code is what fails deploy.sh's activation check
  // and rolls back the whole release. Log enough to act on.
  event("error", "startup_failed", {
    category: error instanceof Error ? error.name : "unknown_error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exitCode = 1;
});
