import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const databaseUrl = process.env.ROLESHARP_TEST_DATABASE_URL;
test("sector expansion is staggered, idempotent, and preserves operator settings", { skip: !databaseUrl }, async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(databaseUrl!).hostname));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query("begin");
    await client.query("create temporary table job_search_profiles (like public.job_search_profiles including defaults including constraints including indexes) on commit drop");
    await client.query("insert into job_search_profiles(country_code,country_name,location,search_term,providers,refresh_hours,enabled) values('IN','India','India','software engineer','{indeed}',6,true),('IN','India','Mumbai','healthcare','{linkedin}',72,false),('BD','Bangladesh','Bangladesh','sales','{indeed}',24,true)");
    const migration = readFileSync(new URL("../db/migrations/080_expand_job_sector_profiles.sql", import.meta.url), "utf8");
    await client.query(migration);
    const rows = (await client.query("select * from job_search_profiles order by id")).rows;
    assert.equal(rows.length, 8);
    const existing = rows.find((row) => row.search_term === "healthcare");
    assert.equal(existing.enabled, false);
    assert.equal(existing.location, "Mumbai");
    assert.equal(existing.refresh_hours, 72);
    const added = rows.filter((row) => ["education", "logistics", "hospitality", "retail", "operations"].includes(row.search_term));
    assert.equal(added.length, 5);
    assert.ok(added.every((row) => row.refresh_hours === 24 && row.next_run_at > new Date()));
    assert.equal(new Set(added.map((row) => row.next_run_at.toISOString())).size, 5);
    await client.query(migration);
    assert.equal((await client.query("select count(*)::int n from job_search_profiles")).rows[0].n, rows.length);
  } finally { await client.query("rollback"); await client.end(); }
});
