#!/usr/bin/env node
// Privileged systemd control helper for the admin System panel.
//
// resume-web runs as the unprivileged `rolesharp` user with NoNewPrivileges=true.
// That is deliberate hardening, so the web process must NOT be given sudo. This
// daemon runs as root instead and exposes a fixed, tiny verb set over a unix
// socket. The access boundary is filesystem permissions: systemd starts this
// with Group=rolesharp, so the socket is group-owned by rolesharp and chmod 0660
// -- only root and the web process can talk to it.
//
// Safety properties, all of which matter because this runs as root:
//   * unit names are matched against ALLOWED_UNITS by exact string equality
//   * verbs are matched against ALLOWED_ACTIONS by exact string equality
//   * systemctl is invoked through execFile with an argv ARRAY, never a shell
//     string, so no input of any kind can reach a shell
//   * request bodies are capped and connections time out
//   * `list` is served from this file, so the web app cannot widen the allowlist
//     -- the daemon is the single source of truth and the two cannot drift
//
// Deliberately has no npm dependencies: less code running as root.

import { createServer } from "node:net";
import { execFile } from "node:child_process";
import { chmodSync, existsSync, unlinkSync } from "node:fs";
import { readdir, lstat } from "node:fs/promises";
import { join } from "node:path";

const SOCKET = process.env.ROLESHARP_OPS_SOCKET || "/run/rolesharp-ops.sock";
const MAX_REQUEST_BYTES = 4096;
const REQUEST_TIMEOUT_MS = 10_000;
const SYSTEMCTL_TIMEOUT_MS = 60_000;
// An encrypted pg_dump can outlive the systemctl verbs by minutes.
const BACKUP_TIMEOUT_MS = 300_000;

// Every unit the panel may touch. Anything not listed here is unreachable.
const ALLOWED_UNITS = [
  "resume-web",
  "resume-worker",
  "rolesharp-jobs",
  "rolesharp-recommendation-agent",
  "rolesharp-auto-apply-agent",
  "rolesharp-blog-worker",
  "nginx",
];

const ALLOWED_ACTIONS = new Set(["list", "status", "start", "stop", "restart", "reload", "backup", "backups", "logs"]);

// Stopping resume-web from the admin panel would take down the panel itself,
// leaving SSH as the only way back. Restart is allowed; stop is not.
const NO_STOP = new Set(["resume-web"]);

