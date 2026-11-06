// IndexNow — instantly notify Bing (and ChatGPT/Copilot search, which Bing feeds)
// that URLs are new or changed. No login/API key dance: we host a key file at
// /<key>.txt and POST the changed URLs. Google ignores IndexNow (use GSC there).
import { env } from "./env";

const INDEXNOW_KEY = process.env.INDEXNOW_KEY?.trim() || "49c6fc2b66f874e89bfa90420605f981";
const HOST = (env.siteUrl || "https://rolesharp.com").replace(/^https?:\/\//, "").replace(/\/$/, "");

// Submit up to 10,000 URLs per call (IndexNow limit). Returns the HTTP status.
export async function submitToIndexNow(urls: string[]): Promise<{ ok: boolean; status: number; count: number }> {
  const list = urls.filter(Boolean).slice(0, 10000);
  if (!list.length) return { ok: false, status: 0, count: 0 };
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: list,
    }),
  });
  return { ok: res.ok, status: res.status, count: list.length };
}
