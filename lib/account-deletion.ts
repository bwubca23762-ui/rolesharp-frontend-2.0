import { deleteUserAccountData, q } from "./db";
import { beginAccountWorkflowDeletion, bestEffortAccountRevocations } from "./jobs-workflow/lifecycle";
import { cancelUserWorkflowQueueJobs } from "./jobs-workflow/queues";
import { cancelUserGenerationJobs, connection } from "./queue";
import { cancelUserCommunications } from "./communications";

export type AccountDeletionResult = {
  deleted: boolean;
  cleanupWarnings: string[];
};

async function queueReferencesForUser(userId: string) {
  return {
    workItems: await q<{ id: string; kind: "jobs_match" | "jobs_digest" | "application_package" }>(
      `select id,kind from job_work_items
       where user_id=$1 and status not in ('completed','canceled','unknown','terminal_failed')`,
      [userId],
    ),
    attemptIds: (await q<{ id: string }>(
      `select id from application_mail_attempts
       where user_id=$1 and status in ('queued','reserved','retryable','needs_user')`,
      [userId],
    )).map(({ id }) => id),
    outboxIds: (await q<{ id: string }>(
      `select id from notification_outbox
       where user_id=$1 and status in ('pending','claimed')`,
      [userId],
    )).map(({ id }) => id),
  };
}

function warningMessage(operation: string, error: unknown): string {
  const kind = error instanceof Error ? error.name : "unknown_error";
  console.error(`[account-delete] ${operation} failed: ${kind}`);
  return operation;
}

export async function deleteAccountLifecycle(
  userId: string,
  audit?: { action: string; targetEmail: string | null; details: Record<string, unknown> },
): Promise<AccountDeletionResult> {
  const references = await queueReferencesForUser(userId);
  const revocations = await beginAccountWorkflowDeletion(userId);
  const cleanupWarnings: string[] = [];
  await cancelUserCommunications(userId).catch((error) => {
    cleanupWarnings.push(warningMessage("communications_cleanup", error));
  });

  await cancelUserGenerationJobs(userId).catch((error) => {
    cleanupWarnings.push(warningMessage("generation_queue_cleanup", error));
  });
  await cancelUserWorkflowQueueJobs(references).catch((error) => {
    cleanupWarnings.push(warningMessage("workflow_queue_cleanup", error));
  });
  await bestEffortAccountRevocations(revocations).catch((error) => {
    cleanupWarnings.push(warningMessage("provider_revocation", error));
  });

  const deleted = await deleteUserAccountData(userId, audit ? {
    ...audit,
    details: { ...audit.details, cleanupWarnings },
  } : undefined);
  if (!deleted) return { deleted: false, cleanupWarnings };

  // Interview-practice state lives only in Redis, not Postgres: open sessions
  // (7-day TTL), first-answer burn markers (40-day TTL) and the monthly free
  // counter (40-day TTL). Postgres deletion cannot reach them, so they are
  // purged here — the deleted account's answers must not outlive the account.
  // Best-effort: Redis being down must not fail a completed deletion.
  try {
    const pattern = `ivw:${userId}:*`;
    let cursor = "0";
    do {
      const [next, keys] = await connection.scan(cursor, "MATCH", pattern, "COUNT", 200);
      cursor = next;
      if (keys.length > 0) await connection.del(...keys);
    } while (cursor !== "0");
  } catch (error) {
    cleanupWarnings.push(warningMessage("interview_redis_cleanup", error));
  }

  await cancelUserGenerationJobs(userId).catch((error) => {
    cleanupWarnings.push(warningMessage("final_generation_queue_cleanup", error));
  });
  await cancelUserWorkflowQueueJobs(references).catch((error) => {
    cleanupWarnings.push(warningMessage("final_workflow_queue_cleanup", error));
  });

  return { deleted: true, cleanupWarnings };
}
