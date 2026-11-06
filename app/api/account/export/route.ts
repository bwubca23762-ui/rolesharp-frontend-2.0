import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildAccountExport } from "@/lib/account-export";

export const runtime = "nodejs";

// Data portability (privacy policy §"Your rights and choices"). GET, not POST:
// this reads and returns the caller's own rows and changes nothing, so it needs
// no origin guard — but it is rate limited, because it is by far the most
// expensive read an authenticated user can ask for.
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const limited = await rateLimit(req, "account-export", 3, 60 * 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many export requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  try {
    const data = await buildAccountExport(user.id, user.email);
    const stamp = new Date().toISOString();
    const body = JSON.stringify({ ...data, generatedAt: stamp }, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // A download, not a page. The filename carries the date so a user with
        // several exports can tell them apart.
        "Content-Disposition": `attachment; filename="rolesharp-export-${stamp.slice(0, 10)}.json"`,
        // Never let a shared cache hold one user's entire account.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    // Names and messages only, consistent with the rest of the app: an export
    // failure must not echo a query or a row into the log.
    console.error("account export failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "export_unavailable" }, { status: 500 });
  }
}
