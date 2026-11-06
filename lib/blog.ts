// File-based blog (no CMS/DB) — content lives in content/blog-posts.ts as typed
// objects. Powers the GEO/AEO content hub: how-to guides, comparisons, lists.

export type BlogSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  ordered?: boolean; // render bullets as <ol> instead of <ul>
  // AEO: a real HTML <table> wins comparison/pricing Featured Snippets — far
  // better than styled divs, which engines can't extract. headers + rows.
  table?: { headers: string[]; rows: string[][] };
};

export type BlogPost = {
  slug: string;
  title: string; // <title> / SEO
  h1: string; // visible H1
  description: string; // meta description
  answer: string; // AEO: direct 1-2 sentence answer up top
  datePublished: string; // ISO date
  dateModified: string; // ISO date
  readMins: number;
  tags: string[];
  category: "How-To" | "Comparison" | "Guide" | "List";
  author?: string; // key into lib/authors.ts AUTHORS; falls back to default
  sections: BlogSection[];
  faqs?: [string, string][];
};

import { POSTS } from "@/content/blog-posts";
import { EXTRA_POSTS } from "@/content/blog-posts-extra";
import { q } from "./db";

// File posts are the always-available base. DB posts (AI-generated via the admin
// panel) merge on top — a DB post with the same slug overrides the file one.
// All readers are async now so they can pull DB rows; if the DB is unreachable
// (e.g. build time, no local PG) we fall back to file posts only.

const FILE_POSTS = [...POSTS, ...EXTRA_POSTS];

async function dbPosts(): Promise<BlogPost[]> {
  try {
    const rows = await q<{ data: BlogPost }>(
      "select data from blog_posts where status='published' order by created_at desc",
    );
    return rows.map((r) => r.data).filter((p) => p && p.slug);
  } catch {
    return [];
  }
}

function mergePosts(file: BlogPost[], db: BlogPost[]): BlogPost[] {
  const bySlug = new Map<string, BlogPost>();
  for (const p of file) bySlug.set(p.slug, p);
  for (const p of db) bySlug.set(p.slug, p); // DB overrides file on slug clash
  return [...bySlug.values()].sort((a, b) => (a.datePublished < b.datePublished ? 1 : -1));
}

export async function listPosts(): Promise<BlogPost[]> {
  return mergePosts([...FILE_POSTS], await dbPosts());
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  // This used to call dbPosts() and .find() in memory, loading every published
  // post's full JSON on every blog page render. The blog worker keeps adding
  // rows, so the cost grew linearly forever. Look up the one row instead.
  try {
    const rows = await q<{ data: BlogPost }>(
      "select data from blog_posts where slug=$1 and status='published' limit 1",
      [slug],
    );
    if (rows[0]?.data?.slug) return rows[0].data;
  } catch {
    // DB unreachable (build time, no local PG) — fall through to file posts.
  }
  return FILE_POSTS.find((p) => p.slug === slug) ?? null;
}

// File-only variants for build-time generateStaticParams (must be sync + safe
// without a DB). DB posts are picked up at request time via ISR + dynamicParams.
export function filePostSlugs(): string[] {
  return FILE_POSTS.map((p) => p.slug);
}

// --- storage for AI-generated posts ---
export async function saveGeneratedPost(post: BlogPost, source = "ai"): Promise<void> {
  await q(
    `insert into blog_posts (slug, data, source, updated_at)
     values ($1, $2, $3, now())
     on conflict (slug) do update set data=excluded.data, updated_at=now()`,
    [post.slug, JSON.stringify(post), source],
  );
}

export async function deleteGeneratedPost(slug: string): Promise<void> {
  await q("delete from blog_posts where slug=$1", [slug]);
}

export async function listGeneratedPosts(): Promise<{ slug: string; title: string; created_at: string }[]> {
  try {
    return await q(
      "select slug, data->>'title' as title, created_at from blog_posts order by created_at desc",
    );
  } catch {
    return [];
  }
}
