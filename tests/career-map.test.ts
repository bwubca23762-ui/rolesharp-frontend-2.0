import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MAP_LIMITS, neighbours, skillsOf, skillsThatDoNotTravel, type MapRole } from "../lib/career-map";

const source = (relative: string) => readFileSync(join(process.cwd(), relative), "utf8");

const analyst: MapRole = {
  slug: "data-analyst",
  title: "Data Analyst",
  sector: "Analytics",
  required_skills: ["SQL", "Excel", "Python", "Tableau"],
};
const engineer: MapRole = {
  slug: "software-engineer",
  title: "Software Engineer",
  sector: "IT",
  required_skills: ["Python", "Git", "System Design"],
  preferred_skills: ["SQL"],
};
const accountant: MapRole = {
  slug: "accountant",
  title: "Accountant",
  sector: "Finance",
  required_skills: ["excel", "GAAP", "Reconciliation"],
};
const lifeguard: MapRole = {
  slug: "lifeguard",
  title: "Lifeguard",
  sector: "Leisure",
  required_skills: ["Swimming", "First Aid"],
};

const ALL = [analyst, engineer, accountant, lifeguard];

test("a role with no shared skill is not a neighbour at all", () => {
  // The whole point of the module: an edge with nothing behind it is the
  // unevidenced arrow every other career map draws.
  const found = neighbours(analyst, ALL);
  assert.ok(!found.some((n) => n.role.slug === "lifeguard"));
});

test("shared and missing split the neighbour's skills, with nothing lost", () => {
  const [first] = neighbours(analyst, [engineer]);
  assert.equal(first.role.slug, "software-engineer");
  assert.deepEqual(first.shared.map((s) => s.toLowerCase()).sort(), ["python", "sql"]);
  assert.deepEqual(first.missing.map((s) => s.toLowerCase()).sort(), ["git", "system design"]);
  assert.equal(first.shared.length + first.missing.length, skillsOf(engineer).length);
});

test("preferred skills count as skills", () => {
  // SQL is only in the engineer's preferred list. Dropping preferred_skills
  // would silently weaken every edge into the engineering roles.
  assert.ok(skillsOf(engineer).some((s) => s.toLowerCase() === "sql"));
});

test("matching ignores case, and the label keeps the dataset's casing", () => {
  const [first] = neighbours(analyst, [accountant]);
  // The accountant lists "excel", the analyst lists "Excel".
  assert.equal(first.shared.length, 1);
  assert.equal(first.shared[0].toLowerCase(), "excel");
});

test("neighbours are ranked by overlap, strongest first", () => {
  const found = neighbours(analyst, ALL);
  const overlaps = found.map((n) => n.overlap);
  assert.deepEqual(overlaps, [...overlaps].sort((a, b) => b - a));
  assert.ok(found.every((n) => n.overlap > 0 && n.overlap <= 1));
});

test("a role is never its own neighbour", () => {
  assert.ok(!neighbours(analyst, ALL).some((n) => n.role.slug === analyst.slug));
});

test("skills that appear nowhere else are named", () => {
  const found = neighbours(analyst, ALL);
  // Tableau is the analyst's alone across engineer and accountant.
  assert.deepEqual(skillsThatDoNotTravel(analyst, found), ["Tableau"]);
});

test("the map states what it cannot support", () => {
  // The "What this map is not" essay wall was retired 2026-10-18 (pure
  // workspaces). The limits themselves stay exported in lib/career-map for
  // the methodology page; the page contract below asserts the interactive
  // filter/grid still mounts.
  assert.ok(MAP_LIMITS.length >= 3);
  const page = source("app/career-map/page.tsx");
  assert.match(page, /RoleFilter/, "the role picker must mount");
});

test("the query excludes roles with no skills, which would render as empty nodes", () => {
  assert.match(source("lib/db/roles.ts"), /cardinality\(required_skills\) > 0/);
});

test("the aurora decoration is fully retired", () => {
  // The aurora was decorative gradient atmosphere (Ink & Signal contract bans
  // it). As of 2026-10-21 no surface mounts it at all — the walk that used to
  // police its placement now asserts its absence.
  const roots = ["app", "components"];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(rel);
      } else if (entry.name.endsWith(".tsx")) {
        if (source(rel).includes("rs-marketing-aurora")) offenders.push(rel);
      }
    }
  };
  roots.forEach(walk);
  assert.deepEqual(offenders, []);
});

test("the career map is crawlable and reachable from the nav", () => {
  assert.match(source("app/sitemaps/[name]/route.ts"), /"\/career-map"/);
  assert.match(source("app/navigation-registry.ts"), /href: "\/career-map"/);
});
