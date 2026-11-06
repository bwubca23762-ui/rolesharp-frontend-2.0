import { Worker, type Job } from "bullmq";
import { processBlogGenerationJob } from "../lib/blog-jobs";
import { connection } from "../lib/queue";
import { jobsWorkflowConfig } from "../lib/jobs-workflow/config";
import { BlogGenerationQueueMessage } from "../lib/jobs-workflow/queues";

let stopping = false;

async function stop(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[blog-generation] ${signal}; draining`);
  let timedOut = false;
  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      timedOut = true;
      resolve();
    }, 5 * 60_000);
  });
  await Promise.race([worker.close(), timeout]);
  if (timedOut) {
    void worker.disconnect();
    connection.disconnect();
    process.exit(1);
  }
  await connection.quit().catch(() => connection.disconnect());
  process.exit(0);
}

process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));

const worker = new Worker(
  "blog-generation",
  async (job: Job) => {
    const payload = BlogGenerationQueueMessage.parse(job.data);
    return processBlogGenerationJob(payload.generationJobId);
  },
  {
    connection,
    prefix: jobsWorkflowConfig().queuePrefix,
    concurrency: 1,
  },
);

worker.on("completed", (job, result) => {
  console.log(`[blog-generation] completed id=${job.id} result=${JSON.stringify(result)}`);
});

worker.on("failed", (job, error) => {
  console.error(`[blog-generation] failed id=${job?.id ?? "unknown"} error=${error.name}`);
});

console.log("blog generation worker up; concurrency=1");
