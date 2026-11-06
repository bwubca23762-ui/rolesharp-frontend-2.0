const BASE = "https://rolesharp.com";
const EMAIL = `qa.flow.${Date.now().toString(36)}@rolesharp.com`;
const PASSWORD = "QaFlow-" + Math.random().toString(36).slice(2, 10) + "!7";
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
  return { status: r.status, data, text: text.slice(0, 200) };
}
console.log("EMAIL:", EMAIL, "PASS:", PASSWORD);
// 1. legal versions + signup
const legal = await api("/api/legal/current");
console.log("legal:", legal.status, JSON.stringify(legal.data)?.slice(0, 120));
const signup = await api("/api/auth/signup", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD, legalVersionIds: legal.data?.versions?.map((v) => v.id) ?? [] }) });
console.log("signup:", signup.status, signup.text);

// 2. login (after DB verify — done out-of-band)
const login = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
console.log("login:", login.status, login.text.slice(0, 80));
// 3. career profile
const profile = await api("/api/career-profiles", { method: "POST", body: JSON.stringify({
  desiredTitles: ["Data Analyst"],
  skills: [{ name: "SQL", state: "possessed" }, { name: "Python", state: "possessed" }, { name: "Excel", state: "possessed" }],
  relevantExperienceMonths: 36,
  seniority: { level: "mid", track: "individual" },
  locations: ["Dhaka"],
  authorization: "authorized",
  compensationFloor: { amountMinor: 3000000, currency: "USD", period: "annual" },
}) });
console.log("profile:", profile.status, profile.text.slice(0, 140));
const profileVersionId = profile.data?.profile?.id;
// 4. campaign (daily_matches, active)
const campaign = await api("/api/campaigns", { method: "POST", body: JSON.stringify({
  mode: "daily_matches", profileVersionId,
  criteria: { countries: ["BD"], remotePolicies: ["any"], workTypes: ["fulltime"], minSalaryMinor: null, maxSalaryMinor: null },
  timezone: "Asia/Dhaka", dailyTime: "09:00", dailyLimit: 5, fitScoreFloor: 70, confidenceScoreFloor: 60, status: "active",
}) });
console.log("campaign:", campaign.status, campaign.text.slice(0, 200));
