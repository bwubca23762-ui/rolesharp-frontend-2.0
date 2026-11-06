import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  compactRoleTitle,
  blogSeoTitle,
  comparisonSeoMetadata,
  conciseSeoDescription,
  countryCompanyDirectoryMetadata,
  companyHubMetadata,
  companyRoleMetadata,
  roleHubMetadata,
  jobMarketSeoMetadata,
  seoMetadataTargets,
} from "../lib/seo-metadata.ts";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("curated role names preserve formal page copy but shorten search metadata", () => {
  assert.equal(
    compactRoleTitle("Securities, Commodities, and Financial Services Sales Agents"),
    "Financial Services Sales",
  );
  assert.equal(
    compactRoleTitle("Formal Database Role", "Database Specialist"),
    "Database Specialist",
  );
});

test("blog, comparison, and market metadata remain concise", () => {
  const values = [
    {
      title: blogSeoTitle(
        "tailor-student-resume-for-internships",
        "How Students Can Tailor One Resume for Internships Without Rewriting It From Scratch",
      ),
      description: conciseSeoDescription("A ".repeat(120)),
    },
    comparisonSeoMetadata("Kickresume"),
    jobMarketSeoMetadata("Jobs", "United States"),
    jobMarketSeoMetadata("Internships", "United Arab Emirates"),
  ];

  for (const value of values) {
    assert.ok(value.title.length <= seoMetadataTargets.title, value.title);
    assert.ok(value.description.length <= seoMetadataTargets.description, value.description);
  }
});

test("country-specific company-role metadata is unique and concise", () => {
  const ireland = companyRoleMetadata({
    company: "Accenture",
    role: "Accountant",
    country: "Ireland",
  });
  const unitedStates = companyRoleMetadata({
    company: "Accenture",
    role: "Accountant",
    country: "United States",
  });

  assert.notEqual(ireland.title, unitedStates.title);
  assert.notEqual(ireland.description, unitedStates.description);
  assert.match(ireland.title, /Ireland/);
  assert.match(unitedStates.title, /US/);
  assert.ok(ireland.title.length <= seoMetadataTargets.title);
  assert.ok(unitedStates.title.length <= seoMetadataTargets.title);
  assert.ok(ireland.description.length <= seoMetadataTargets.description);
  assert.ok(unitedStates.description.length <= seoMetadataTargets.description);
  assert.match(unitedStates.description, /in the United States/);
});

test("long formal occupations use a readable short title without cutting words", () => {
  const metadata = companyRoleMetadata({
    company: "Oracle",
    role: "Securities, Commodities, and Financial Services Sales Agents",
    country: "Spain",
  });

  assert.match(metadata.title, /Financial Services Sales/);
  assert.match(metadata.title, /Spain/);
  assert.ok(metadata.title.length <= seoMetadataTargets.title);
  assert.ok(metadata.description.length <= seoMetadataTargets.description);
});

test("company and role hubs share the same metadata limits", () => {
  const company = companyHubMetadata({ company: "Stripe", country: "Ireland" });
  const directory = countryCompanyDirectoryMetadata("United States", 8041);
  const role = roleHubMetadata("Computer and Information Systems Managers");

  assert.match(company.title, /Ireland/);
  assert.match(directory.title, /United States/);
  assert.match(role.title, /IT Manager/);
  assert.ok(company.title.length <= seoMetadataTargets.title);
  assert.ok(company.description.length <= seoMetadataTargets.description);
  assert.ok(directory.title.length <= seoMetadataTargets.title);
  assert.ok(directory.description.length <= seoMetadataTargets.description);
  assert.ok(role.title.length <= seoMetadataTargets.title);
  assert.ok(role.description.length <= seoMetadataTargets.description);
});

test("high-value landing routes publish route-specific social previews", () => {
  for (const path of [
    "app/pricing/page.tsx",
    "app/resume-templates/page.tsx",
    "app/blog/page.tsx",
  ]) {
    assert.match(source(path), /openGraph:\s*\{[\s\S]*images:\s*\["\/opengraph-image"\]/);
  }

  const jobs = source("app/jobs/page.tsx");
  assert.match(jobs, /openGraph:\s*\{/);
  assert.match(jobs, /title:\s*"Job Search — Fresh Jobs by Country \| RoleSharp"/);
  assert.match(jobs, /url:\s*"\/jobs"/);
  assert.match(jobs, /images:\s*\["\/opengraph-image"\]/);
});
