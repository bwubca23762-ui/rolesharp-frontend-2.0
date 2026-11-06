import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/auth";
import { deleteUserResume, duplicateUserResume, getFailedGeneration, getUserResume, renameUserResume } from "@/lib/db";
import { env } from "@/lib/env";
import { getDevUserResume, deleteDevUserResume, saveDevResume, updateDevResume } from "@/lib/local-dev-store";

export const runtime = "nodejs";

// Fetch a resume for preview. Ownership-scoped (getUserResume filters on
// user_id_text), and the content returned is the caller's OWN resume — the
// live preview needs it. Monetization is enforced at export time instead:
// PDF watermarks free users, DOCX returns 402 without premium. The `paid`
// flag is legacy (old per-resume payment model).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { id } = await params;
  const r = await (env.localDevMode ? getDevUserResume(id, user.id) : getUserResume(id, user.id));
  if (!r) {
    // 404 is ambiguous between "the worker is still writing" and "the
    // generation job died for good". When the idempotency claim says the job
    // failed permanently, answer 422 so the builder can stop polling
    // immediately instead of burning the full retry window on a dead id.
    if (!env.localDevMode) {
      const claim = await getFailedGeneration(id).catch(() => null);
      if (claim === "failed") return NextResponse.json({ error: "generation_failed", failed: true }, { status: 422 });
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: r.id,
    content: r.content,
    atsScore: "ats_score" in r ? r.ats_score : r.atsScore,
    paid: "paid" in r ? r.paid : true,
    candidateName: ("candidate_name" in r ? r.candidate_name : r.candidateName) ?? r.content?.headline ?? "Resume",
    premiumUnlock: ("premium_unlock" in r ? r.premium_unlock : r.premiumUnlock) ?? false,
    // Already-generated add-ons, so /resumes/[id] can render them on load.
    // Without these the only way to re-read a saved cover letter was to re-POST
    // /api/cover, which 402s for a user who generated it while premium and has
    // since lapsed: their own saved work paywalled back off them.
    coverLetter: ("cover_letter" in r ? r.cover_letter : r.coverLetter) ?? null,
    linkedin: r.linkedin ?? null,
    interview: r.interview ?? null,
  });
}

// Delete a resume. Owner-scoped.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { id } = await params;
  const ok = await (env.localDevMode ? deleteDevUserResume(id, user.id) : deleteUserResume(id, user.id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Rename a resume (display label only). Owner-scoped.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { id } = await params;
  const { name } = await req.json().catch(() => ({}));
  const clean = String(name ?? "").trim().slice(0, 120);
  if (!clean) return NextResponse.json({ error: "name_required" }, { status: 400 });

  if (env.localDevMode) {
    const existing = await getDevUserResume(id, user.id);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const updated = await updateDevResume(id, { candidateName: clean });
    return NextResponse.json({ ok: true, name: updated?.candidateName ?? clean });
  }

  const ok = await renameUserResume(id, user.id, clean);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, name: clean });
}

// Duplicate a resume into an independent fork (new id, copied content and
// add-ons). This is the versioning primitive for tailoring per job.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });
  const { id } = await params;

  if (env.localDevMode) {
    const existing = await getDevUserResume(id, user.id);
    if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
    const newId = randomUUID();
    const copy = { ...existing } as Partial<typeof existing>;
    delete copy.createdAt;
    await saveDevResume({
      ...(copy as typeof existing),
      id: newId,
      candidateName: `${existing.candidateName} (copy)`.slice(0, 120),
    });
    return NextResponse.json({ ok: true, id: newId });
  }

  const newId = await duplicateUserResume(id, user.id, randomUUID());
  if (!newId) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: newId });
}
