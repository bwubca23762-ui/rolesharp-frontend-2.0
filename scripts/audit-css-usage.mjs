import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath, not .pathname: a URL pathname is percent-encoded, so any
// checkout under a directory with a space in its name ("Messages App" ->
// "Messages%20App") produced a path that does not exist and the audit crashed.
const root = fileURLToPath(new URL("..", import.meta.url));
const cssEntryPath = join(root, "app", "globals-compat.css");
// Not just the JS module graph. Markup lives in more than .tsx here — the
// communications outbox ships HTML email templates inside a SQL migration, and
// content files carry markup too. A class named only outside .ts/.tsx is still
// a class in use, and a corpus that cannot see it reports the rule as dead.
const sourceExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs",
  ".md", ".mdx", ".html", ".sql", ".py", ".json", ".yml", ".yaml",
]);

function cssBundle(path, seen = new Set()) {
  if (seen.has(path)) return "";
  seen.add(path);
  const css = readFileSync(path, "utf8");
  const imports = [...css.matchAll(/@import\s+["']([^"']+)["'];/g)];
  const separator = path.includes("\\") ? "\\" : "/";
  const directory = path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")));
  const imported = imports.map((match) => cssBundle(join(directory, match[1].replaceAll("/", separator)), seen)).join("\n");
  return `${imported}\n${css.replace(/@import\s+["'][^"']+["'];/g, "")}`;
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      // Skip every dot-directory, not just .next/.git. .claude/worktrees holds
      // full checkouts of the repo: descending into them counted every class
      // twice and crashed outright on the linked node_modules inside one.
      if (name.startsWith(".") || name === "node_modules") return [];
      return files(path);
    }
    return sourceExtensions.has(extname(name)) ? [path] : [];
  });
}

const source = files(root)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const css = cssBundle(cssEntryPath);
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const selectorClasses = new Set(
  [...cssWithoutComments.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)].map((match) => match[1]),
);

// Two ways a reachability check lies, both of which shipped wrong answers here
// before. Neither is theoretical: trap 1 hid dead rules behind live ones and
// would have kept them forever, and trap 2 came within a commit of deleting
// live CSS.
//
// Trap 1 — substring matching. `source.includes("admin-sidebar")` is satisfied
// by `admin-sidebar-close`, so a class whose only "use" is being a prefix of
// another class reads as reachable. Match on token boundaries instead, the way
// the repo's own guards already do.
const referenced = (className) =>
  new RegExp(`(?<![\\w-])${className.replace(/[-\\^$*+?.()|[\]{}]/g, "\\$&")}(?![\\w-])`).test(source);

// Trap 2 — interpolation. `t-compact`, `tone-blue`, `toast-success` and
// `photo-rule-customary` appear nowhere in the repo as literals and are all
// live: they are built as `t-${template}` and friends. Collect the prefixes
// that precede an interpolation or a concatenation, and treat any class
// starting with one as reachable.
const dynamicPrefixes = [...new Set([
  ...[...source.matchAll(/([a-zA-Z][\w-]*-)\$\{/g)].map((match) => match[1]),
  ...[...source.matchAll(/["']([a-zA-Z][\w-]*-)["']\s*\+/g)].map((match) => match[1]),
])];
const builtDynamically = (className) =>
  dynamicPrefixes.some((prefix) => className.startsWith(prefix) && className !== prefix);

const used = [];
const dynamic = [];
const review = [];
for (const className of selectorClasses) {
  if (referenced(className)) used.push(className);
  else if (builtDynamically(className)) dynamic.push(className);
  else review.push(className);
}

console.log(JSON.stringify({
  stylesheet: relative(root, cssEntryPath),
  bytes: Buffer.byteLength(css),
  selectorClasses: selectorClasses.size,
  directlyReferencedClasses: used.length,
  dynamicallyBuiltClasses: dynamic.length,
  reviewCandidates: review.length,
  note: "Review candidates are named nowhere in the corpus and match no interpolation prefix. Confirm against a rendered route before deleting: the corpus is source only, so a class produced by a dependency or by markup this scan cannot see would land here.",
  dynamicPrefixes,
  reviewCandidateList: review.sort(),
}, null, 2));
