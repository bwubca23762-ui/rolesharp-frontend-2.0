import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

// Every .tsx under app/admin, including views/ and panels/.
function adminSources(): { path: string; text: string }[] {
  const root = new URL("../app/admin/", import.meta.url);
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => ({
      path: `app/admin/${name.replace(/\\/g, "/")}`,
      text: readFileSync(new URL(name.replace(/\\/g, "/"), root), "utf8"),
    }));
}

test("getPost looks up one slug instead of scanning every published post", () => {
  const blog = source("lib/blog.ts");
  const getPost = blog.slice(blog.indexOf("export async function getPost"));
  // The bug was calling dbPosts() — "select data from blog_posts where
  // status='published'" with no slug filter — then .find()ing in memory, so
  // every blog render got more expensive as the worker added rows.
  assert.match(getPost, /where slug=\$1 and status='published' limit 1/);
  assert.doesNotMatch(getPost, /await dbPosts\(\)/);
});

test("blog generator reports the real job outcome, never a tick count", () => {
  const view = source("app/admin/views/blog-view.tsx");
  // The poll must resolve on the tracked job's own status. Announcing success
  // because N ticks elapsed reports "published" for a generation that threw.
  assert.match(view, /tracked\?\.status === "completed" \|\| tracked\?\.status === "failed"/);
  assert.match(view, /ok: tracked\.status === "completed"/);
  assert.doesNotMatch(view, /Published! See it below\./);
});

test("blog generation poll is cleared on unmount", () => {
  const view = source("app/admin/views/blog-view.tsx");
  // The interval is created inside an async click handler, so React cannot
  // clean it up. Without a ref it kept fetching and calling setState for
  // 30 x 8s after the admin navigated away from the blog view.
  assert.match(view, /const pollRef = useRef<number \| null>\(null\)/);
  assert.match(view, /window\.clearInterval\(pollRef\.current\); pollRef\.current = null;/);
  assert.match(view, /useEffect\(\(\) => stopPoll, \[stopPoll\]\)/);
  // No bare interval handle may survive; every clear goes through stopPoll.
  assert.doesNotMatch(view, /const iv = window\.setInterval/);
});

test("no admin view swallows a failure into an empty catch", () => {
  // `catch {}` left views pinned on "Loading..." with no way to tell a dead
  // API from an empty table. This is the invariant, not one file's helper.
  const offenders = adminSources()
    .filter((file) => /\}\s*catch\s*\{\s*\}/.test(file.text))
    .map((file) => file.path);
  assert.deepEqual(offenders, [], `admin views swallowing errors: ${offenders.join(", ")}`);
  // And the tree must actually have been scanned.
  assert.ok(adminSources().length > 10, "expected to scan the whole admin tree");
});

test("ensureInviteCode only returns a code the database actually stored", () => {
  const credits = source("lib/credits.ts");
  // The update is guarded by `invite_code is null`, so a concurrent request can
  // make it match zero rows. Without `returning`, the old code handed back a
  // code that was never persisted.
  assert.match(credits, /returning invite_code/);
  assert.match(credits, /if \(updated\[0\]\) return updated\[0\]\.invite_code/);
});

test("lint and typecheck exclude the same generated directories", () => {
  const eslint = source("eslint.config.mjs");
  const tsconfig = JSON.parse(source("tsconfig.json"));
  // A build dir missing from either list silently breaks that tool:
  // .local/build-backups once produced 49,912 phantom lint problems while a
  // stale .next produced 67 phantom tsc errors.
  // .claude holds the git worktrees, each carrying its own .next; from the main
  // checkout that was 14,032 phantom lint problems and zero real ones.
  for (const dir of [".next", ".next-*", "bin", "outputs", ".omo", "audits", ".claude"]) {
    assert.ok(eslint.includes(`"${dir}/**"`), `eslint.config.mjs must ignore ${dir}`);
    assert.ok(tsconfig.exclude.includes(dir), `tsconfig.json must exclude ${dir}`);
  }
  assert.ok(eslint.includes('".local/**"'), "eslint.config.mjs must ignore .local");
});

test("every Premium feature sold on /pricing is reachable from the UI", () => {
  // /api/{cover,interview,linkedin} shipped working and premium-gated but had
  // zero callers anywhere in the app — pricing sold three features a paying
  // customer could not reach. Only comments mentioned /api/interview.
  // The detail page dispatches on ToolKey, so the three route names appear as
  // the union members rather than as literal fetch URLs.
  const page = source("app/resumes/[id]/page.tsx");
  assert.match(page, /type ToolKey = "cover" \| "interview" \| "linkedin"/);
  assert.match(page, /await fetch\(`\/api\/\$\{key\}`, \{\s*method: "POST"/);
  for (const key of ["cover", "interview", "linkedin"]) {
    assert.match(page, new RegExp(`key: "${key}"`), `${key} missing from the tool list`);
  }
  // 402 must offer an upgrade path, not a dead error string.
  assert.match(page, /r\.status === 402/);
});

test("saved resumes can be reopened after leaving /build", () => {
  // app/resume/[company]/[role] owns that segment (Next rejects two slug names
  // at one level), so the detail page lives at /resumes/[id].
  const page = source("app/resumes/[id]/page.tsx");
  assert.match(page, /fetch\(`\/api\/resume\/\$\{id\}`\)/);
  assert.match(source("app/dashboard/page.tsx"), /href=\{`\/resumes\/\$\{r\.id\}`\}/);
  // The GET must return the stored add-ons; re-POSTing to regenerate them 402s
  // for a user who generated while premium and has since lapsed.
  const route = source("app/api/resume/[id]/route.ts");
  for (const field of ["coverLetter", "linkedin", "interview", "premiumUnlock"]) {
    assert.ok(route.includes(`${field}:`), `GET /api/resume/[id] must return ${field}`);
  }
});

test("writes refuse to report success when there is no database", () => {
  // The failure mode: q() returns [] with no pool, so `returning id` yields
  // undefined and the route answers {ok:true} for a write that never happened.
  // The guarantee here is stronger than a hasDb() pre-check — the write itself
  // refuses, which also catches a live pool whose insert produced no row.
  assert.match(source("lib/db/core.ts"), /if \(!pool\) throw new Error\("Database is not configured"\)/);
  for (const [file, guard] of [
    ["lib/db/applications.ts", /if \(!rows\[0\]\) throw new Error\("application_insert_failed"\)/],
    ["lib/db/support.ts", /if \(!id\) throw new Error\("support_ticket_not_created"\)/],
  ] as const) {
    assert.match(source(file), guard, file);
    assert.match(source(file), /withTransaction/, `${file} must write inside a transaction`);
  }
  // Support additionally answers 503 with a sentence rather than a bare 500,
  // because support-form.tsx renders j.error verbatim to the user.
  const support = source("app/api/support/route.ts");
  assert.match(support.slice(support.indexOf("export async function POST")), /if \(!hasDb\(\)\)[\s\S]{0,240}status: 503/);
});

test("test scripts avoid bash-only env prefixes so they run on Windows", () => {
  const pkg = JSON.parse(source("package.json"));
  for (const [name, cmd] of Object.entries(pkg.scripts as Record<string, string>)) {
    if (!name.startsWith("test")) continue;
    assert.doesNotMatch(cmd, /^[A-Z_]+=/, `${name} uses a bash-only VAR=value prefix`);
  }
  // Every suite in tests/ needs a way to run; resume-market-rules had none.
  assert.ok(pkg.scripts["test:market-rules"]);
  assert.ok(pkg.scripts.test);
});
