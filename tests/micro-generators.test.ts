import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCareerSummary,
  buildResumeSummary,
  strengthenBullets,
  tailorExperienceToPosting,
} from "../lib/micro-generators";

test("bullet rewriting strips filler without adding facts", () => {
  const [review] = strengthenBullets("Responsible for the billing migration that cut failed renewals by 18%");

  assert.equal(review.improved, "The billing migration that cut failed renewals by 18%.");
  assert.ok(review.notes.some((n) => /filler opener/i.test(n)));
  // It already carries a number, so it must not be nagged for one.
  assert.ok(!review.notes.some((n) => /Add a number/i.test(n)));
  // Every word in the output came from the input.
  for (const word of review.improved.toLowerCase().replace(/[^a-z0-9% ]/g, "").split(/\s+/)) {
    assert.ok(review.original.toLowerCase().includes(word), `invented word: ${word}`);
  }
});

test("a bullet with no number is flagged, not given one", () => {
  const [review] = strengthenBullets("Worked on improving the checkout flow");
  assert.equal(review.improved, "Improved the checkout flow.");
  assert.ok(review.notes.some((n) => /Add a number/i.test(n)));
  // The fix must not be to invent a plausible metric.
  assert.ok(!/\d/.test(review.improved));
});

test("a posting requirement is not called unmet when the bullet says the plural", () => {
  // "We need dashboard reporting" against "Built dashboards in Tableau" used to
  // report `dashboard` as unsupported, which reads as not having read the
  // bullet. Same fold recruiter-feedback and the skill gap use, shared stem().
  const result = tailorExperienceToPosting(
    ["Built dashboards in Tableau for the finance team"],
    "We need strong Tableau and dashboard reporting skills",
  );
  assert.ok(result.ranked[0].matched.includes("dashboard"), "the plural bullet did not satisfy the singular requirement");
  assert.ok(!result.unsupported.includes("dashboard"));
  // Genuinely absent requirements still surface.
  assert.ok(result.unsupported.includes("reporting"));
});

test("a gerund left behind by a filler opener is conjugated, not just capitalised", () => {
  // "Responsible for managing X" used to strip to "Managing X" and then tell
  // the user to supply a past-tense verb they had already typed.
  const [review] = strengthenBullets("Responsible for managing the monthly reporting process");
  assert.equal(review.improved, "Managed the monthly reporting process.");
  assert.ok(!review.notes.some((n) => /past-tense action verb/i.test(n)), "still nagged for a verb it just supplied");
  for (const word of ["managed", "monthly", "reporting", "process"]) {
    assert.ok(review.improved.toLowerCase().includes(word));
  }
});

test("an irregular verb is left alone rather than conjugated wrongly", () => {
  // "running" -> "runned" and "leading" -> "leaded" are the failure mode. The
  // allowlist is what stops them reaching a user's resume.
  for (const input of ["Responsible for running the weekly release train", "Leading the payments squad"]) {
    const [review] = strengthenBullets(input);
    assert.doesNotMatch(review.improved, /runned|leaded/i);
    assert.ok(review.notes.some((n) => /past-tense action verb/i.test(n)), `${input} lost its verb note`);
  }
});

test("a weak opener is flagged when the verb is still missing", () => {
  const [review] = strengthenBullets("Team lead for the payments squad");
  assert.ok(review.notes.some((n) => /past-tense action verb/i.test(n)));
});

test("a bullet that is already strong is left alone", () => {
  const [review] = strengthenBullets("Cut p99 settlement latency from 1.4s to 320ms");
  assert.equal(review.improved, "Cut p99 settlement latency from 1.4s to 320ms.");
  assert.deepEqual(review.notes, []);
});

test("an over-long bullet reports its actual length", () => {
  const long = `Led ${"the migration of many services ".repeat(12)}across the platform`;
  const [review] = strengthenBullets(long);
  assert.ok(review.notes.some((n) => /Shorten to one line/.test(n)));
  assert.ok(review.notes.some((n) => /\d+ characters/.test(n)));
});

test("the summary drops clauses it has no input for instead of padding them", () => {
  const full = buildResumeSummary({
    role: "Senior software engineer",
    years: "seven years",
    skills: ["TypeScript", "PostgreSQL"],
    evidence: ["cut failed renewals by 18%"],
  });
  assert.match(full, /^Senior software engineer with seven years of experience\./);
  assert.match(full, /Cut failed renewals by 18%\./);
  assert.match(full, /Works with TypeScript, PostgreSQL\./);

  const sparse = buildResumeSummary({ role: "Warehouse associate", skills: [], evidence: [] });
  assert.equal(sparse, "Warehouse associate.");
  // No invented years, no invented skills, no filler sentence.
  assert.ok(!/experience|Works with/.test(sparse));
});

test("the career summary reads across roles it was given", () => {
  const summary = buildCareerSummary(
    [
      { title: "Senior Engineer", company: "Fictional Payments", period: "2022 - Present" },
      { title: "Engineer", company: "Example Systems", period: "2019 - 2021" },
    ],
    ["Go", "Kafka"],
  );
  assert.match(summary, /Senior Engineer at Fictional Payments\./);
  assert.match(summary, /Previously Engineer at Example Systems\./);
  assert.match(summary, /Core skills: Go, Kafka\./);
  assert.equal(buildCareerSummary([], []), "");
});

test("tailoring ranks the user's own bullets and names what nothing supports", () => {
  const posting = "We need Kubernetes experience, Terraform, and a track record with incident response.";
  const bullets = [
    "Wrote release notes for the mobile team",
    "Migrated the platform to Kubernetes and automated rollouts with Terraform",
  ];
  const { ranked, unsupported } = tailorExperienceToPosting(bullets, posting);

  // The relevant bullet ranks first because it matches more of the posting.
  assert.match(ranked[0].bullet, /Kubernetes/);
  assert.ok(ranked[0].matched.length > ranked[1].matched.length);

  // The requirement with no evidence is named rather than written for them.
  assert.ok(unsupported.includes("incident"), `expected an incident gap, got ${unsupported.join(", ")}`);
  // Framing words are not gaps in anyone's experience. Listing "need" or
  // "track record" back as something they lack makes the honest part of this
  // tool look careless.
  for (const noise of ["need", "track", "record", "experience", "strong"]) {
    assert.ok(!unsupported.includes(noise), `${noise} is posting framing, not a requirement`);
  }
  assert.ok(!ranked.some((entry) => /incident/i.test(entry.bullet)), "must not invent a bullet for the gap");
});

test("tailoring survives an empty posting and empty bullets", () => {
  assert.deepEqual(tailorExperienceToPosting([], ""), { ranked: [], unsupported: [] });
});
