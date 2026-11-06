import { NextResponse } from "next/server";
import { currentAdminPrincipal } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Lightweight admin bootstrap. Admin pages that load their own data use this
 * endpoint instead of paying for the multi-query overview statistics request.
 */
export async function GET() {
  const principal = await currentAdminPrincipal();
  if (!principal || !principal.permissions.has("admin.access")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [supportResult, reportResult, studentResult, accessResult] = await Promise.allSettled([
    q<{ count: number }>("select count(*)::int count from support_tickets where status='open'"),
    q<{ count: number }>("select count(*)::int count from internship_reports where status='pending'"),
    q<{ count: number }>(`select count(*)::int count from (
      select distinct on (student_email) student_email, expires_at
      from student_verification_tokens
      where used_at is null
        and not exists (
          select 1 from student_claims sc
          where sc.student_email=student_verification_tokens.student_email
        )
      order by student_email, created_at desc
    ) pending where expires_at > now()`),
    q<{ count: number }>("select count(*)::int count from feature_access_grants where state='requested'"),
  ]);

  const count = (result: PromiseSettledResult<Array<{ count: number }>>) =>
    result.status === "fulfilled" ? Number(result.value[0]?.count ?? 0) : 0;
  const monitored = [supportResult, reportResult, studentResult, accessResult]
    .every((result) => result.status === "fulfilled");
  const nodeEnvironment = process.env.NODE_ENV ?? "development";
  const isProduction = nodeEnvironment === "production" && !env.localDevMode;
  const environmentLabel = isProduction
    ? "Production"
    : env.localDevMode
      ? "Local QA"
      : nodeEnvironment === "test"
        ? "Test"
        : "Development";

  return NextResponse.json({
    authenticated: true,
    principal: {
      staffAccountId: principal.staffAccountId,
      email: principal.email,
      displayName: principal.displayName,
      roles: principal.roles,
      permissions: [...principal.permissions].sort(),
      authenticationMethod: principal.authenticationMethod,
      breakGlass: principal.breakGlass,
    },
    environment: {
      label: environmentLabel,
      nodeEnvironment,
      isProduction,
      localDevMode: env.localDevMode,
    },
    navigation: {
      openTickets: count(supportResult),
      pendingReports: count(reportResult),
      pendingStudents: count(studentResult),
      pendingAccessRequests: count(accessResult),
      monitored,
    },
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
