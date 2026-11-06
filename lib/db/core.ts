import { Pool } from "pg";
import { env } from "../env";

// One shared pool. The web process and worker share the VPS with PostgreSQL,
// so callers should combine independent metrics instead of opening large
// bursts of queries.
const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // The trigram indexes can only serve pg_trgm's % operator;
      // `similarity(a, b) > x` cannot use them, which is why company search was
      // scanning all 113k rows. % compares against this GUC rather than a
      // literal, so it has to sit at or below the lowest threshold any search
      // uses (0.16, in searchCompanies) for the indexed prefilter to stay a
      // superset of the exact similarity() filter that still follows it.
      // Lowering it only widens what the index offers; it never widens results.
      options: "-c pg_trgm.similarity_threshold=0.16",
    })
  : null;

pool?.on("error", (error) => {
  // pg emits idle-client failures on the pool. Without a listener Node treats
  // this as an unhandled EventEmitter error and can terminate the process.
  console.error("[postgres:pool] idle client error", {
    name: error.name,
    code: "code" in error ? error.code : undefined,
  });
});

export function hasDb() {
  return Boolean(pool);
}

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  if (!pool) return [];
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export type TransactionQuery = <T = any>(text: string, params?: any[]) => Promise<T[]>;

export async function withTransaction<T>(work: (query: TransactionQuery) => Promise<T>): Promise<T> {
  if (!pool) throw new Error("Database is not configured");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const query: TransactionQuery = async <R = any>(text: string, params: any[] = []) => {
      const result = await client.query(text, params);
      return result.rows as R[];
    };
    const value = await work(query);
    await client.query("commit");
    return value;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
