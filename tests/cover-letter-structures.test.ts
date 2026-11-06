import test from "node:test";
import assert from "node:assert/strict";
import { COVER_LETTER_STRUCTURES, SAMPLE_EVIDENCE, structureBySlug } from "../lib/cover-letter-structures";

test("every structure renders the same facts, arranged differently", () => {
  const letters = COVER_LETTER_STRUCTURES.map((structure) => structure.render(SAMPLE_EVIDENCE));
  assert.equal(new Set(letters).size, letters.length, "two structures produced the same letter");

  for (const [index, letter] of letters.entries()) {
    const name = COVER_LETTER_STRUCTURES[index].name;
    assert.ok(letter.includes(SAMPLE_EVIDENCE.name), `${name} drops the candidate's name`);
    assert.ok(letter.includes(SAMPLE_EVIDENCE.targetCompany), `${name} drops the target company`);
    // The strongest result is the point of every one of these shapes.
    assert.ok(letter.includes(SAMPLE_EVIDENCE.results[0]), `${name} drops the strongest result`);
  }
});

test("no structure asserts anything the evidence does not contain", () => {
  // The classic hollow cover letter openings, none of which are claims about
  // the candidate that any evidence supports.
  const hollow = /keen interest|perfect fit|ideal candidate|passionate about|dream (job|company)|thrilled|honou?red to|team player|hit the ground running/i;
  for (const structure of COVER_LETTER_STRUCTURES) {
    const letter = structure.render(SAMPLE_EVIDENCE);
    assert.doesNotMatch(letter, hollow, `${structure.name} contains filler`);
  }
});

test("the referral structure refuses to invent a referrer", () => {
  const referral = structureBySlug("referral");
  assert.ok(referral);

  const named = referral.render(SAMPLE_EVIDENCE);
  assert.match(named, /Anita Desai on your data team suggested I apply/);

  const anonymous = referral.render({ ...SAMPLE_EVIDENCE, referrer: undefined });
  assert.doesNotMatch(anonymous, /Anita/);
  // It leaves a visible placeholder and says why, rather than quietly writing
  // a plausible name into the highest-stakes sentence in the letter.
  assert.match(anonymous, /\[Name\]/);
  assert.match(anonymous, /rather than inventing one/);
});

test("the career-change structure names the change without apologising for it", () => {
  const change = structureBySlug("career-change");
  assert.ok(change);
  const letter = change.render(SAMPLE_EVIDENCE);
  assert.match(letter, /moving from audit into Analytics Lead work/);
  assert.doesNotMatch(letter, /sorry|apolog|unfortunately|although I lack|despite my lack/i);

  // With no previous field given, it still states the change rather than
  // inventing a field the candidate never named.
  const unnamed = { ...SAMPLE_EVIDENCE, previousField: undefined };
  assert.match(change.render(unnamed), /I am changing fields/);
  assert.doesNotMatch(change.render(unnamed), /from audit/);
});

test("the short structure really is short", () => {
  const short = structureBySlug("short");
  assert.ok(short);
  const letter = short.render(SAMPLE_EVIDENCE);
  const direct = structureBySlug("direct")!.render(SAMPLE_EVIDENCE);
  assert.ok(letter.length < direct.length, "the short letter is not shorter than the direct one");
  // Shorter, but it still carries the number. That is the one thing it cannot cut.
  assert.ok(letter.includes(SAMPLE_EVIDENCE.results[0]));
});

test("the speculative structure admits it is guessing", () => {
  const speculative = structureBySlug("speculative");
  assert.ok(speculative);
  const letter = speculative.render(SAMPLE_EVIDENCE);
  assert.match(letter, /I do not think there is one open/);
  // It must not claim knowledge of the company's priorities.
  assert.doesNotMatch(letter, /I know you (are|need)|your biggest (problem|challenge)|clearly need/i);
});

test("every structure documents when to use it and what it must not do", () => {
  const slugs = new Set<string>();
  for (const structure of COVER_LETTER_STRUCTURES) {
    assert.ok(!slugs.has(structure.slug), `duplicate slug ${structure.slug}`);
    slugs.add(structure.slug);
    assert.match(structure.slug, /^[a-z-]+$/);
    assert.ok(structure.leadsWith.length > 10, `${structure.name} has no leadsWith`);
    assert.ok(structure.useWhen.length > 30, `${structure.name} has no useWhen`);
    assert.ok(structure.neverDo.length > 30, `${structure.name} has no neverDo`);
  }
});

test("a structure renders from sparse evidence without leaving loose punctuation", () => {
  const sparse = {
    name: "Sam Okafor",
    role: "Analyst",
    company: "Example Systems",
    targetRole: "Senior Analyst",
    targetCompany: "Ledgerline",
    results: ["I closed the month-end books three days earlier than the prior process."],
    skills: [],
  };
  for (const structure of COVER_LETTER_STRUCTURES) {
    const letter = structure.render(sparse);
    assert.doesNotMatch(letter, /undefined|null|\[object/, `${structure.name} leaked a value`);
    assert.doesNotMatch(letter, /\s,|,\s*\.|\.\s*\./, `${structure.name} left loose punctuation`);
    assert.doesNotMatch(letter, /\n\n\n/, `${structure.name} left an empty paragraph`);
  }
});

test("job titles keep the case they were typed in, with the right article", () => {
  // Lowercasing only the first letter produced "a senior Data Analyst" and
  // "analytics Lead work" — visible on the live page, invisible to a test that
  // only checks the facts are present.
  for (const structure of COVER_LETTER_STRUCTURES) {
    const letter = structure.render(SAMPLE_EVIDENCE);
    assert.doesNotMatch(letter, /senior Data Analyst/, `${structure.name} half-cased the role`);
    assert.doesNotMatch(letter, /analytics Lead/, `${structure.name} half-cased the target role`);
  }

  const vowel = structureBySlug("direct")!.render({ ...SAMPLE_EVIDENCE, role: "Analyst" });
  assert.match(vowel, /I work as an Analyst\./);
  const consonant = structureBySlug("direct")!.render({ ...SAMPLE_EVIDENCE, role: "Data Scientist" });
  assert.match(consonant, /I work as a Data Scientist\./);
});
