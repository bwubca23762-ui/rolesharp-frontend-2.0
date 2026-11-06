import { connect } from "node:net";

// Client for the root ops helper (scripts/ops-helper.mjs). The web process runs
// as `rolesharp` with NoNewPrivileges=true and cannot run systemctl itself, so
// every service action goes over this socket. The helper owns the unit and verb
// allowlists; nothing here can widen them.

const SOCKET = process.env.ROLESHARP_OPS_SOCKET || "/run/rolesharp-ops.sock";
// systemctl verbs finish inside a minute; a streamed pg_dump may take
// minutes on a grown database.
const TIMEOUT_MS = 65_000;
const BACKUP_TIMEOUT_MS = 310_000;

export type OpsAction = "list" | "status" | "start" | "stop" | "restart" | "reload" | "backup" | "backups" | "logs";
export type BackupSnapshot = { name: string; bytes: number; createdAt: string };

export type ServiceStatus = {
  unit: string;
  activeState: string;
  subState: string;
  unitFileState: string;
  activeEnterTimestamp: string;
  restarts: number;
  canStop: boolean;
  canReload?: boolean;
};

type OpsResponse =
  | { ok: true; services?: ServiceStatus[]; service?: ServiceStatus; file?: string; bytes?: number; lines?: string[]; snapshots?: BackupSnapshot[] }
  | { ok: false; error: string; detail?: string };

export function opsRequest(request: { action: OpsAction; unit?: string; lines?: number }): Promise<OpsResponse> {
  const timeout = request.action === "backup" ? BACKUP_TIMEOUT_MS : TIMEOUT_MS;
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: OpsResponse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };

    const socket = connect(SOCKET);
    socket.setTimeout(timeout);
    socket.setEncoding("utf8");

    let buffer = "";
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", (chunk) => {
      buffer += chunk;
      if (buffer.length > 2_000_000) { done({ ok: false, error: "helper_response_too_large" }); return; }
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      try {
        done(JSON.parse(buffer.slice(0, newline)) as OpsResponse);
      } catch {
        done({ ok: false, error: "helper_bad_response" });
      }
    });
    socket.on("timeout", () => done({ ok: false, error: "helper_timeout" }));
    // ENOENT/EACCES here means the helper unit is not running or the socket
    // group is wrong -- surfaced as one error the panel can explain.
    socket.on("error", () => done({ ok: false, error: "helper_unavailable" }));
    socket.on("end", () => done({ ok: false, error: "helper_closed" }));
  });
}
