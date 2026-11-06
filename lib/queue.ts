import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

export const connection = new IORedis(env.redisUrl, env.localDevMode
  ? {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null,
      connectTimeout: 250,
      commandTimeout: 250,
    }
  : {
      maxRetriesPerRequest: null,
      // Importing API routes during `next build` must not open sockets. Redis
      // connects automatically when the first real queue command is issued.
      lazyConnect: true,
    });

// ioredis emits `error` events even when the caller handles a rejected command.
// Register a listener so an unavailable Redis service cannot become an
// unhandled EventEmitter error during local development or an outage.
let lastRedisErrorLog = 0;
connection.on("error", (error) => {
  const now = Date.now();
  if (now - lastRedisErrorLog >= 30_000) {
    lastRedisErrorLog = now;
    console.warn("[redis] connection unavailable", error.message);
  }
});

// BullMQ requires maxRetriesPerRequest: null on the connections its workers
// use, and the cost lands on the request path: a command issued while Redis is
// unreachable is queued until reconnect rather than rejected, so `await
// connection.get(...)` inside a route never settles. Every caller below already
// has a try/catch with a sane fallback; none of them could ever run. Measured
// during the outage drill: /api/roles, /api/companies/search and POST
// /api/auth/signup all failed to return within 90s, i.e. a Redis blip reads as
// a full outage instead of degraded service.
//
// Request-path Redis calls go through this so the fallback is reachable. Worker
// code must NOT use it — its blocking commands are supposed to wait.
export const REDIS_REQUEST_TIMEOUT_MS = 1_000;
// After a failure, skip Redis entirely for this long. Without it every call on
// every request pays the full timeout during an outage (company search alone
// makes three, measured at 3.0s per request), and each attempt hands ioredis
// another command for an offline queue that only drains on reconnect.
const REDIS_CIRCUIT_OPEN_MS = 5_000;
let redisDownUntil = 0;

// Takes a thunk, not a promise: while the circuit is open the command must not
// be issued at all, or it just accumulates in the offline queue.
export async function redisDeadline<T>(
  work: () => Promise<T>,
  timeoutMs = REDIS_REQUEST_TIMEOUT_MS,
  circuitOpenMs = REDIS_CIRCUIT_OPEN_MS,
): Promise<T> {
  if (Date.now() < redisDownUntil) throw new Error("redis circuit open");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      work(),
      new Promise<never>((_, reject) => {
        // Deliberately not unref'd. An unref'd timer cannot hold the loop open,
        // so when this deadline is the only pending work the loop drains before
        // it fires and the promise never settles -- the exact hang it exists to
        // prevent. A live server always has other handles, which is why this
        // only ever surfaced under the test runner. The finally below clears it
        // as soon as the race settles, so the most it can delay an exit is
        // timeoutMs.
        timer = setTimeout(() => reject(new Error(`redis command exceeded ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    redisDownUntil = 0;
    return result;
  } catch (error) {
    // Any failure opens it, not just a timeout: a command erroring is equally a
    // reason to stop asking for five seconds. The cost of being wrong is five
    // seconds of the local fallback, which is the same boundary either way.
    redisDownUntil = Date.now() + circuitOpenMs;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

// Single queue; concurrency (μ, service rate) lives in the worker. Keep its
// construction lazy because Next evaluates API route modules during builds.
let _queue: Queue | null = null;
function queue(): Queue {
  if (!_queue) _queue = new Queue("resume", { connection });
  return _queue;
}

export const resumeQueue = new Proxy({} as Queue, {
  get(_target, property) {
    const value = Reflect.get(queue(), property);
    return typeof value === "function" ? value.bind(queue()) : value;
  },
});

// Owed credit refunds, held here until PostgreSQL accepts them.
//
// A failed generation spends the user's credit and refunds it in the worker's
// failed-handler. That refund used to be three inline attempts over ~3 seconds,
// after which the error was logged and the debt existed nowhere: the BullMQ job
// is created with removeOnFail: true, so the only record of what was owed was
// already gone. A Postgres restart lasting longer than three seconds therefore
// destroyed paid credits silently, and a drain-timeout process.exit could kill
// an in-flight refund the same way because nothing awaited it.
//
// Redis is the right place for that debt: the worker cannot be running without
// it, it survives both a database outage and a worker restart, and the refund
// itself is idempotent (credit_events_refund_once), so redelivery is harmless.
// removeOnFail is deliberately false — a refund that exhausts every attempt has
// to stay on the failed set as evidence, which is exactly what the original
// code threw away.
let _refundQueue: Queue | null = null;
function refundQueue(): Queue {
  if (!_refundQueue) _refundQueue = new Queue("credit-refund", { connection });
  return _refundQueue;
}

export const creditRefundQueue = new Proxy({} as Queue, {
  get(_target, property) {
    const value = Reflect.get(refundQueue(), property);
    return typeof value === "function" ? value.bind(refundQueue()) : value;
  },
});

export const CREDIT_REFUND_JOB_OPTS = {
  // ~9 hours of exponential backoff before the last attempt. A database outage
  // longer than that is an incident someone is already awake for, and the job
  // is still on the failed set afterwards to be retried by hand.
  attempts: 12,
  backoff: { type: "exponential" as const, delay: 10_000 },
  removeOnComplete: true,
  removeOnFail: false,
};

// Best-effort backpressure: shed new work when the queue is already deep so
// latency doesn't grow unbounded during a spike. This is a soft signal, NOT an
// atomic guarantee — the count()+add() are separate ops, so concurrent
// requests can briefly overshoot maxQueueDepth. That's acceptable; it bounds
// the average, not the instantaneous max.
export async function admit(): Promise<boolean> {
  try {
    const depth = await redisDeadline(() => resumeQueue.count());
    return depth < env.maxQueueDepth;
  } catch (error) {
    // No Redis means no queue to hand the job to. Shedding here turns that into
    // an immediate 503 with a Retry-After instead of a request that hangs (or,
    // once bounded, a 500 from an unhandled rejection).
    console.warn("[queue] admit check unavailable; shedding", error instanceof Error ? error.message : error);
    return false;
  }
}

export async function cancelUserGenerationJobs(userId: string): Promise<number> {
  const jobs = await resumeQueue.getJobs(["waiting", "delayed", "paused", "active"], 0, -1, true);
  const owned = jobs.filter((job) => {
    const data = job.data as Record<string, unknown>;
    return data.userId === userId;
  });

  await Promise.all(owned.map(async (job) => {
    const data = job.data as Record<string, unknown>;
    try {
      const state = await job.getState();
      if (state !== "active") {
        await job.remove();
        return;
      }
    } catch {
      // A waiting job can become active between getState() and remove().
      // Sanitizing it is safe in either state; the worker then exits without
      // persisting data for the deleted account.
    }
    await job.updateData({
      resumeId: typeof data.resumeId === "string" ? data.resumeId : null,
      userId: null,
      accountDeleted: true,
    }).catch(() => {
      // The worker may have completed and auto-removed the job in the gap.
    });
  }));

  return owned.length;
}
