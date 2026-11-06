/**
 * Master Search Engine Indexing Submitter for RoleSharp
 * Submits curated canonical sitemap URLs directly to:
 * 1. Google Indexing API (Real-time Googlebot priority queue)
 * 2. IndexNow (Bing, ChatGPT, Copilot, Perplexity crawler network)
 *
 * Usage: npx tsx scripts/submit-google-indexing.ts
 */

import { execSync } from "child_process";

const SITE = "https://rolesharp.com";
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || "49c6fc2b66f874e89bfa90420605f981";

const SITEMAPS = [
  `${SITE}/sitemaps/pages.xml`,
  `${SITE}/sitemaps/blog.xml`,
  `${SITE}/sitemaps/interview-questions.xml`,
  `${SITE}/sitemaps/salaries.xml`,
  `${SITE}/sitemaps/hubs.xml`,
];

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    return locs;
  } catch {
    return [];
  }
}

async function getGoogleToken(): Promise<string | null> {
  try {
    const token = execSync("gcloud auth application-default print-access-token", {
      encoding: "utf-8",
    }).trim();
    return token;
  } catch (err: any) {
    console.warn("Could not acquire gcloud application-default token:", err.message);
    return null;
  }
}

async function submitToGoogle(url: string, token: string): Promise<boolean> {
  try {
    const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Goog-User-Project": "toolcrix",
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function submitToIndexNow(urls: string[]): Promise<boolean> {
  try {
    const host = new URL(SITE).host;
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList: urls,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== RoleSharp Search Engine Fast Indexer ===\n");

  const allUrlsSet = new Set<string>();
  // Ensure priority commercial tools are first in line
  const priorityRoutes = [
    `${SITE}/`,
    `${SITE}/checker`,
    `${SITE}/resume-builder`,
    `${SITE}/resume-maker`,
    `${SITE}/resume-fixer`,
    `${SITE}/ats-xray`,
    `${SITE}/github-resume`,
    `${SITE}/ai-humanizer`,
    `${SITE}/compare`,
    `${SITE}/pricing`,
    `${SITE}/blog`,
    `${SITE}/blog/best-ai-resume-builders-2026`,
    `${SITE}/compare/rolesharp-vs-aiapply`,
    `${SITE}/compare/rolesharp-vs-kickresume`,
    `${SITE}/compare/rolesharp-vs-teal`,
    `${SITE}/compare/rolesharp-vs-rezi`,
    `${SITE}/compare/rolesharp-vs-zety`,
    `${SITE}/compare/rolesharp-vs-novoresume`,
    `${SITE}/compare/rolesharp-vs-resume-io`,
    `${SITE}/compare/rolesharp-vs-chatgpt-resume`,
  ];
  for (const r of priorityRoutes) allUrlsSet.add(r);

  for (const sm of SITEMAPS) {
    const urls = await fetchSitemapUrls(sm);
    console.log(`Fetched ${urls.length} URLs from ${sm}`);
    for (const u of urls) allUrlsSet.add(u);
  }

  const allUrls = Array.from(allUrlsSet);
  console.log(`\nTotal unique URLs collected: ${allUrls.length}`);

  // 1. Submit ALL to IndexNow (Bing, Copilot, ChatGPT search)
  console.log(`\nSubmitting ${allUrls.length} URLs to IndexNow...`);
  const indexNowSuccess = await submitToIndexNow(allUrls);
  console.log(indexNowSuccess ? "✓ IndexNow submission successful!" : "✗ IndexNow submission failed");

  // 2. Submit top 150 priority URLs to Google Indexing API (Google quota is ~200/day)
  const token = await getGoogleToken();
  if (token) {
    const googleBatch = allUrls.slice(0, 150);
    console.log(`\nSubmitting ${googleBatch.length} highest-priority URLs to Google Indexing API...`);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < googleBatch.length; i++) {
      const url = googleBatch[i];
      const ok = await submitToGoogle(url, token);
      if (ok) {
        successCount++;
        process.stdout.write(`\rGoogle Indexing Progress: ${i + 1}/${googleBatch.length} (${successCount} OK)`);
      } else {
        failCount++;
      }
      await new Promise((r) => setTimeout(r, 100)); // Respect Google rate limits
    }
    console.log(`\nGoogle Indexing API Complete: ${successCount} successful, ${failCount} failed.`);
  } else {
    console.log("\nSkipping Google Indexing API (no valid token available).");
  }

  console.log("\nDone! All priority URLs pushed to search engine crawlers.");
}

main().catch(console.error);
