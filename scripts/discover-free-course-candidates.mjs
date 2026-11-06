import { readFile, writeFile } from "node:fs/promises";

// Conservative discovery only: provider catalog pages may contain courses
// whose certificate or assessment is paid. Candidates are never published
// directly; the weekly workflow opens a review issue with official URLs.
const providers = [
  { name: "Kaggle", catalog: "https://www.kaggle.com/learn", host: "www.kaggle.com", path: /^\/learn\// },
  { name: "HubSpot Academy", catalog: "https://academy.hubspot.com/courses", host: "academy.hubspot.com", path: /^\/courses\// },
  { name: "Google Skillshop", catalog: "https://skillshop.withgoogle.com/", host: "skillshop.withgoogle.com", path: /^\// },
  { name: "Cisco Networking Academy", catalog: "https://www.netacad.com/courses", host: "www.netacad.com", path: /^\/courses\// },
  { name: "Harvard CS50", catalog: "https://cs50.harvard.edu/courses/", host: "cs50.harvard.edu", path: /^\/(?:x|ai|web|python|sql|cybersecurity)\// },
];

const registry = await readFile(new URL("../lib/certifications-registry.ts", import.meta.url), "utf8");
const known = new Set([...registry.matchAll(/url:\s*"(https:\/\/[^\"]+)"/g)].map((m) => canonical(m[1])));
const candidates = [];

for (const provider of providers) {
  const response = await fetch(provider.catalog, {
    headers: { "user-agent": "RoleSharpCourseCatalogMonitor/1.0 (+https://rolesharp.com)" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${provider.name} catalog returned HTTP ${response.status}`);
  const html = await response.text();
  for (const match of html.matchAll(/<a\b([^>]*\bhref\s*=\s*(["'])(.*?)\2[^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    let url;
    try { url = new URL(decode(match[3]), provider.catalog); } catch { continue; }
    url.hash = "";
    if (url.protocol !== "https:" || url.hostname !== provider.host || !provider.path.test(url.pathname)) continue;
    const key = canonical(url.href);
    if (known.has(key) || candidates.some((item) => item.url === key)) continue;
    // Avoid account, search, and non-course navigation links. Provider adapters
    // can narrow this list as their official catalogs evolve.
    const anchorText = match[4].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    if (!/(course|certif|learn|training|credential|academy|skill)/i.test(`${url.pathname} ${anchorText}`)) continue;
    candidates.push({ provider: provider.name, url: key });
  }
}

function canonical(value) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  return url.href.replace(/\/$/, "");
}
function decode(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&#x2F;", "/");
}

const markdown = candidates.length
  ? `Potential new provider catalog links were found. Verify course access, credential, and assessment cost before adding any to the public catalog.\n\n${candidates.map((item) => `- **${item.provider}** — ${item.url}`).join("\n")}\n`
  : "No new course-like links found in monitored official catalogs.\n";
await writeFile(process.env.COURSE_CANDIDATES_FILE ?? "/tmp/free-course-candidates.md", markdown);
console.log(`Found ${candidates.length} potential course links.`);
