// Cross-platform component-test runner. Discovers *.test.ts under
// components/ui/primitives/__tests__ (and any future __tests__ dirs under
// components/) using the filesystem — no shell glob expansion, so it is
// equally reliable under cmd.exe, PowerShell, and bash on Windows.
//
// Mirrors the project convention: node:test + tsx transpile.
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();

function collectTestFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      collectTestFiles(full, acc);
    } else if (name.endsWith(".test.ts") || name.endsWith(".test.tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

const files = collectTestFiles(join(root, "components"));

if (!files.length) {
  console.error("[test:components] no *.test.ts files found under components/");
  process.exit(1);
}

console.log(`[test:components] running ${files.length} test file(s):`);
for (const f of files) console.log(`  - ${relative(root, f)}`);

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
  env: { ...process.env, NODE_OPTIONS: "" },
});

process.exit(result.status ?? 1);
