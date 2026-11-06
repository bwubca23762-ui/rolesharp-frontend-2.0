import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const HELPER = "scripts/ops-helper.mjs";
const ROUTE = "app/api/admin/services/route.ts";
const UNIT = "deploy/rolesharp-ops-helper.service";

// This helper runs as root. Every assertion below is load-bearing: the whole
// design rests on the web process being unable to reach anything except a fixed
// verb set, and on no input ever reaching a shell.

test("the ops helper never lets input reach a shell", () => {
  const helper = source(HELPER);
  assert.match(helper, /execFile\(\s*"systemctl"\s*,\s*args\s*,/u, "systemctl must be called via execFile with an argv array");
  assert.doesNotMatch(helper, /\bexecSync\b|\bspawnSync\b/u, "no synchronous shell helpers");
  assert.doesNotMatch(helper, /shell:\s*true/u, "execFile must never be given shell: true");
  // `exec(` would interpolate into /bin/sh; execFile( is the safe one.
  assert.doesNotMatch(helper, /[^a-zA-Z]exec\(/u, "child_process.exec must not be used");
});

test("the ops helper validates unit and action against fixed allowlists", () => {
  const helper = source(HELPER);
  assert.match(helper, /ALLOWED_UNITS\.includes\(unit\)/u, "unit must be checked against the allowlist");
  assert.match(helper, /ALLOWED_ACTIONS\.has\(action\)/u, "action must be checked against the allowlist");
  // Anything not explicitly listed has to be unreachable, so the checks must
  // reject rather than fall through.
  assert.match(helper, /return \{ ok: false, error: "unknown_unit" \}/u);
  assert.match(helper, /return \{ ok: false, error: "unsupported_action" \}/u);
});

test("resume-web cannot be stopped from the panel that it serves", () => {
  const helper = source(HELPER);
  // Stopping it would take down the admin panel and leave SSH as the only way
  // back. Restart stays available.
  assert.match(helper, /const NO_STOP = new Set\(\["resume-web"\]\)/u);
  assert.match(helper, /action === "stop" && NO_STOP\.has\(unit\)/u);
});

test("the socket is not world accessible", () => {
  const helper = source(HELPER);
  const unit = source(UNIT);
  assert.match(helper, /chmodSync\(SOCKET, 0o660\)/u, "socket must be group-only");
  // The group is what makes 0660 reach the web user, and it comes from systemd.
  assert.match(unit, /^Group=rolesharp$/mu, "helper must run with the rolesharp group");
  assert.match(unit, /^User=root$/mu, "helper needs root to drive systemctl");
});

test("service control requires system.manage and is audited", () => {
  const route = source(ROUTE);
  assert.match(route, /hasAdminPermission\("system\.manage"\)/u, "mutations must require system.manage");
  assert.match(route, /hasAdminPermission\("system\.read"\)/u, "reads must still require system.read");
  assert.match(route, /mutationOriginAllowed\(req\)/u, "mutations must be CSRF-guarded");
  assert.match(route, /recordAdminAction\("service_control"/u, "every action must be audited");
  // The audit call sits before the failure return so refused actions are logged
  // too -- a denied restart of a production service is worth recording.
  assert.ok(
    route.indexOf("recordAdminAction") < route.indexOf("if (!result.ok)"),
    "the audit record must be written before the error return",
  );
});

test("resume-web keeps NoNewPrivileges, so the helper is the only escalation path", () => {
  // If this regresses, someone has given the web process sudo and the helper's
  // allowlist stops being a boundary at all.
  assert.match(source("deploy/resume-web.service"), /^NoNewPrivileges=true$/mu);
});
