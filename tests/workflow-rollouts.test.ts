import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";

const databaseUrl = process.env.ROLESHARP_TEST_DATABASE_URL;
test("workflow rollout cohorts are stable, monotonic, and respect the enable switch", { skip: !databaseUrl }, async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(databaseUrl!).hostname));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    const cohort = async (percent: number) => {
      await client.query("update feature_flags set enabled=true,rollout_percent=$1 where name='jobs_daily_matches'", [percent]);
      return (await client.query<{ n: number }>("select n from generate_series(1,1000) n where workflow_rollout_allows('jobs_daily_matches',md5(n::text)::uuid) order by n")).rows.map((row) => row.n);
    };
    assert.equal((await cohort(0)).length, 0);
    assert.equal((await cohort(100)).length, 1000);
    const quarter = await cohort(25);
    assert.ok(quarter.length > 150 && quarter.length < 350);
    assert.deepEqual(await cohort(25), quarter);
    const larger = new Set(await cohort(75));
    assert.ok(quarter.every((id) => larger.has(id)));
    await client.query("update feature_flags set enabled=false where name='jobs_daily_matches'");
    assert.equal((await client.query("select workflow_rollout_allows('jobs_daily_matches',md5('1')::uuid) allowed")).rows[0].allowed, false);
    assert.equal((await client.query("select workflow_rollout_allows('missing',md5('1')::uuid) allowed")).rows[0].allowed, false);
    assert.equal((await client.query("select workflow_rollout_allows('jobs_daily_matches',null) allowed")).rows[0].allowed, false);
  } finally { await client.query("rollback"); await client.end(); }
});
