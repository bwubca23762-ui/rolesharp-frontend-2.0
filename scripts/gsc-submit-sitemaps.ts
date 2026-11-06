// Submit the sitemap segments to Google Search Console via the Search Console
// API, using the existing VPS service account (voice runner key). The SA must
// be a DELEGATED OWNER of the rolesharp.com property in GSC for submit to
// succeed (read works with lesser roles; submit needs owner).
//
// Run on the VPS:
//   cd /opt/resume-ai/current && set -a && . /opt/resume-ai/.env && set +a \
//     && node --import tsx scripts/gsc-submit-sitemaps.ts
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const KEY_FILE = process.env.GCP_SERVICE_ACCOUNT_FILE ?? "/opt/resume-ai/voice-runner-key.json";
const SCOPES = "https://www.googleapis.com/auth/webmasters";
const SITE = "sc-domain:rolesharp.com";
const SITEMAPS = [
  "sitemap.xml",
  "sitemaps/pages.xml",
  "sitemaps/jobs.xml",
  "sitemaps/hubs.xml",
  "sitemaps/blog.xml",
  "sitemaps/interview-questions.xml",
  "sitemaps/salaries.xml",
  "sitemaps/people.xml",
];

type ServiceAccount = { client_email: string; private_key: string };

async function main() {
const account = JSON.parse(readFileSync(KEY_FILE, "utf8")) as ServiceAccount;

const b64 = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const header = b64(JSON.stringify({ alg: "RS256", typ: "JWT" }));
const payload = b64(JSON.stringify({ iss: account.client_email, scope: SCOPES, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
const signer = createSign("RSA-SHA256");
signer.update(`${header}.${payload}`);
signer.end();
const assertion = `${header}.${payload}.${signer.sign(account.private_key).toString("base64url")}`;

const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
});
if (!tokenResponse.ok) {
  console.error("token exchange failed:", await tokenResponse.text());
  process.exit(1);
}
const { access_token } = (await tokenResponse.json()) as { access_token: string };
const auth = { Authorization: `Bearer ${access_token}` };

// Which properties can this SA see?
const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: auth });
const sites = (await sitesResponse.json()) as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> };
console.log("properties visible to the service account:");
for (const entry of sites.siteEntry ?? []) console.log(`  ${entry.permissionLevel.padEnd(12)} ${entry.siteUrl}`);

console.log("\nsubmitting sitemaps:");
for (const sitemap of SITEMAPS) {
  const sitePath = encodeURIComponent(SITE);
  const feedPath = encodeURIComponent(`https://rolesharp.com/${sitemap}`);
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${sitePath}/sitemaps/${feedPath}`, { method: "PUT", headers: auth });
  console.log(`  ${r.status === 200 || r.status === 204 ? "OK" : "FAIL " + r.status}  ${sitemap} ${r.ok ? "" : (await r.text()).slice(0, 120)}`);
}

}

main().catch((e) => { console.error(e); process.exit(1); });
