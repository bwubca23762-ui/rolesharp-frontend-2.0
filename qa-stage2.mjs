import { readFileSync } from "node:fs";
const BASE = "https://rolesharp.com";
const [EMAIL, PASSWORD] = readFileSync("/tmp/qa-flow-creds.txt", "utf8").trim().split(" ");
let cookie = "";
async function api(path, init = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}), origin: BASE, referer: `${BASE}/`, ...(init.headers || {}) },
  });
  const setCookie = r.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const text = await r.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { status: r.status, data, text: text.slice(0, 220) };
}
const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
console.log("login:", login.status, login.text.slice(0, 90));
const profile = await api("/api/career-profiles", { method: "POST", body: JSON.stringify({
  desiredTitles: ["Data Analyst"],
  skills: [{ name: "SQL", state: "possessed" }, { name: "Python", state: "possessed" }, { name: "Excel", state: "possessed" }],
  relevantExperienceMonths: 36,
  seniority: { level: "mid", track: "individual" },
  locations: ["Dhaka"],
  authorization: "authorized",
  compensationFloor: { amountMinor: 3000000, currency: "USD", period: "annual" },
}) });
console.log("profile:", profile.status, profile.text.slice(0, 160));
const profileVersionId = profile.data?.profile?.id;
if (!profileVersionId) process.exit(1);
const campaign = await api("/api/campaigns", { method: "POST", body: JSON.stringify({
  mode: "daily_matches", profileVersionId,
  criteria: { desiredTitles: ["Data Analyst"], mustHaveSkills: ["SQL"], countries: ["BD"], remotePolicies: ["hybrid"], workTypes: ["full_time"] },
  timezone: "Asia/Dhaka", dailyTime: "09:00", dailyLimit: 5, fitScoreFloor: 70, confidenceScoreFloor: 60, status: "active",
}) });
console.log("campaign:", campaign.status, campaign.text.slice(0, 240));
let targetCampaign = campaign.data?.campaign;
if (!targetCampaign?.id) {
  const listed = await api("/api/campaigns");
  targetCampaign = listed.data?.campaigns?.find((item) => item.mode === "daily_matches" && item.status !== "canceled" && item.status !== "expired");
}

// broaden the profile: no location pin, all tracks, and update the campaign to the new version
const p2 = await api("/api/career-profiles", { method: "POST", body: JSON.stringify({
  desiredTitles: ["Data Analyst", "Business Analyst", "Analytics Specialist"],
  skills: [{ name: "SQL", state: "possessed" }, { name: "Python", state: "possessed" }, { name: "Excel", state: "possessed" }, { name: "Power BI", state: "possessed" }],
  relevantExperienceMonths: 36,
  seniority: { level: "mid", track: "individual" },
  locations: [],
  remotePolicies: ["remote", "hybrid", "onsite"],
  authorization: "authorized",
  compensationFloor: { amountMinor: 1200000, currency: "USD", period: "annual" },
}) });
console.log("profile2:", p2.status, p2.text.slice(0, 80));
const pid = p2.data?.profile?.id;
if (pid && targetCampaign?.id) {
  const upd = await api(`/api/campaigns/${targetCampaign.id}`, { method: "PATCH", body: JSON.stringify({ profileVersionId: pid }) });
  console.log("campaign-update:", upd.status, upd.text.slice(0, 120));
} else {
  console.log("campaign-update: skipped; no daily-matches campaign was found");
}
