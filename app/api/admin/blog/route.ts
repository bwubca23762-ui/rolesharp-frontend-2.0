import { NextRequest, NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { listGeneratedPosts, deleteGeneratedPost } from "@/lib/blog";
import { createBlogGenerationJob, listBlogGenerationJobs } from "@/lib/blog-jobs";
import { enqueueBlogGeneration } from "@/lib/jobs-workflow/queues";
import { rateLimit } from "@/lib/rate-limit";
import { mutationOriginAllowed } from "@/lib/jobs-workflow/api";
import { recordAdminAction } from "@/lib/admin-audit";

export const runtime = "nodejs";

// List generated posts and durable generation requests.
export async function GET() {
  if (!(await hasAdminPermission("content.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [posts, jobs] = await Promise.all([listGeneratedPosts(), listBlogGenerationJobs()]);
  return NextResponse.json({ posts, jobs });
}

// Generation is persisted before enqueue. The scheduler reconstructs a missing
// Redis message, so a web-process restart cannot lose accepted work.

export async function POST(req: NextRequest) {
  if (!(await hasAdminPermission("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const limited = await rateLimit(req, "admin-blog", 10);
  if (!limited.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.topic !== "string") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { topic, today } = body;
  const clean = String(topic || "").trim();
  if (clean.length < 6) return NextResponse.json({ error: "topic_too_short" }, { status: 400 });
  if (clean.length > 200) return NextResponse.json({ error: "topic_too_long" }, { status: 400 });

  if (today !== undefined && (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today) || !Number.isFinite(Date.parse(`${today}T00:00:00Z`)) || new Date(`${today}T00:00:00Z`).toISOString().slice(0, 10) !== today)) return NextResponse.json({ error: "invalid_publish_date" }, { status: 400 });
  const todayIso = today ?? new Date().toISOString().slice(0, 10);

  const generation = await createBlogGenerationJob(clean.slice(0, 200), todayIso);
  await recordAdminAction("blog_generate_queued", {
    details: { generationJobId: generation.id, topic: generation.topic, publishDate: generation.publish_date },
  });
  try {
    await enqueueBlogGeneration({ generationJobId: generation.id, version: 1 });
  } catch (error) {
    console.error("blog generation enqueue deferred to scheduler", {
      generationJobId: generation.id,
      error: error instanceof Error ? error.name : "queue_error",
    });
  }
  return NextResponse.json({
    ok: true,
    queued: true,
    already: generation.status !== "pending" || generation.attempts > 0,
    generationJobId: generation.id,
    status: generation.status,
  });
}

// Delete a generated post.
export async function DELETE(req: NextRequest) {
  if (!(await hasAdminPermission("content.edit"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!mutationOriginAllowed(req)) return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug_required" }, { status: 400 });
  await deleteGeneratedPost(slug);
  await recordAdminAction("blog_delete", { details: { slug } });
  return NextResponse.json({ ok: true });
}