function execFileAsync2(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: !error, code: error ? (error.code ?? 1) : 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

function systemctl(args) {
  return new Promise((resolve) => {
    execFile("systemctl", args, { timeout: SYSTEMCTL_TIMEOUT_MS }, (error, stdout, stderr) => {
      resolve({ code: error?.code ?? 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

async function statusOf(unit) {
  const { stdout } = await systemctl([
    "show", unit,
    "--property=ActiveState",
    "--property=SubState",
    "--property=UnitFileState",
    "--property=ActiveEnterTimestamp",
    "--property=NRestarts",
    "--property=CanReload",
  ]);
  const props = Object.fromEntries(
    stdout.split("\n").filter(Boolean).map((line) => {
      const eq = line.indexOf("=");
      return [line.slice(0, eq), line.slice(eq + 1)];
    }),
  );
  return {
    unit,
    activeState: props.ActiveState || "unknown",
    subState: props.SubState || "unknown",
    unitFileState: props.UnitFileState || "unknown",
    activeEnterTimestamp: props.ActiveEnterTimestamp || "",
    restarts: Number(props.NRestarts || 0),
    canStop: !NO_STOP.has(unit),
    canReload: props.CanReload === "yes",
  };
}

async function handle(request) {
  const action = typeof request?.action === "string" ? request.action : "";
  if (!ALLOWED_ACTIONS.has(action)) return { ok: false, error: "unsupported_action" };

  if (action === "list") {
    return { ok: true, services: await Promise.all(ALLOWED_UNITS.map(statusOf)) };
  }

  if (action === "backups") {
    // Only metadata for completed encrypted archives. Callers cannot supply a
    // directory, follow symlinks, read archive bytes, or retrieve passphrases.
    const directory = process.env.ROLESHARP_BACKUP_DIR || "/opt/resume-ai/data/backups";
    const names = (await readdir(directory)).filter((name) => /^resumeai-\d{8}T\d{6}Z\.dump\.gpg$/.test(name)).sort().reverse().slice(0, 100);
    const snapshots = [];
    for (const name of names) {
      const stat = await lstat(join(directory, name));
      if (stat.isFile() && !stat.isSymbolicLink()) snapshots.push({ name, bytes: stat.size, createdAt: stat.mtime.toISOString() });
    }
    return { ok: true, snapshots };
  }

  // journalctl belongs to the root daemon: the unprivileged web process
  // cannot read other units' logs unless it is in the systemd-journal group,
  // and the redaction contract already lives server-side.
  if (action === "logs") {
    const unit = typeof request?.unit === "string" ? request.unit : "";
    if (!ALLOWED_UNITS.includes(unit)) return { ok: false, error: "unknown_unit" };
    const parsed = Math.trunc(Number(request?.lines));
    const lines = Number.isSafeInteger(parsed) ? Math.min(Math.max(parsed, 1), 200) : 100;
    const result = await execFileAsync2("journalctl", ["-u", unit, "--no-pager", "-n", String(lines), "-o", "cat"], 10_000);
    if (!result.ok) return { ok: false, error: "journalctl_failed", detail: result.stderr.slice(0, 200) };
    const trimmed = result.stdout.trim();
    return { ok: true, lines: trimmed ? trimmed.split("\n").slice(-lines) : [] };
  }

  // The root-owned backup helper streams and encrypts the dump before it
  // reaches disk, then verifies it with pg_restore -l. Keeping that separate
  // prevents this socket daemon from handling either archive bytes or the
  // encryption passphrase.
  if (action === "backup") {
    const result = await execFileAsync2("/usr/local/sbin/rolesharp-postgres-backup", ["--json"], BACKUP_TIMEOUT_MS);
    if (!result.ok) return { ok: false, error: "backup_failed", detail: result.stderr.slice(0, 300) };
    try {
      const payload = JSON.parse(result.stdout);
      if (payload?.ok && typeof payload.file === "string" && Number.isSafeInteger(payload.bytes)) return payload;
    } catch { /* report the fixed error below */ }
    return { ok: false, error: "backup_invalid_response" };
  }

  const unit = typeof request?.unit === "string" ? request.unit : "";
  if (!ALLOWED_UNITS.includes(unit)) return { ok: false, error: "unknown_unit" };
  if (action === "status") return { ok: true, service: await statusOf(unit) };
  if (action === "stop" && NO_STOP.has(unit)) return { ok: false, error: "stop_not_permitted_for_unit" };
  if (action === "reload" && !(await statusOf(unit)).canReload) return { ok: false, error: "reload_not_supported" };

  const result = await systemctl([action, unit]);
  if (result.code !== 0) {
    return { ok: false, error: "systemctl_failed", detail: (result.stderr || result.stdout).slice(0, 500).trim() };
  }
  return { ok: true, service: await statusOf(unit) };
}

const server = createServer((socket) => {
  let buffer = "";
  let done = false;
  let processing = false;
  // The deadline is fixed per request action: systemctl verbs finish in
  // seconds, a backup may stream for minutes. Read the request first, then
  // arm the matching timeout inside handle()'s flow — the socket-level timer
  // only protects against a client that never finishes its request.
  const timer = setTimeout(() => socket.destroy(), REQUEST_TIMEOUT_MS);
  const finish = (payload) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    try { socket.end(`${JSON.stringify(payload)}\n`); } catch {}
  };

  socket.setEncoding("utf8");
  socket.on("error", () => { clearTimeout(timer); });
  socket.on("data", (chunk) => {
    if (done || processing) return;
    buffer += chunk;
    if (buffer.length > MAX_REQUEST_BYTES) { finish({ ok: false, error: "request_too_large" }); return; }
    const newline = buffer.indexOf("\n");
    if (newline === -1) return;
    let request;
    try {
      request = JSON.parse(buffer.slice(0, newline));
    } catch {
      finish({ ok: false, error: "invalid_json" });
      return;
    }
    // The request is complete — the connection timer must NOT fire during a
    // long verb. A streamed backup legitimately takes minutes; its own
    // BACKUP_TIMEOUT bounds it, and systemctl verbs carry their own timeout.
    // From here the connection lives until the handler finishes or fails.
    clearTimeout(timer);
    processing = true;
    handle(request).then(finish).catch(() => finish({ ok: false, error: "helper_failure" }));
  });
});

if (existsSync(SOCKET)) unlinkSync(SOCKET);
server.listen(SOCKET, () => {
  // Group comes from the unit's Group=rolesharp; 0660 keeps everyone else out.
  chmodSync(SOCKET, 0o660);
  process.stdout.write(`rolesharp-ops-helper listening on ${SOCKET}\n`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close();
    if (existsSync(SOCKET)) { try { unlinkSync(SOCKET); } catch { /* already gone */ } }
    process.exit(0);
  });
}
