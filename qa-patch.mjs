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
  return { status: r.status, data, text: text.slice(0, 200) };
}
await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const upd = await api("/api/campaigns/e5506547-e96b-4d5d-8cac-dd4ec4ea0a24", { method: "PATCH", body: JSON.stringify({ profileVersionId: "b351c62d-09c8-4ccf-958c-46912ed7dace" }) });
console.log("patch:", upd.status, upd.text.slice(0, 150));
const matches = await api("/api/daily-matches?limit=5");
console.log("daily-matches:", matches.status, matches.text.slice(0, 200));
