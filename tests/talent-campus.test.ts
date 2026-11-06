import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { anonymizeForTalentMarketplace, cleanIntroRequest, talentCardSearchable } from "../lib/talent-marketplace";
import { campusEmailMatches, CAMPUS_K_ANONYMITY } from "../lib/campus";
import { publicProfile } from "../lib/personal-site";

const source = (path: string) => readFileSync(path, "utf8");

const PROFILE = publicProfile(
  {
    headline: "Senior Product Designer",
    contact: { email: "a@example.com", phone: "+49 170 1111111", linkedin: "linkedin.com/in/amina", location: "Berlin, Germany" },
    summary: "Product designer in billing.",
    skills: ["Design systems", "User research", "Figma"],
    experiences: [{ title: "Senior Product Designer", company: "Northwind", period: "2021 — present", bullets: ["Led the billing redesign."] }],
    education: [],
    projects: [],
    certifications: [],
    languages: [],
    achievements: [],
  } as never,
  { displayName: "Amina Osei", showContact: true },
);

test("anonymization strips identity and contact, keeps role/skills/aggregate evidence", () => {
  const card = anonymizeForTalentMarketplace("site-1", PROFILE, { verifiedAtsScore: 82 });
  assert.ok(card);
  const serialized = JSON.stringify(card).toLowerCase();
  assert.ok(!serialized.includes("amina"), "name leaked");
  assert.ok(!serialized.includes("example.com"), "email domain leaked");
  assert.ok(!serialized.includes("+49"), "phone leaked");
  assert.ok(!serialized.includes("linkedin.com"), "linkedin leaked");
  // Region at country granularity only — "Berlin" must not appear.
  assert.ok(!serialized.includes("berlin"));
  assert.equal(card!.headline, "Senior Product Designer");
  assert.equal(card!.region, "Germany");
  assert.equal(card!.yearsExperience >= 1, true);
  assert.ok(talentCardSearchable(card!));
  // A headline-less profile is not listable.
  const bare = anonymizeForTalentMarketplace("site-2", { ...PROFILE, headline: "" } as never);
  assert.equal(bare, null);
});

test("intro requests need a real contact, a company, and a real message", () => {
  assert.ok(cleanIntroRequest({ contact: "recruiter@corp.com", company: "Corp", message: "We are hiring a senior designer for billing." }));
  assert.ok(cleanIntroRequest({ contact: "linkedin.com/in/recruiter", company: "Corp", message: "Senior design role open now." }));
  assert.equal(cleanIntroRequest({ contact: "not-a-contact", company: "Corp", message: "Hello there, we are hiring." }), null);
  assert.equal(cleanIntroRequest({ contact: "recruiter@corp.com", company: "C", message: "Hello there, we are hiring." }), null);
  assert.equal(cleanIntroRequest({ contact: "recruiter@corp.com", company: "Corp", message: "short" }), null);
});

test("talent listing is opt-in gated and the card never renders identity", () => {
  const route = source("app/talent/page.tsx");
  assert.match(route, /optedInTalentRows/u);
  assert.match(route, /anonymizeForTalentMarketplace/u);
  assert.match(route, /showContact: false/u);
  assert.match(route, /robots: \{ index: false/u);
  const api = source("app/api/talent/intro/route.ts");
  assert.match(api, /talent_marketplace_opt_in|recordTalentIntroRequest/u);
  assert.match(api, /rateLimit\(req, "talent-intro"/u);
  const db = source("lib/db/personal-sites.ts");
  assert.match(db, /talent_marketplace_opt_in/u);
});

test("campus membership derives from the email domain; k-anonymity stays at five", () => {
  assert.equal(CAMPUS_K_ANONYMITY, 5);
  const portal = { slug: "iit-b", universityName: "IIT Bombay", emailDomain: "@iitb.ac.in" };
  assert.equal(campusEmailMatches("rhea@iitb.ac.in", portal), true);
  assert.equal(campusEmailMatches("rhea@iitb.ac.in.evil.test", portal), false);
  assert.equal(campusEmailMatches("rhea@gmail.com", portal), false);
  assert.equal(campusEmailMatches(null, portal), false);
  const page = source("app/campus/[slug]/page.tsx");
  // Aggregate payload is gated on k-anonymity in the lib, and the page never renders member lists.
  assert.match(source("lib/campus.ts"), /CAMPUS_K_ANONYMITY/u);
  assert.doesNotMatch(page, /u\.email/u);
});
