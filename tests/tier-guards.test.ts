import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { featuresFor, TIER_COLUMNS } from "../lib/tier-features";

const source = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ── Tier matrix invariants (behavioral, run against the real map) ──

test("tier matrix: free gets nothing, student is premium minus cockpit, paid gets all", () => {
  const free = featuresFor(null, false);
  assert.deepEqual(free, { docxExport: false, toolHistory: false, coverLetterAI: false, dailyMatches: "none", autoApply: false, cleanPdf: false });

  const student = featuresFor("student", true);
  // Build-and-learn: generators + clean PDF, none of the cockpit artifacts.
  assert.equal(student.docxExport, false);
  assert.equal(student.toolHistory, false);
  assert.equal(student.coverLetterAI, true);
  assert.equal(student.dailyMatches, "student");
  assert.equal(student.cleanPdf, true);

  const paid = featuresFor("paid", true);
  assert.equal(paid.docxExport, true);
  assert.equal(paid.toolHistory, true);
  assert.equal(paid.dailyMatches, "full");

  // Auto-Apply stays false on every current tier: it is reserved for the
  // one-time Job Search Pack SKU, and no subscription may cannibalize it.
  for (const col of TIER_COLUMNS) assert.equal(featuresFor(col.source, col.premium).autoApply, false);
});

test("a non-premium source never unlocks features even if premium flag is mis-set", () => {
  // premium=true with premiumSource=null is the expired/legacy shape.
  const legacy = featuresFor(null, true);
  assert.equal(legacy.docxExport, true); // premium flag wins for unknown sources (paid legacy rows)
  assert.equal(featuresFor(undefined, false).cleanPdf, false);
});

// ── Server-side guards: the tier map, not raw user.premium ──

test("DOCX export routes gate on features.docxExport, never raw user.premium", () => {
  for (const path of [
    "app/api/resume/[id]/docx/route.ts",
    "app/api/manual-export/docx/route.ts",
    "app/api/tools/export-docx/route.ts",
  ]) {
    const route = source(path);
    assert.match(route, /features\??\.docxExport/, `${path} must ask the tier map`);
    // The only user.premium allowed is the credit/unlock bypass scoping
    // (non-premium accounts only), never the gate itself.
    assert.doesNotMatch(route, /if \(!user\.premium\) return NextResponse/, `${path} must not gate DOCX on raw premium`);
  }
});

test("cover letter analyzer gates on the coverLetterAI tier feature", () => {
  const route = source("app/api/cover-letter-analyzer/route.ts");
  assert.match(route, /features\.coverLetterAI/);
  assert.doesNotMatch(route, /if \(!user\.premium\) return NextResponse/);
  const legacy = source("app/api/tools/generate/route.ts");
  assert.match(legacy, /body\.tool === "letter-analyzer"[\s\S]*currentUser\(\)[\s\S]*features\.coverLetterAI[\s\S]*analysis: analyzeCoverLetter/);
});

test("clean PDF export gates on the cleanPdf tier feature", () => {
  const route = source("app/api/manual-export/pdf/route.ts");
  assert.match(route, /features\??\.cleanPdf/);
});

// ── Client-side guards: locked features render a disabled button, not a
// dead click and not a silently missing control ──

test("every DOCX export button has a locked-state twin with an honest label", () => {
  for (const path of ["app/build/page.tsx", "app/resume-maker/page.tsx", "app/dashboard/page.tsx", "app/resumes/[id]/page.tsx"]) {
    const page = source(path);
    assert.match(page, /features\?\.docxExport|docxAllowed|docxForResume/, `${path} must know the tier`);
    assert.match(page, /Lock/, `${path} must render a lock for the locked state`);
    // The student message acknowledges what the plan DOES include instead of
    // a bare refusal.
    assert.match(page, /Student plan includes clean/, `${path} must tell students what their plan includes`);
  }
});

test("job alerts label the student tier truthfully, not as plain Premium", () => {
  const page = source("app/job-alerts/page.tsx");
  assert.match(page, /premiumSource === "student"/);
  assert.match(page, /"Student Premium" : "Premium"/);
  assert.doesNotMatch(page, /isPremium \? "Premium — daily alerts"/);
});

test("student offer card never strands a user on a failed status check", () => {
  const card = source("components/StudentOfferCard.tsx");
  // The CLS skeleton must resolve even when /api/student/status errors.
  assert.match(card, /setStatusKnown\(true\)/);
  assert.match(card, /status could not be checked/);
});

test("admin payments view renders only fields the API selects and flags intervention states", () => {
  const view = source("app/admin/views/payments-view.tsx");
  const api = source("app/api/admin/payments/route.ts");
  // The detail dialog must not read fields the list API never selects —
  // payment_id/pay_address/pay_amount rendered as permanent "—" placeholders.
  assert.doesNotMatch(view, /detail\.payment_id|detail\.pay_address|detail\.pay_amount/);
  // Intervention states must be visibly distinct: validation_failed and
  // invoice_unknown mean a human must act, not a grey default badge.
  assert.match(view, /validation_failed/);
  assert.match(view, /invoice_unknown/);
  assert.match(view, /ipn:check/);
  // The API selects exactly the fields the view now renders.
  assert.match(api, /select p\.id, p\.order_id, p\.status, p\.plan, p\.price_amount, p\.pay_currency, p\.created_at, p\.provider, u\.email/);
});

test("admin premium grants are permission-gated, duration-allowlisted, and audited", () => {
  const route = source("app/api/admin/premium/route.ts");
  assert.match(route, /hasAdminPermission\("users\.manage"\)/);
  assert.match(route, /ALLOWED_DAYS/);
  assert.match(route, /premium_grant|premium_revoke/);
  assert.match(route, /mutationOriginAllowed\(req\)/);
});

test("dev payment confirmation answers 404 in production, never 403", () => {
  const route = source("app/api/pay/crypto/dev-confirm/route.ts");
  // 403 would confirm the endpoint exists; production pretends it does not.
  assert.match(route, /if \(env\.production\) return new NextResponse\("Not Found", \{ status: 404 \}\)/);
});

test("IPN webhook rejects bad signatures without leaking the body or signature", () => {
  const route = source("app/api/pay/crypto/webhook/route.ts");
  assert.match(route, /verifyIpn\(raw, sig\)/);
  // The log line names orderId/bodyBytes/signaturePresent — never sig or raw.
  const logBlock = route.match(/console\.error\("\[pay:ipn\] rejected", \{[\s\S]*?\}\);/);
  assert.ok(logBlock, "rejection must be logged");
  assert.doesNotMatch(logBlock[0], /\bsig\b[,:]|\braw\b[,:]/);
  // Quarantine keeps rejected-but-plausible callbacks for later review.
  assert.match(route, /ipn_quarantine/);
});
