import { rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const workspace = resolve(process.cwd());
const distDir = ".next-playwright";
const disposableCache = resolve(workspace, distDir);

if (dirname(disposableCache) !== workspace || disposableCache === workspace) {
  throw new Error("invalid Playwright cache directory");
}

// This directory contains generated Next artifacts only. Clearing it before
// the server starts prevents stale/mixed dev and production manifests without
// allowing Playwright worker config reloads to remove a live server cache.
rmSync(disposableCache, { recursive: true, force: true });

// Resolve rather than join: a git worktree has no node_modules of its own and
// inherits the checkout's via Node's upward lookup. A hardcoded workspace path
// finds nothing there, so the Playwright dev server never starts.
const nextCli = createRequire(import.meta.url).resolve("next/dist/bin/next");
const child = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  cwd: workspace,
  env: { ...process.env, JOBS_QA_DIST_DIR: distDir },
  shell: false,
  stdio: "inherit",
});

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    shuttingDown = true;
    child.kill(signal);
  });
}

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code) => {
  process.exit(shuttingDown ? 0 : (code ?? 1));
});
