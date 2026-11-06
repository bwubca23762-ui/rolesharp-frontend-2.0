import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeEvidence, internshipReportSchema, safeHttpUrl } from "../lib/internship-reports";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("internship report URLs only allow web protocols", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("data:text/html,hello"), null);
  assert.equal(safeHttpUrl("https://example.com/internship")?.startsWith("https://example.com/"), true);
});
test("report validation bounds content and rejects duplicate categories", () => {
  const base = {
    company: "Example Company",
    location: "Remote",
    risk: "suspicious",
    categories: ["Upfront payment"],
    description: "The sender requested an upfront payment before any interview could be scheduled.",
  };
  assert.equal(internshipReportSchema.safeParse(base).success, true);
  assert.equal(internshipReportSchema.safeParse({ ...base, description: "Too short" }).success, false);
  assert.equal(internshipReportSchema.safeParse({ ...base, categories: ["Upfront payment", "Upfront payment"] }).success, false);
});

test("evidence validation checks file signatures rather than trusting MIME", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const files = decodeEvidence([{ name: "proof.png", type: "image/png", data: png.toString("base64") }]);
  assert.equal(files[0].bytes.equals(png), true);
  assert.throws(() => decodeEvidence([{ name: "fake.png", type: "image/png", data: Buffer.from("not a png").toString("base64") }]));
});

test("submission identity comes from the encrypted RoleSharp session", () => {
  const route = read("app/api/internship-reports/route.ts");
  assert.match(route, /const user = await currentUser\(\)/);
  assert.match(route, /user\.emailVerified/);
  assert.doesNotMatch(route, /parsed\.data\.email|body\.email|normalizedEmail/);
});

test("reports are private by default and evidence is staff-only", () => {
  const migration = read("db/migrations/026_internship_reports.sql");
  const evidenceRoute = read("app/api/admin/internship-reports/[id]/evidence/[evidenceId]/route.ts");
  assert.match(migration, /status\s+text not null default 'pending'/);
  assert.match(migration, /internship_report_evidence/);
  assert.match(migration, /references internship_reports\(id\) on delete cascade/);
  assert.match(evidenceRoute, /hasAdminPermission\("support\.read"\)/);
  assert.match(evidenceRoute, /Content-Disposition/);
  assert.match(evidenceRoute, /X-Content-Type-Options/);
});
