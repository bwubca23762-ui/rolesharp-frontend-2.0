import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getEntitlement } from "@/lib/entitlements";
import { rateLimit } from "@/lib/rate-limit";
import { chat } from "@/lib/llm";
import { z } from "zod";
import { createHash } from "crypto";
import { spendActionCredit, refundActionCredit } from "@/lib/credits";
import { q, withTransaction } from "@/lib/db";
import { humanizeResumeText } from "@/lib/ai-humanizer";

export const runtime = "nodejs";

const Body = z.object({
  bullet: z.string().min(3).max(400),
  role: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

// Rewrites a single resume bullet into a stronger, ATS-friendly, metric-led
// line. Kept tiny + fast so it can be called per-bullet from the builder.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "improve", 30);
  if (!limited.ok)
    return NextResponse.json({ error: "Slow down a moment and try again." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });

  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Write a bit more first." }, { status: 400 });
  const { bullet, role, company, idempotencyKey } = parsed.data;
  const requestHash = createHash("sha256")
    .update(JSON.stringify({ bullet, role: role ?? null, company: company ?? null }))
    .digest("hex");
  if (idempotencyKey) {
    const prior = (await q<{ request_hash: string; status: string; response: { improved?: string } | null }>(
      `select request_hash,status,response from action_idempotency
       where user_id=$1 and action_kind='improve' and idempotency_key=$2::uuid`,
      [user.id, idempotencyKey],
    ))[0];
    if (prior && prior.request_hash !== requestHash) {
      return NextResponse.json({ error: "idempotency_key_reused" }, { status: 409 });
    }
    if (prior?.status === "completed" && prior.response?.improved) {
      return NextResponse.json({ improved: prior.response.improved, replayed: true });
    }
  }

  const ent = await getEntitlement(user);
  // Free users without credits get Gemini; premium users and credit spenders get Claude
  let creditEventId: number | null = null;
  if (!ent.premium && ent.credits > 0) {
    if (!idempotencyKey) {
      return NextResponse.json({ error: "idempotency_key_required" }, { status: 400 });
    }
    creditEventId = await withTransaction(async (query) => {
      const receipt = (await query<{ request_hash: string; credit_event_id: number | null }>(
        `insert into action_idempotency(user_id,action_kind,idempotency_key,request_hash)
         values($1,'improve',$2::uuid,$3)
         on conflict(user_id,action_kind,idempotency_key) do update
           set updated_at=action_idempotency.updated_at
         returning request_hash,credit_event_id`,
        [user.id, idempotencyKey, requestHash],
      ))[0];
      if (!receipt || receipt.request_hash !== requestHash) throw new Error("idempotency_key_reused");
      if (receipt.credit_event_id) return receipt.credit_event_id;
      const eventId = await spendActionCredit(user.id, idempotencyKey, "improve_spend", query);
      if (!eventId) return null;
      await query(
        `update action_idempotency set credit_event_id=$4,updated_at=now()
         where user_id=$1 and action_kind='improve' and idempotency_key=$2::uuid and request_hash=$3`,
        [user.id, idempotencyKey, requestHash, eventId],
      );
      return eventId;
    }).catch((error) => {
      if (error instanceof Error && error.message === "idempotency_key_reused") return -1;
      throw error;
    });
    if (creditEventId === -1) return NextResponse.json({ error: "idempotency_key_reused" }, { status: 409 });
  }
  const model = ent.premium || !!creditEventId ? "claude" : "gemini";

  const context = [
    role ? `Target role: ${role}.` : "",
    company ? `Target company: ${company}.` : "",
  ].filter(Boolean).join(" ");

  const sys =
    "You rewrite a single resume bullet point. Return ONLY the improved bullet as plain text — no quotes, no preamble, no list marker. " +
    "Start with a strong past-tense action verb, keep it to one line (under ~30 words), make it concrete and results-oriented, " +
    "and add a realistic metric ONLY if one is clearly implied — never invent specific numbers that aren't supported. Keep the candidate's real meaning.";

  try {
    const out = await chat(
      [
        { role: "system", content: sys },
        { role: "user", content: `${context}\n\nOriginal bullet:\n${bullet}\n\nImproved bullet:` },
      ],
      { model: model, temperature: 0.5 },
    );
    const improved = String(out || "").replace(/^["'\-•\s]+/, "").replace(/["']+$/, "").trim().split("\n")[0].slice(0, 400);
    if (!improved) {
      if (creditEventId) await refundActionCredit(user.id, creditEventId).catch(() => null);
      if (idempotencyKey) await q(
        `update action_idempotency set status='failed',credit_event_id=null,updated_at=now()
         where user_id=$1 and action_kind='improve' and idempotency_key=$2::uuid`,
        [user.id, idempotencyKey],
      ).catch(() => null);
      return NextResponse.json({ error: "Could not improve that bullet. Try again." }, { status: 502 });
    }
    // Deterministic de-AI pass: the improved bullet must not read as more
    // machine-written than the original (LLM output can add cliché verbs).
    const cleaned = humanizeResumeText(improved).text.trim() || improved;
    if (idempotencyKey) {
      await q(
        `update action_idempotency set status='completed',response=$4,updated_at=now()
         where user_id=$1 and action_kind='improve' and idempotency_key=$2::uuid and request_hash=$3`,
        [user.id, idempotencyKey, requestHash, JSON.stringify({ improved: cleaned })],
      );
    }
    return NextResponse.json({ improved: cleaned });
  } catch (e) {
    if (creditEventId) await refundActionCredit(user.id, creditEventId).catch(() => null);
    if (idempotencyKey) await q(
      `update action_idempotency set status='failed',credit_event_id=null,updated_at=now()
       where user_id=$1 and action_kind='improve' and idempotency_key=$2::uuid`,
      [user.id, idempotencyKey],
    ).catch(() => null);
    console.error("[improve] failed", e);
    return NextResponse.json({ error: "AI is busy. Try again in a moment." }, { status: 502 });
  }
}
