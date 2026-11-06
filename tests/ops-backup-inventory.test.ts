import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";
import { once } from "node:events";

test("ops inventory lists only regular encrypted snapshots and accepts no caller path", { timeout: 15000 }, async (t) => {
  if (process.platform === "win32") {
    t.skip("UNIX domain socket and unprivileged symlinks not supported on win32");
    return;
  }
  const directory = await mkdtemp(join(tmpdir(), "rs-ops-inventory-"));
  const backups = join(directory, "backups");
  const socket = join(directory, "ops.sock");
  await mkdir(backups);
  await writeFile(join(backups, "resumeai-20261104T120000Z.dump.gpg"), "encrypted-fixture");
  await writeFile(join(backups, "plaintext.dump"), "private");
  await symlink(join(backups, "plaintext.dump"), join(backups, "resumeai-20261105T120000Z.dump.gpg"));
  const child = spawn(process.execPath, ["scripts/ops-helper.mjs"], { env: { ...process.env, ROLESHARP_OPS_SOCKET: socket, ROLESHARP_BACKUP_DIR: backups }, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await Promise.race([once(child.stdout!, "data"), once(child, "exit").then(() => { throw new Error("helper exited before listening"); })]);
    const response = await new Promise<{ ok: boolean; snapshots: Array<{ name: string; bytes: number; createdAt: string }> }>((resolve, reject) => {
      const client = connect(socket);
      let buffer = "";
      client.setTimeout(5000, () => client.destroy(new Error("inventory timeout")));
      client.on("error", reject);
      client.on("connect", () => client.write(JSON.stringify({ action: "backups", directory: "/", path: "/" }) + "\n"));
      client.on("data", (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes("\n")) { client.destroy(); resolve(JSON.parse(buffer.split("\n")[0])); }
      });
    });
    assert.equal(response.ok, true);
    assert.deepEqual(response.snapshots.map((entry) => entry.name), ["resumeai-20261104T120000Z.dump.gpg"]);
    assert.equal(response.snapshots[0].bytes, 17);
    assert.ok(Number.isFinite(Date.parse(response.snapshots[0].createdAt)));
  } finally {
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit");
    await rm(directory, { recursive: true, force: true });
  }
});
