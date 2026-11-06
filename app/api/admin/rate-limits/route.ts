import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { connection } from "@/lib/queue";

export const runtime = "nodejs";

const MAX_KEYS = 200;

export async function GET() {
  if (!(await hasAdminPermission("security.read"))) return NextResponse.json({ error: "admin_required" }, { status: 403 });
  try {
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, page] = await connection.scan(cursor, "MATCH", "rl:*", "COUNT", 100);
      cursor = next;
      for (const key of page) {
        keys.push(key);
        if (keys.length >= MAX_KEYS) break;
      }
    } while (cursor !== "0" && keys.length < MAX_KEYS);

    const pipeline = connection.pipeline();
    for (const key of keys) pipeline.get(key).ttl(key);
    const values = await pipeline.exec();
    const results = keys.map((key, index) => ({
      key: key.replace("rl:", ""),
      hits: Number(values?.[index * 2]?.[1] || 0),
      ttl_sec: Number(values?.[index * 2 + 1]?.[1] ?? -1),
    })).sort((a, b) => b.hits - a.hits);

    return NextResponse.json({ limits: results.slice(0, 50), scanned: keys.length, truncated: cursor !== "0" });
  } catch (error) {
    return NextResponse.json(
      { error: "redis_unavailable", detail: error instanceof Error ? error.message : "unknown_error" },
      { status: 503 },
    );
  }
}
