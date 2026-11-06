import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertFakeTransportIsIsolated,
  createFakeMailboxFetch,
  createLocalNotificationTransport,
} from "../lib/jobs-workflow/local-sink";

function configure(directory: string, runId = "smoke-test-0001") {
  Object.assign(process.env, {
    JOBS_SMOKE_MODE: "true",
    JOBS_SMOKE_RUN_ID: runId,
    JOBS_SMOKE_SINK_DIR: join(directory, runId),
    JOB_WORKFLOW_NAMESPACE: `smoke-${runId}`,
    QUEUE_PREFIX: `rolesharp:smoke:${runId}:`,
  });
}

test("fake transports fail closed outside an isolated smoke namespace", () => {
  configure(tmpdir());
  process.env.JOBS_SMOKE_MODE = "false";
  assert.throws(assertFakeTransportIsIsolated, /fake_transport_requires_jobs_smoke_mode/u);
  process.env.JOBS_SMOKE_MODE = "true";
  process.env.QUEUE_PREFIX = "rolesharp:production:";
  assert.throws(assertFakeTransportIsIsolated, /isolated_queue_prefix/u);
});

test("local sinks persist hashes and sizes without message content or credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "rolesharp-local-sink-"));
  const runId = "smoke-test-0002";
  configure(root, runId);
  const recipient = "private-recipient@example.test";
  const subject = "Private subject";
  const body = "Private body with candidate details";
  const refreshToken = "private-refresh-token";
  try {
    const notification = createLocalNotificationTransport("00000000-0000-4000-8000-000000000001");
    assert.equal(await notification({ to: recipient, subject, text: body, html: `<p>${body}</p>`, type: "daily_matches" }), "queued");
    const fakeFetch = createFakeMailboxFetch("00000000-0000-4000-8000-000000000002");
    const refresh = await fakeFetch("https://oauth2.googleapis.com/token", { method: "POST", body: `refresh_token=${refreshToken}` });
    assert.equal(refresh.status, 200);
    const send = await fakeFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", body: JSON.stringify({ raw: Buffer.from(`${recipient}:${subject}:${body}`).toString("base64url") }),
    });
    assert.equal(send.status, 200);
    const microsoftRefresh = await fakeFetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST", body: `refresh_token=${refreshToken}`,
    });
    assert.equal(microsoftRefresh.status, 200);
    const microsoftSend = await fakeFetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST", body: JSON.stringify({ message: { subject, body, toRecipients: [{ emailAddress: { address: recipient } }] } }),
    });
    assert.equal(microsoftSend.status, 202);
    const source = await readFile(join(root, runId, "events.jsonl"), "utf8");
    assert.doesNotMatch(source, new RegExp([recipient, subject, body, refreshToken].join("|"), "u"));
    const events = source.trim().split("\n").map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(events.map(({ kind }) => kind), [
      "notification", "mail_refresh", "mail_send", "mail_refresh", "mail_send",
    ]);
    for (const event of events) {
      assert.match(String(event.payloadHash), /^[0-9a-f]{64}$/u);
      assert.match(String(event.referenceHash), /^[0-9a-f]{64}$/u);
      assert.equal("payload" in event, false);
    }
    await assert.rejects(fakeFetch("https://example.test/unexpected"), /blocked_unexpected_endpoint/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
