import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

// GitHub repo-to-resume compiler. Reads public data from the GitHub REST API
// and turns it into ATS-quantified XYZ project bullets — using ONLY the facts
// the API returns (stars, forks, language, topics, description). No invented
// metrics, no fabricated percentages: a repo with 340 stars says "340 stars".
// An optional GITHUB_TOKEN raises the per-hour ceiling for busy deployments.

const Username = z
  .string()
  .trim()
  .min(1)
  .max(39)
  .regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, { message: "invalid_username" });

const MAX_REPOS = 100;

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "RoleSharp-GitHub-Bridge",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "tools-github-import", 20);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const parsed = Username.safeParse(new URL(req.url).searchParams.get("username") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid GitHub username (letters, digits, single hyphens)." }, { status: 400 });
  }
  const username = parsed.data;

  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers: ghHeaders(), cache: "no-store" }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=${MAX_REPOS}&sort=pushed`, {
        headers: ghHeaders(),
        cache: "no-store",
      }),
    ]);

    if (userRes.status === 404) {
      return NextResponse.json({ error: `No GitHub user named "${username}" exists.` }, { status: 404 });
    }
    if (userRes.status === 403 || reposRes.status === 403) {
      return NextResponse.json(
        { error: "GitHub's API rate limit was reached. Try again in a few minutes." },
        { status: 429, headers: { "Retry-After": "300" } },
      );
    }
    if (!userRes.ok || !reposRes.ok) {
      return NextResponse.json({ error: "GitHub did not respond. Try again." }, { status: 502 });
    }

    const [user, repos] = (await Promise.all([userRes.json(), reposRes.json()])) as [
      { login: string; name?: string | null; bio?: string | null; public_repos: number; followers: number; html_url: string; avatar_url?: string },
      Array<{
        name: string;
        html_url: string;
        description?: string | null;
        language?: string | null;
        stargazers_count: number;
        forks_count: number;
        topics?: string[];
        fork: boolean;
        pushed_at?: string;
      }>,
    ];

    const own = (Array.isArray(repos) ? repos : []).filter((repo) => !repo.fork);
    const totalStars = own.reduce((sum, repo) => sum + (repo.stargazers_count ?? 0), 0);
    const totalForks = own.reduce((sum, repo) => sum + (repo.forks_count ?? 0), 0);

    const languageCounts = new Map<string, number>();
    for (const repo of own) {
      if (repo.language) languageCounts.set(repo.language, (languageCounts.get(repo.language) ?? 0) + 1);
    }
    const languages = [...languageCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name, repos2]) => ({ name, repos: repos2 }));

    const topics = [...new Set(own.flatMap((repo) => repo.topics ?? []))].slice(0, 12);

    // Top 6 repositories by stars (then recency) — the ones a resume should
    // lead with. Bullets are assembled from API facts only.
    const top = [...own]
      .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0) || String(b.pushed_at ?? "").localeCompare(String(a.pushed_at ?? "")))
      .slice(0, 6);

    const projects = top.map((repo) => {
      const stars = repo.stargazers_count ?? 0;
      const forks = repo.forks_count ?? 0;
      const language = repo.language ?? "open-source";
      const detail = (repo.description ?? "").trim();
      const label = stars > 0 ? `${stars.toLocaleString("en-US")}-star` : forks > 0 ? `${forks.toLocaleString("en-US")}-fork` : "";
      let bullet = `Built ${repo.name}, a ${language} ${label || "open-source"} project`;
      if (stars > 0 && forks > 0) bullet += ` (${stars.toLocaleString("en-US")} stars, ${forks.toLocaleString("en-US")} forks)`;
      if (detail) bullet += ` — ${detail}`;
      return {
        name: repo.name,
        url: repo.html_url,
        description: detail,
        language: repo.language,
        stars,
        forks,
        pushedAt: repo.pushed_at ?? null,
        bullet,
      };
    });

    return NextResponse.json(
      {
        profile: {
          login: user.login,
          name: user.name ?? user.login,
          bio: user.bio ?? "",
          publicRepos: user.public_repos,
          followers: user.followers,
          htmlUrl: user.html_url,
        },
        stats: {
          publicRepos: own.length,
          totalStars,
          totalForks,
          languages,
          topics,
          suggestedSkills: [...languages.map((l) => l.name), ...topics].slice(0, 24),
        },
        projects,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub. Check the username and try again." }, { status: 502 });
  }
}
