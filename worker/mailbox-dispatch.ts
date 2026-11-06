import { Worker } from "bullmq";
import { connection } from "../lib/queue";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { assertQueueAllowlist, MAILBOX_DISPATCH_QUEUES, MailboxDispatchQueueMessage, parseQueueArgument } from "../lib/jobs-workflow/queues";
import { q } from "../lib/db";
import { dispatchApplicationAttempt } from "../lib/mail/dispatch";
import { assertFakeTransportIsIsolated, createFakeMailboxFetch } from "../lib/jobs-workflow/local-sink";

const selected = parseQueueArgument(process.argv, MAILBOX_DISPATCH_QUEUES);
assertQueueAllowlist(selected, MAILBOX_DISPATCH_QUEUES);
const mailAdapter = process.env.MAIL_ADAPTER?.trim() || "provider";
if (!new Set(["provider", "fake"]).has(mailAdapter)) throw new Error("unsupported_mail_adapter");
if (mailAdapter === "fake") assertFakeTransportIsIsolated();
let worker: Worker | undefined;

function dispatch(attemptId: string) {
  return mailAdapter === "fake"
    ? dispatchApplicationAttempt(attemptId, createFakeMailboxFetch(attemptId))
    : dispatchApplicationAttempt(attemptId);
}

let stopping = false;
async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[mailbox-dispatch] ${signal}; draining`);
  let clean = true;
  if (worker) {
    clean = await Promise.race([
      worker.close().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 60_000)),
    ]);
  }
  if (!clean) {
    console.error("[mailbox-dispatch] drain timeout; forcing disconnect");
    void worker?.disconnect();
    connection.disconnect();
    process.exit(1);
  }
  await connection.quit().catch(() => connection.disconnect());
  process.exit(0);
}
async function main() {
  if (!jobsWorkflowConfig().workflowsEnabled) throw new Error("jobs_workflows_disabled");
  process.on("SIGTERM", () => void stop("SIGTERM"));
  process.on("SIGINT", () => void stop("SIGINT"));
  if (process.argv.includes("--once")) {
    const attempts = await q<{ id: string }>(
      `select a.id from application_mail_attempts a
       where a.status='queued' or (a.status='retryable' and coalesce((
         select max(i.not_before) from application_mail_invocations i where i.attempt_id=a.id
       ),now())<=now()) order by a.created_at limit 100`,
    );
    for (const attempt of attempts) await dispatch(attempt.id);
    await stop("once complete");
    return;
  }
  worker = new Worker("mailbox-dispatch", async (job) => {
    const payload = MailboxDispatchQueueMessage.parse(job.data);
    return dispatch(payload.attemptId);
  }, { connection, prefix: jobsWorkflowConfig().queuePrefix, concurrency: 1 });
  console.log("mailbox dispatch worker up; queue=mailbox-dispatch");
}

main().catch((error) => {
  console.error("[mailbox-dispatch] startup_failed", error instanceof Error ? error.name : "unknown_error");
  process.exitCode = 1;
});
