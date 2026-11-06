import { createHash } from "node:crypto";
import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

async function main(): Promise<void> {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const result = await client.query<{ definition: string }>(`
    select concat_ws('|', c.relkind, n.nspname, c.relname,
      coalesce(pg_get_viewdef(c.oid, true), ''),
      coalesce((select string_agg(pg_get_constraintdef(x.oid, true), ',' order by x.conname)
        from pg_constraint x where x.conrelid=c.oid), '')) definition
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','i','S')
    union all
    select concat_ws('|', 'column', table_name, ordinal_position, column_name,
      data_type, udt_name, is_nullable, coalesce(column_default, ''),
      is_generated, coalesce(generation_expression, ''))
    from information_schema.columns where table_schema='public'
    union all
    select 'index|' || pg_get_indexdef(i.indexrelid)
    from pg_index i
    join pg_class c on c.oid=i.indexrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    union all
    select 'function|' || p.oid::regprocedure::text || '|' || pg_get_functiondef(p.oid)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind <> 'a'
    union all
    select 'trigger|' || event_object_table || '|' || trigger_name || '|' ||
      action_timing || '|' || event_manipulation || '|' || action_statement
    from information_schema.triggers where trigger_schema='public'
    order by definition`);
    process.stdout.write(`${createHash("sha256").update(result.rows.map(({ definition }) => definition).join("\n")).digest("hex")}\n`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "schema_digest_failed");
  process.exitCode = 1;
});
