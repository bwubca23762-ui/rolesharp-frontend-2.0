import { q } from "../db";

/**
 * Resolves rows abandoned mid-send.
 *
 * A row moves to `sending` immediately before the provider call. If the worker
 * dies in that window — OOM, SIGKILL, deploy, host reboot — nothing ever moves
 * it again: `scheduleDueWorkflowItems` selects `pending` and lease-expired
 * `claimed`, and never `sending`. Worse, `communication_attempts` is unique per
 * recipient and inserted with `on conflict (recipient_id) do nothing`, so one
 * stuck attempt means that recipient can never be sent to again, silently and
 * permanently. Neither table had any path back.
 *
 * These are resolved to terminal `unknown`, NOT retried. The provider call may
 * well have succeeded before the process died, and this codebase is deliberate
 * that provider success is acceptance and never delivery — the queue UI offers
 * no resend for an unknown outcome for exactly this reason. Retrying here would
 * trade a silent stall for a silently double-sent email, which is worse and
 * unrecoverable. `unknown` is honest, it is visible in the queue, and
 * scripts/retention-purge.ts collects it on the 30-day window the schema's own
 * `purge_after = terminal_at + interval '30 days'` check already demands.
 *
 * The threshold is deliberately generous. A provider call plus its timeout is
 * seconds; an hour in `sending` means no process is coming back for it.
 */
const STUCK_AFTER = "1 hour";

export type StuckSendRecovery = { notificationOutbox: number; communicationRecipients: number; attempts: number };

export async function recoverStuckSends(): Promise<StuckSendRecovery> {
  // Column order matters to the table's own check constraint: a terminal row
  // must carry terminal_at AND purge_after = terminal_at + 30 days, and for
  // notification_outbox `classification` must equal the terminal status.
  const outbox = await q<{ id: string }>(
    `update notification_outbox
     set status='unknown', classification='unknown',
         terminal_at=now(), purge_after=now() + interval '30 days', updated_at=now()
     where status='sending'
       and provider_call_started_at < now() - interval '${STUCK_AFTER}'
     returning id`,
  );

  const recipients = await q<{ id: string }>(
    `update communication_recipients
     set status='unknown', terminal_at=now(), purge_after=now() + interval '30 days', updated_at=now()
     where status='sending'
       and provider_call_started_at < now() - interval '${STUCK_AFTER}'
     returning id`,
  );

  // The attempt row is what blocks the recipient from ever being retried, so it
  // has to be closed out too. Its own check requires finished_at to be set
  // exactly when status leaves 'sending'.
  const attempts = await q<{ id: string }>(
    `update communication_attempts
     set status='unknown', finished_at=now()
     where status='sending'
       and started_at < now() - interval '${STUCK_AFTER}'
     returning id`,
  );

  const result = {
    notificationOutbox: outbox.length,
    communicationRecipients: recipients.length,
    attempts: attempts.length,
  };
  const total = result.notificationOutbox + result.communicationRecipients + result.attempts;
  if (total > 0) {
    // Loud, because a nonzero count here means a worker died mid-send. The
    // recovery is correct but the cause is not, and nothing else reports it.
    console.warn(
      `[stuck-send-recovery] resolved ${total} abandoned row(s) to unknown: ` +
      `outbox=${result.notificationOutbox} recipients=${result.communicationRecipients} attempts=${result.attempts}`,
    );
  }
  return result;
}
