import { Worker } from "bullmq";
import { connection, creditRefundQueue, CREDIT_REFUND_JOB_OPTS } from "../lib/queue";
import { env } from "../lib/env";
import { releaseGenerationReservation } from "../lib/entitlements";
import { LegalAcceptanceRequiredError, requireCurrentLegalAcceptance } from "../lib/legal";
import { tailor } from "../lib/tailor";
import { reviewAndRevise } from "../lib/tailor/review";
import { saveResume } from "../lib/db";
import { q } from "../lib/db/core";
import { GenerateRequest } from "../lib/types";
import type { CompanyContext } from "../lib/company-context";
import {
  grantReferralCreditForActiveUser,
  refundGenerationCredit,
  spendCredit,
} from "../lib/credits";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

class CreditUnavailableError extends Error {
  readonly name = "CreditUnavailableError";
}

let shuttingDown = false;

// Graceful shutdown: drain in-flight jobs, close worker + Redis, then exit.
// SIGTERM from systemctl restart must not kill jobs mid-flight — that would
// lose credits AND waste the LLM call that already succeeded.
async function gracefulShutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[worker] ${signal} received — draining ${env.workerConcurrency} concurrent jobs…`);
  // Stop claiming liveness the moment we intend to stop being live, so a
  // restart that hangs during drain is visible instead of looking healthy.
  clearInterval(heartbeat);
  try {
    // Wait up to 30s for in-flight jobs to complete naturally, then force-close.
    const timeout = setTimeout(() => {
      console.log("[worker] drain timeout — forcing close");
      void worker.disconnect();
      void refundWorker.disconnect();
      connection.disconnect();
      process.exit(1);
    }, 30_000);

    // Both workers, and the refund worker last: closing the generation worker
    // is what flushes its failed-handler, and that handler is what enqueues the
    // refunds this one still has to drain.
    await worker.close();
    await refundWorker.close();
    clearTimeout(timeout);
    await connection.quit();
    console.log("[worker] closed cleanly");
  } catch (error: unknown) {
    console.error(`[worker] close error: ${errorMessage(error)}`);
    connection.disconnect();
  }
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// The worker IS your service rate μ. Throughput = WORKER_CONCURRENCY × (1/W_cpu).
const worker = new Worker(
  "resume",
  async (job) => {
    const t0 = Date.now();
    const resumeId = typeof job.data.resumeId === "string" ? job.data.resumeId : String(job.id);
    if (job.data.accountDeleted || !job.data.req || !job.data.userId) {
      return { resumeId, skipped: true };
    }

    const req = GenerateRequest.parse(job.data.req);
    const role = job.data.role ?? null;
    const companyName = job.data.companyName as string | undefined;
    const userId = String(job.data.userId);
    const model = (job.data.model as "claude" | "gemini") ?? "gemini";
    const template = (job.data.template as string) ?? "basic";
    const companyId = (job.data.companyId as number | null) ?? null;
    const roleId = (job.data.roleId as number | null) ?? null;
    const queuedCompanyContext = (job.data.companyContext as Partial<NonNullable<CompanyContext>> | null) ?? null;
    // Jobs queued by an older web process may predate the provenance field.
    const companyContext: CompanyContext = queuedCompanyContext
      ? { ...queuedCompanyContext, guidanceSource: queuedCompanyContext.guidanceSource ?? "sector_inference" }
      : null;
    const premiumUnlock = !!job.data.premiumUnlock;
    const useCredit = Boolean(job.data.useCredit);
    try {
      await requireCurrentLegalAcceptance(userId);
    } catch (error) {
      if (!(error instanceof LegalAcceptanceRequiredError)) throw error;
      if (!useCredit) await releaseGenerationReservation(userId, resumeId);
      return { resumeId, skipped: true, reason: "legal_acceptance_required" };
    }
    let creditEventId: number | null = null;
    if (useCredit) {
      creditEventId = await spendCredit(userId, resumeId);
      if (!creditEventId) throw new CreditUnavailableError("generation credit is unavailable");
    }
    const premium = !!job.data.premium;

    // Do not persist generated resume content in Redis job data. Completed and
    // failed queue records are removed immediately; PostgreSQL remains the
    // ownership-scoped source of truth.
    const { content, atsScore, model: resolvedModel } = await tailor(
      req,
      role,
      companyName,
      model,
      premium,
      companyContext,
    );
    // Drafter–reviewer pass (premium only — it doubles the LLM cost): a fresh
    // context critiques the draft against the JD and the drafter revises.
    // Fail-open by contract: any error leaves the draft untouched, and the
    // reported atsScore stays the drafter's own measured number — the review
    // must never be able to inflate the score it did not measure.
    let finalContent = content;
    if (premium) {
      try {
        finalContent = await reviewAndRevise(content, {
          jdText: req.jdText,
          roleTitle: role?.title ?? req.roleTitleRaw,
          companyName,
          model,
        });
        if (finalContent !== content) console.log(`[review] ${resumeId} revised ${job.data.roleTitleRaw ?? role?.title ?? ""}`.trimEnd());
      } catch (error: unknown) {
        console.warn(`[review] ${resumeId} failed open: ${errorMessage(error)}`);
      }
    }
    const result = { content: finalContent, atsScore, model: resolvedModel, genMs: Date.now() - t0 };

    // Persist so the resume can be previewed, paid for, and downloaded later.
    let lastError: Error | null = null;
    let saved = false;
    for (let i = 0; i < 3; i++) {
      try {
        saved = await saveResume({
          id: resumeId,
          companySlug: req.companySlug,
          companyId,
          roleSlug: req.roleSlug,
          roleId,
          jdText: req.jdText,
          content: result.content,
          atsScore: result.atsScore,
          name: req.profile.name,
          genMs: result.genMs,
          userId,
          template,
          premiumUnlock,
          creditEventId,
          model: result.model ?? `${model}:unknown`,
        });
        lastError = null;
        break;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`[persist-fail] ${resumeId} attempt ${i + 1}: ${lastError.message}`);
        await sleep(500 * (i + 1));
      }
    }
    if (lastError) throw new Error(`persist_failed: ${lastError.message}`, { cause: lastError });
    if (!saved) return { resumeId, skipped: true };

    // Idempotent: the referral event has a unique constraint, so worker
    // retries cannot grant the activation credit more than once.
    await grantReferralCreditForActiveUser(userId).catch((error: unknown) => {
      console.error(`[referral-credit] ${resumeId}: ${errorMessage(error)}`);
    });

    return { resumeId, atsScore: result.atsScore, genMs: result.genMs };
  },
  { connection, concurrency: env.workerConcurrency },
);

worker.on("completed", (_job, res) => {
  if (res.skipped) {
    console.log(`[skip] ${res.resumeId} account no longer active`);
    return;
  }
  console.log(`[done] ${res.resumeId} ats=${res.atsScore} ${res.genMs}ms`);
});

worker.on("failed", (job, err) => {
  console.error(`[fail] ${job?.id} ${err.message}`);
  // Final failure (no more retries left): the spent credit is owed back.
  //
  // This used to attempt the refund inline, three times over ~3 seconds, and
  // then give up with a log line. Because the generation job carries
  // removeOnFail: true, giving up erased the only record that anything was
  // owed — so a database outage lasting more than three seconds destroyed a
  // paid credit with nothing left to reconcile from. Hand the debt to Redis
  // instead and let a queue with real backoff carry it across the outage.
  // The double-fire claim (app/api/generate) is also released here: a failed
  // generation must not replay its dead resumeId to a retry with identical
  // content, or the user would be stuck polling "still processing" forever.
  if (
    job &&
    job.attemptsMade >= (job.opts.attempts ?? 1) &&
    job.data.userId &&
    job.data.resumeId
  ) {
    const resumeId = String(job.data.resumeId);
    void q(
      `update action_idempotency set status='failed', updated_at=now()
       where action_kind='generate' and response->>'resumeId' = $1`,
      [resumeId],
    ).catch((e: unknown) => console.error(`[claim-fail] ${resumeId} ${errorMessage(e)}`));
    if (!job.data.useCredit) {
      // The quota reservation ages out on its own (the usage query counts
      // only reservations from the last 10 minutes), but a final failure
      // should not hold the user's slot for that window — release it now.
      releaseGenerationReservation(String(job.data.userId), resumeId)
        .catch((e: unknown) => console.error(`[reservation-release] ${resumeId} ${errorMessage(e)}`));
    }
    if (job.data.useCredit) {
      // jobId is the resume id, so a redelivered generation failure collapses
      // onto one refund job rather than queueing a second.
      creditRefundQueue
        .add("refund", { userId: String(job.data.userId), resumeId },
          { jobId: `refund:${resumeId}`, ...CREDIT_REFUND_JOB_OPTS })
        .catch((e: unknown) => console.error(`[refund-enqueue-fail] ${resumeId} ${errorMessage(e)}`));
    }
  }
});

// Drains the owed-refund queue. refundGenerationCredit requires that an
// original spend exists and does the idempotency insert plus balance update in
// one statement, guarded by credit_events_refund_once — so a redelivery after a
// partial failure cannot pay the credit back twice. Throwing here is correct:
// it is what makes BullMQ retry on its backoff schedule instead of dropping it.
const refundWorker = new Worker<{ userId: string; resumeId: string }>(
  "credit-refund",
  async (job) => {
    const { userId, resumeId } = job.data;
    const refunded = await refundGenerationCredit(userId, resumeId);
    console.log(refunded
      ? `[refund] credit returned to ${userId} for ${resumeId}`
      : `[refund] nothing owed for ${resumeId} (already refunded, or no spend)`);
  },
  { connection, concurrency: 4 },
);

refundWorker.on("failed", (job, err) => {
  console.error(`[refund-retry] ${job?.data?.resumeId} attempt ${job?.attemptsMade}: ${err.message}`);
});

// Liveness heartbeat.
//
// systemd's Restart=always only reacts to the process exiting. The failure mode
// that actually strands work is the opposite one — the process alive and
// healthy as far as systemd can tell, while its event loop is wedged and no job
// ever completes. That is the exact case scripts/watchdog.sh exists for on the
// web service, and until now nothing looked at the workers at all.
//
// A key with a TTL is the whole mechanism: if the loop stops turning, nobody
// refreshes it, it expires, and its absence is the signal. No metrics backend,
// no new service. unref() so a stuck heartbeat can never itself hold the
// process open during shutdown.
const HEARTBEAT_KEY = "worker:resume:heartbeat";
const HEARTBEAT_TTL_SECONDS = 120;
const heartbeat = setInterval(() => {
  void connection
    .set(HEARTBEAT_KEY, String(Date.now()), "EX", HEARTBEAT_TTL_SECONDS)
    .catch((error: unknown) => console.warn(`[heartbeat] ${errorMessage(error)}`));
}, 30_000);
heartbeat.unref();

console.log(`resume worker up, concurrency=${env.workerConcurrency}`);
