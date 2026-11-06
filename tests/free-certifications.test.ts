import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { CERTIFICATION_CATEGORIES, CERTIFICATION_PROVIDERS, FREE_CERTIFICATIONS, certificationsForSkills } from "../lib/certifications-registry";

const source = (path: string) => readFileSync(resolve(process.cwd(), path.replace(/^\.\.\//, "")), "utf8");

describe("free certification registry", () => {
  it("contains unique, complete records with official HTTPS destinations", () => {
    const ids = new Set<string>();
    for (const item of FREE_CERTIFICATIONS) {
      assert.ok(item.id && !ids.has(item.id), `duplicate or empty id: ${item.id}`);
      ids.add(item.id);
      assert.ok(item.title.trim());
      assert.ok(item.provider.trim());
      assert.ok(CERTIFICATION_PROVIDERS.includes(item.provider));
      assert.ok(CERTIFICATION_CATEGORIES.includes(item.category));
      assert.ok(item.description.trim());
      assert.ok(item.skills.length > 0 && item.skills.every((skill) => skill.trim()));
      assert.ok(item.evidencePrompt.trim());
      assert.ok(item.resumeTitle.includes(item.provider));
      assert.equal(new URL(item.url).protocol, "https:");
      assert.match(item.verifiedAt, /^2026-\d{2}-\d{2}$/);
    }
    assert.ok(FREE_CERTIFICATIONS.length >= 25, "the launch catalog should include at least 25 verified programs");
  });

  it("matches exact normalized skills without returning unrelated credentials", () => {
    const matches = certificationsForSkills([" SQL "], 10);
    assert.ok(matches.length > 0);
    assert.ok(matches.every((item) => item.skills.some((skill) => skill.toLowerCase() === "sql")));
    assert.deepEqual(certificationsForSkills(["a skill with no course"], 10), []);
  });

  it("wires the directory into metadata, sitemap, footer, navigation, tools, and builder controls", () => {
    const page = source("../app/free-certifications/page.tsx");
    assert.match(page, /canonical: "\/free-certifications"/);
    assert.match(source("../app/sitemaps/[name]/route.ts"), /"\/free-certifications"/);
    assert.match(source("../app/footer.tsx"), /href: "\/free-certifications"/);
    assert.match(source("../app/navigation-registry.ts"), /href: "\/free-certifications"/);
    assert.match(source("../lib/tools-registry.ts"), /href: "\/free-certifications"/);
    assert.match(source("../app/build/page.tsx"), /CertificationsPicker/);
    assert.match(source("../app/resume-maker/page.tsx"), /CertificationsPicker/);
    assert.match(source("../app/skill-gap/skill-gap-tool.tsx"), /certificationsForSkills/);
  });
});
