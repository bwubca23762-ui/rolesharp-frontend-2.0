import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { recoverExpiredCommunicationClaims } from "../lib/communications";

const databaseUrl = process.env.ROLESHARP_TEST_DATABASE_URL;

test("claim recovery preserves live leases and every provider-boundary outcome", { skip: !databaseUrl }, async () => {
  const url = new URL(databaseUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use a local disposable database");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    // Temporary tables shadow the real outbox; no account or campaign is changed.
    await client.query(`create temp table communication_recipients (
      id text primary key,status text,lease_owner text,lease_expires_at timestamptz,
      provider_call_started_at timestamptz,updated_at timestamptz default now()
    ) on commit drop;
    create temp table communication_attempts (recipient_id text) on commit drop;
    insert into communication_recipients(id,status,lease_owner,lease_expires_at,provider_call_started_at) values
      ('expired','claimed','old-worker',now()-interval '1 minute',null),
      ('live','claimed','current-worker',now()+interval '1 minute',null),
      ('attempted','claimed','old-worker',now()-interval '1 minute',null),
      ('sending','sending',null,null,now()),
      ('unknown','unknown',null,null,now()),
      ('failed','failed',null,null,now()),
      ('accepted','provider_accepted',null,null,now());
    insert into communication_attempts values('attempted');`);
    const query = async <T>(sql: string, params?: unknown[]) => (await client.query(sql, params)).rows as T[];
    assert.equal(await recoverExpiredCommunicationClaims(query), 1);
    const rows = (await client.query("select * from communication_recipients order by id")).rows;
    const recovered = rows.find((row) => row.id === "expired");
    assert.equal(recovered.status, "pending");
    assert.equal(recovered.lease_owner, null);
    assert.equal(recovered.lease_expires_at, null);
    assert.deepEqual(rows.filter((row) => row.id !== "expired").map((row) => [row.id, row.status]), [
      ["accepted", "provider_accepted"], ["attempted", "claimed"], ["failed", "failed"],
      ["live", "claimed"], ["sending", "sending"], ["unknown", "unknown"],
    ]);
    assert.equal(await recoverExpiredCommunicationClaims(query), 0, "Recovery is idempotent");
    await client.query(`insert into communication_recipients(id,status,lease_owner,lease_expires_at)
      select 'batch-'||n,'claimed','old-worker',now()-interval '1 minute' from generate_series(1,150) n`);
    assert.equal(await recoverExpiredCommunicationClaims(query), 100, "Recovery stays bounded per operation");
    assert.equal(await recoverExpiredCommunicationClaims(query), 50);
  } finally {
    await client.query("rollback");
    await client.end();
  }
});
