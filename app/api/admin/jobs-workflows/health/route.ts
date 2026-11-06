import { NextResponse } from "next/server";
import { hasAdminPermission } from "@/lib/admin-authorization";
import { q } from "@/lib/db";
import { jobsWorkflowReadiness } from "@/lib/jobs-workflow/config";
import { readJobWorkflowFlags } from "@/lib/jobs-workflow/flags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GroupedStatus = { status: string; count: number; oldest_at: string | null };
type GroupedConnection = { provider: string; status: string; count: number; oldest_at: string | null };
type ResourceResult<T> = { available: true; rows: T[] } | { available: false; rows: [] };

async function readResource<T>(sql: string): Promise<ResourceResult<T>> {
  try {
    return { available: true, rows: await q<T>(sql) };
  } catch {
    // Admin health responses deliberately report only schema availability.
    // Database error text can contain host, relation, or query details.
    return { available: false, rows: [] };
  }
}

function environmentControl(name: string) {
  const value = process.env[name];
  return {
    explicitlyConfigured: value === "true" || value === "false",
    enabled: value === "true",
  };
}

function countStatus(rows: GroupedStatus[], ...statuses: string[]) {
  return rows
    .filter((row) => statuses.includes(row.status))
    .reduce((total, row) => total + Number(row.count || 0), 0);
}

export async function GET() {
  if (!(await hasAdminPermission("jobs.read"))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [flags, workItems, attempts, outbox, connections] = await Promise.all([
    readJobWorkflowFlags(),
    readResource<GroupedStatus>(
      `select status,count(*)::int count,min(created_at)::text oldest_at
       from job_work_items group by status order by status`,
    ),
    readResource<GroupedStatus>(
      `select status,count(*)::int count,min(created_at)::text oldest_at
       from application_mail_attempts group by status order by status`,
    ),
    readResource<GroupedStatus>(
      `select status,count(*)::int count,min(created_at)::text oldest_at
       from notification_outbox group by status order by status`,
    ),
    readResource<GroupedConnection>(
      `select provider,status,count(*)::int count,min(created_at)::text oldest_at
       from email_connections group by provider,status order by provider,status`,
    ),
  ]);

  const controls = {
    workflows: environmentControl("JOBS_WORKFLOWS_ENABLED"),
    gmailSend: environmentControl("ROLE_APPLY_GMAIL_SEND_ENABLED"),
    microsoftSend: environmentControl("ROLE_APPLY_MICROSOFT_SEND_ENABLED"),
  };
  let readiness: ReturnType<typeof jobsWorkflowReadiness> | null = null;
  try {
    readiness = jobsWorkflowReadiness();
  } catch {
    readiness = null;
  }
  const resources = { workItems, attempts, outbox, connections };
  const schemaReady = Object.values(resources).every((resource) => resource.available);
  const warnings: Array<{ code: string; message: string; level: "warning" | "danger" }> = [];

  if (!schemaReady) {
    warnings.push({
      code: "workflow_schema_unavailable",
      message: "One or more workflow tables are unavailable. Verify migrations 030–037 before enabling workflows.",
      level: "danger",
    });
  }
  for (const [name, control] of Object.entries(controls)) {
    if (!control.explicitlyConfigured) {
      warnings.push({
        code: `${name}_not_explicit`,
        message: `${name} is defaulting to disabled but is not explicitly configured. The production release gate requires true or false.`,
        level: "warning",
      });
    }
  }
  if (!readiness) {
    warnings.push({
      code: "workflow_configuration_invalid",
      message: "Workflow configuration could not be validated. Sending remains unavailable.",
      level: "danger",
    });
  }
  if (attempts.available) {
    const attention = countStatus(attempts.rows, "unknown", "needs_user", "terminal_failed");
    if (attention > 0) warnings.push({
      code: "application_attempts_attention",
      message: `${attention} application attempt${attention === 1 ? " needs" : "s need"} operator review. Unknown outcomes must never be resent automatically.`,
      level: "danger",
    });
  }
  if (outbox.available) {
    const attention = countStatus(outbox.rows, "unknown", "needs_user", "failed");
    if (attention > 0) warnings.push({
      code: "notification_outbox_attention",
      message: `${attention} notification${attention === 1 ? " needs" : "s need"} operator review.`,
      level: "warning",
    });
  }
  if (workItems.available) {
    const failed = countStatus(workItems.rows, "unknown", "terminal_failed");
    if (failed > 0) warnings.push({
      code: "work_items_attention",
      message: `${failed} durable work item${failed === 1 ? " is" : "s are"} unknown or terminally failed.`,
      level: "danger",
    });
  }
  if (connections.available) {
    const needsUser = connections.rows
      .filter((row) => row.status === "needs_user")
      .reduce((total, row) => total + Number(row.count || 0), 0);
    if (needsUser > 0) warnings.push({
      code: "mail_connections_attention",
      message: `${needsUser} mailbox connection${needsUser === 1 ? " needs" : "s need"} user attention.`,
      level: "warning",
    });
  }

  const operationalState = !schemaReady || !readiness
    ? "unavailable"
    : !controls.workflows.enabled
      ? "disabled"
      : warnings.some((warning) => warning.level === "danger")
        ? "attention"
        : "ready";

  return NextResponse.json({
    operationalState,
    safetyLock: {
      workflowsDisabled: !controls.workflows.enabled,
      gmailSendingDisabled: !controls.gmailSend.enabled,
      microsoftSendingDisabled: !controls.microsoftSend.enabled,
    },
    readiness,
    controls,
    flags,
    database: { schemaReady, resources },
    warnings,
    generatedAt: new Date().toISOString(),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
