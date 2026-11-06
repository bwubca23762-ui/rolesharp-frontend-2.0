import { randomUUID } from "node:crypto";
import { q, withTransaction } from "./db";
import { generatePost } from "./blog-gen";
import { getPost, saveGeneratedPost } from "./blog";
import { submitToIndexNow } from "./indexnow";
import { env } from "./env";

export const BLOG_GENERATION_QUEUE = "blog-generation" as const;

export type BlogGenerationJobStatus = "pending" | "running" | "completed" | "failed";

export type BlogGenerationJob = {
  id: string;
  topic: string;
  publish_date: string;
  status: BlogGenerationJobStatus;
  attempts: number;
  result_slug: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
};

type ClaimedBlogGenerationJob = {
  id: string;
  topic: string;
  publish_date: string;
};

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "blog_generation_failed";
  return /^[a-z0-9_.:-]{1,120}$/iu.test(message) ? message.toLowerCase() : "blog_generation_failed";
}

export async function createBlogGenerationJob(topic: string, publishDate: string): Promise<BlogGenerationJob> {
  return withTransaction(async (query) => {
    await query("select pg_advisory_xact_lock(hashtext($1))", [`blog-generation:${topic.toLowerCase()}`]);
    const existing = (await query<BlogGenerationJob>(
      `select id,topic,publish_date::text,status,attempts,result_slug,error_code,created_at,updated_at
       from blog_generation_jobs
       where lower(topic)=lower($1) and status in ('pending','running')
       order by created_at desc limit 1`,
      [topic],
    ))[0];
    if (existing) return existing;

    const id = randomUUID();
    return (await query<BlogGenerationJob>(
      `insert into blog_generation_jobs(id,topic,publish_date)
       values ($1,$2,$3::date)
       returning id,topic,publish_date::text,status,attempts,result_slug,error_code,created_at,updated_at`,
      [id, topic, publishDate],
    ))[0];
  });
}

export async function listBlogGenerationJobs(limit = 20): Promise<BlogGenerationJob[]> {
  return q(
    `select id,topic,publish_date::text,status,attempts,result_slug,error_code,created_at,updated_at
     from blog_generation_jobs order by created_at desc limit $1`,
    [Math.max(1, Math.min(limit, 100))],
  );
}

export async function claimBlogGenerationJob(id: string, leaseSeconds = 15 * 60): Promise<ClaimedBlogGenerationJob | null> {
  return withTransaction(async (query) => {
    const row = (await query<ClaimedBlogGenerationJob>(
      `select id,topic,publish_date::text
       from blog_generation_jobs
       where id=$1 and (
         (status='pending' and available_at<=now())
         or (status='running' and lease_expires_at<=now())
       )
       for update`,
      [id],
    ))[0];
    if (!row) return null;
    await query(
      `update blog_generation_jobs
       set status='running', attempts=attempts+1, claimed_at=now(),
           lease_expires_at=now()+make_interval(secs=>$2), error_code=null, updated_at=now()
       where id=$1`,
      [id, leaseSeconds],
    );
    return row;
  });
}

export async function processBlogGenerationJob(id: string): Promise<{ slug: string } | { skipped: true }> {
  const job = await claimBlogGenerationJob(id);
  if (!job) return { skipped: true };
  try {
    const post = await generatePost(job.topic, job.publish_date);
    const existing = await getPost(post.slug);
    if (existing) post.slug = `${post.slug}-${id.slice(0, 8)}`;
    await saveGeneratedPost(post, "ai");
    await q(
      `update blog_generation_jobs
       set status='completed',result_slug=$2,completed_at=now(),lease_expires_at=null,updated_at=now()
       where id=$1 and status='running'`,
      [id, post.slug],
    );
    // Real-time indexing (Module 7): a freshly published post should reach
    // Bing/Copilot's index in minutes, not on their next crawl. Fire-and-log:
    // a failed ping must never fail the job that already succeeded.
    try {
      const ping = await submitToIndexNow([
        `${env.siteUrl}/blog/${post.slug}`,
        `${env.siteUrl}/blog/${post.slug}.md`,
      ]);
      console.log(`[blog-generation] indexnow slug=${post.slug} status=${ping.status} ok=${ping.ok}`);
    } catch (e) {
      console.warn(`[blog-generation] indexnow ping failed for ${post.slug}:`, e instanceof Error ? e.message : e);
    }
    return { slug: post.slug };
  } catch (error) {
    await q(
      `update blog_generation_jobs
       set status='failed',error_code=$2,completed_at=now(),lease_expires_at=null,updated_at=now()
       where id=$1 and status='running'`,
      [id, errorCode(error)],
    );
    throw error;
  }
}
