import { Queue } from "bullmq";
import { z } from "zod";
import { connection } from "../queue";
import { jobsWorkflowConfig } from "./config";

export const JOBS_WORKFLOW_QUEUES = ["jobs-match", "jobs-digest", "application-package"] as const;
export const BLOG_GENERATION_QUEUES = ["blog-generation"] as const;
export const MAILBOX_DISPATCH_QUEUES = ["mailbox-dispatch"] as const;
export const NOTIFICATION_OUTBOX_QUEUES = ["notification-outbox"] as const;
export const ALL_JOB_QUEUE_NAMES = [
  ...JOBS_WORKFLOW_QUEUES,
  ...BLOG_GENERATION_QUEUES,
  ...MAILBOX_DISPATCH_QUEUES,
  ...NOTIFICATION_OUTBOX_QUEUES,
] as const;

export type JobsWorkflowQueueName = (typeof JOBS_WORKFLOW_QUEUES)[number];
export type JobQueueName = (typeof ALL_JOB_QUEUE_NAMES)[number];

const Version = z.literal(1);
export const WorkflowQueueMessage = z.object({ workItemId: z.string().uuid(), version: Version }).strict();
export const MailboxDispatchQueueMessage = z.object({ attemptId: z.string().uuid(), version: Version }).strict();
export const NotificationOutboxQueueMessage = z.object({ outboxId: z.string().uuid(), version: Version }).strict();
export const BlogGenerationQueueMessage = z.object({ generationJobId: z.string().uuid(), version: Version }).strict();

export type WorkflowQueuePayload = z.infer<typeof WorkflowQueueMessage>;
export type MailboxDispatchQueuePayload = z.infer<typeof MailboxDispatchQueueMessage>;
export type NotificationOutboxQueuePayload = z.infer<typeof NotificationOutboxQueueMessage>;
export type BlogGenerationQueuePayload = z.infer<typeof BlogGenerationQueueMessage>;

const queueInstances = new Map<JobQueueName, Queue>();
export function workflowQueue(name: JobQueueName): Queue {
  let queue = queueInstances.get(name);
  if (!queue) {
    queue = new Queue(name, { connection, prefix: jobsWorkflowConfig().queuePrefix });
    queueInstances.set(name, queue);
  }
  return queue;
}

export function assertQueueAllowlist(actual: readonly string[], expected: readonly JobQueueName[]): void {
  const normalized = [...new Set(actual)].sort();
  const allowed = [...expected].sort();
  if (normalized.length !== allowed.length || normalized.some((name, index) => name !== allowed[index])) {
    throw new Error(`queue_allowlist_mismatch:${normalized.join(",")}`);
  }
}

export function parseQueueArgument(argv: readonly string[], fallback: readonly JobQueueName[]): readonly string[] {
  const index = argv.indexOf("--queues");
  if (index >= 0) return (argv[index + 1] ?? "").split(",").map((name) => name.trim()).filter(Boolean);
  const singular = argv.indexOf("--queue");
  if (singular >= 0) return [argv[singular + 1] ?? ""].filter(Boolean);
  return fallback;
}

export async function enqueueWorkflowItem(queueName: JobsWorkflowQueueName, payload: WorkflowQueuePayload) {
  const data = WorkflowQueueMessage.parse(payload);
  return workflowQueue(queueName).add(queueName, data, {
    jobId: `${queueName}-${data.workItemId}-v${data.version}`,
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 1,
  });
}

export async function enqueueMailboxAttempt(payload: MailboxDispatchQueuePayload, invocationOrdinal = 1) {
  const data = MailboxDispatchQueueMessage.parse(payload);
  if (!Number.isInteger(invocationOrdinal) || invocationOrdinal < 1 || invocationOrdinal > 3) {
    throw new Error("invalid_mailbox_invocation_ordinal");
  }
  return workflowQueue("mailbox-dispatch").add("mailbox-dispatch", data, {
    jobId: `mailbox-dispatch-${data.attemptId}-v${data.version}-o${invocationOrdinal}`,
    removeOnComplete: true, removeOnFail: 100, attempts: 1,
  });
}

export async function enqueueNotificationOutbox(payload: NotificationOutboxQueuePayload) {
  const data = NotificationOutboxQueueMessage.parse(payload);
  return workflowQueue("notification-outbox").add("notification-outbox", data, {
    jobId: `notification-outbox-${data.outboxId}-v${data.version}`,
    removeOnComplete: true, removeOnFail: 100, attempts: 1,
  });
}

export async function enqueueBlogGeneration(payload: BlogGenerationQueuePayload) {
  const data = BlogGenerationQueueMessage.parse(payload);
  return workflowQueue("blog-generation").add("blog-generation", data, {
    jobId: `blog-generation-${data.generationJobId}-v${data.version}`,
    removeOnComplete: true,
    removeOnFail: 100,
    attempts: 1,
  });
}

export async function cancelUserWorkflowQueueJobs(input: {
  workItems: readonly { id: string; kind: "jobs_match" | "jobs_digest" | "application_package" }[];
  attemptIds: readonly string[];
  outboxIds: readonly string[];
}) {
  const queueByKind = { jobs_match: "jobs-match", jobs_digest: "jobs-digest", application_package: "application-package" } as const;
  const targets = [
    ...input.workItems.map((item) => ({ queue: queueByKind[item.kind], jobId: `${queueByKind[item.kind]}-${item.id}-v1` })),
    ...input.attemptIds.flatMap((id) => [1, 2, 3].map((ordinal) => ({
      queue: "mailbox-dispatch" as const, jobId: `mailbox-dispatch-${id}-v1-o${ordinal}`,
    }))),
    ...input.outboxIds.map((id) => ({ queue: "notification-outbox" as const, jobId: `notification-outbox-${id}-v1` })),
  ];
  await Promise.all(targets.map(async (target) => {
    const job = await workflowQueue(target.queue).getJob(target.jobId);
    if (job && (await job.getState()) !== "active") await job.remove();
  }));
}
