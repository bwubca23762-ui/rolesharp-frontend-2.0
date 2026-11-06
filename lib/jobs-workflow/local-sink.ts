import { createHash } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";

type NotificationMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  type?: string;
};

type SinkKind = "notification" | "mail_refresh" | "mail_send";

const RUN_ID = /^[a-z0-9][a-z0-9-]{7,63}$/u;

function digest(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function smokeSinkConfiguration() {
  const runId = process.env.JOBS_SMOKE_RUN_ID ?? "";
  const namespace = process.env.JOB_WORKFLOW_NAMESPACE ?? "";
  const queuePrefix = process.env.QUEUE_PREFIX ?? "";
  const sinkDirectory = process.env.JOBS_SMOKE_SINK_DIR ?? "";
  if (process.env.JOBS_SMOKE_MODE !== "true") throw new Error("fake_transport_requires_jobs_smoke_mode");
  if (!RUN_ID.test(runId)) throw new Error("invalid_jobs_smoke_run_id");
  if (namespace !== `smoke-${runId}`) throw new Error("fake_transport_requires_isolated_namespace");
  if (queuePrefix !== `rolesharp:smoke:${runId}:`) throw new Error("fake_transport_requires_isolated_queue_prefix");
  if (!isAbsolute(sinkDirectory)) throw new Error("jobs_smoke_sink_dir_must_be_absolute");
  const directory = resolve(sinkDirectory);
  if (!directory.split(sep).includes(runId)) throw new Error("jobs_smoke_sink_dir_must_include_run_id_segment");
  return { runId, directory };
}

export function assertFakeTransportIsIsolated(): void {
  smokeSinkConfiguration();
}

async function writeEvent(input: {
  kind: SinkKind;
  reference: string;
  payload: string;
  metadata: Record<string, string | number>;
}): Promise<void> {
  const { runId, directory } = smokeSinkConfiguration();
  await mkdir(directory, { recursive: true, mode: 0o750 });
  const event = {
    schema: "rolesharp-local-sink-v1",
    kind: input.kind,
    runId,
    referenceHash: digest(`${runId}:${input.reference}`),
    payloadHash: digest(input.payload),
    payloadBytes: Buffer.byteLength(input.payload),
    ...input.metadata,
  };
  await appendFile(resolve(directory, "events.jsonl"), `${JSON.stringify(event)}\n`, {
    encoding: "utf8",
    mode: 0o640,
  });
}

export function createLocalNotificationTransport(outboxId: string) {
  assertFakeTransportIsIsolated();
  return async (message: NotificationMessage): Promise<"queued"> => {
    const payload = JSON.stringify({
      to: digest(message.to.toLowerCase()),
      subject: digest(message.subject),
      text: digest(message.text),
      html: digest(message.html),
    });
    await writeEvent({
      kind: "notification",
      reference: outboxId,
      payload,
      metadata: {
        recipientHash: digest(message.to.toLowerCase()),
        subjectHash: digest(message.subject),
        textHash: digest(message.text),
        htmlHash: digest(message.html),
        textBytes: Buffer.byteLength(message.text),
        htmlBytes: Buffer.byteLength(message.html),
        messageTypeHash: digest(message.type ?? "transactional"),
      },
    });
    return "queued";
  };
}

export function createFakeMailboxFetch(attemptId: string): typeof fetch {
  assertFakeTransportIsIsolated();
  return async (request, init) => {
    const url = String(request);
    const body = typeof init?.body === "string" ? init.body : "";
    if (url === "https://oauth2.googleapis.com/token" ||
        url === "https://login.microsoftonline.com/common/oauth2/v2.0/token") {
      await writeEvent({
        kind: "mail_refresh",
        reference: attemptId,
        payload: body,
        metadata: { providerHash: digest(url), requestBytes: Buffer.byteLength(body) },
      });
      return new Response(JSON.stringify({ access_token: `local-sink-${digest(attemptId).slice(0, 20)}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send") {
      await writeEvent({
        kind: "mail_send",
        reference: attemptId,
        payload: body,
        metadata: { providerHash: digest("google"), requestBytes: Buffer.byteLength(body) },
      });
      const id = digest(`${attemptId}:google`).slice(0, 24);
      return new Response(JSON.stringify({ id, threadId: digest(`${attemptId}:thread`).slice(0, 24) }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "https://graph.microsoft.com/v1.0/me/sendMail") {
      await writeEvent({
        kind: "mail_send",
        reference: attemptId,
        payload: body,
        metadata: { providerHash: digest("microsoft"), requestBytes: Buffer.byteLength(body) },
      });
      return new Response(null, { status: 202 });
    }
    throw new Error(`fake_mail_adapter_blocked_unexpected_endpoint:${digest(url)}`);
  };
}
