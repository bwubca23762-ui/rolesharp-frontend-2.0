import { NextRequest, NextResponse } from "next/server";
import { sameOriginRequest } from "@/lib/request-origin";
import { FeatureAccessDeniedError } from "@/lib/feature-access";
import { LegalAcceptanceRequiredError } from "@/lib/legal";

export function mutationOriginAllowed(req: NextRequest): boolean {
  if (!req.headers.get("origin")) return process.env.NODE_ENV !== "production";
  return sameOriginRequest({ headers: req.headers, fallbackHost: req.nextUrl.host });
}

export function workflowApiError(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : fallback;
  const status = error instanceof FeatureAccessDeniedError || error instanceof LegalAcceptanceRequiredError ? 403
    : code === "mailbox_provider_not_configured" ? 503
    : code.endsWith("_not_found") ? 404
    : code.includes("already") || code.includes("duplicate") || code === "23505" ? 409
      : code === "account_unavailable" ? 403
        : code === fallback ? 500 : 400;
  return NextResponse.json({
    error: status === 500 ? fallback : code,
    ...(error instanceof LegalAcceptanceRequiredError ? { pending: error.pending } : {}),
  }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
