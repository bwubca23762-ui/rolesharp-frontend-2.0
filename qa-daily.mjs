import { readFileSync } from "node:fs";
const BASE = "https://rolesharp.com";
const [EMAIL, PASSWORD] = readFileSync("/tmp/qa-flow-creds.txt", "utf8").trim().split(" ");
let cookie = "";
async function api(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), origin: BASE, referer: `${BASE}/`, ...(init.headers || {}) } });
  const setCookie = r.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, text: text.slice(0, 300) };
}
await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const matches = await api("/api/daily-matches?limit=5");
console.log("daily-matches:", matches.status, matches.text.slice(0, 260));
const campaign = await api("/api/campaigns");
console.log("campaigns:", campaign.status, campaign.text.slice(0, 200));
