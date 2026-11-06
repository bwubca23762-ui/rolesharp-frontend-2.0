import { execFileSync, spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { createServer } from "node:net";

const origin = "http://127.0.0.1:34110";
const pgPort = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close((error) => error ? reject(error) : resolve(String(port)));
  });
});
const brewPostgres = ["/opt/homebrew", "/usr/local"]
  .map((prefix) => join(prefix, "opt", "postgresql@17", "bin"))
  .find((bin) => existsSync(join(bin, "pg_ctl")));
const pgBin = process.env.PG_BIN || brewPostgres || execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");
const dbUser = "rolesharp_review";
const dbPassword = randomBytes(24).toString("hex");
const databaseUrl = `postgresql://${dbUser}:${dbPassword}@127.0.0.1:${pgPort}/postgres`;
const demoEmail = "avery@rolesharp.example";
const demoPassword = "RoleSharp-Demo-2026";
const demoAdminUser = "review-admin";
const demoAdminPassword = "RoleSharp-Local-Admin-2026";
const salt = randomBytes(16).toString("hex");
const demoHash = `${salt}:${scryptSync(demoPassword, salt, 64).toString("hex")}`;
const root = mkdtempSync(join(tmpdir(), "rolesharp-review-"));
const cluster = join(root, "db");
const passwordFile = join(root, "password");
const postgresLog = join(root, "postgres.log");
const pgEnv = { PATH: process.env.PATH, LANG: "C", PGPASSWORD: dbPassword };

function postgres(command, args) {
  try {
    execFileSync(join(pgBin, command), args, { env: pgEnv, stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    throw new Error(`${command} failed: ${error.stderr?.toString().trim() || error.code}`);
  }
}

let databaseStarted = false;
try {
  writeFileSync(passwordFile, dbPassword, { mode: 0o600 });
  postgres("initdb", ["-D", cluster, "-A", "scram-sha-256", "-U", dbUser, "--pwfile", passwordFile]);
  try {
    const socketOptions = process.platform === "win32" ? "" : " -c unix_socket_directories=''";
    postgres("pg_ctl", ["-D", cluster, "-l", postgresLog, "-o", `-h 127.0.0.1 -p ${pgPort}${socketOptions}`, "start"]);
  } catch (error) {
    if (existsSync(postgresLog)) console.error(readFileSync(postgresLog, "utf8"));
    throw error;
  }
  databaseStarted = true;

  const psql = ["-X", "-h", "127.0.0.1", "-p", pgPort, "-U", dbUser, "-d", "postgres", "-v", "ON_ERROR_STOP=1"];
  postgres("psql", [...psql, "-f", "db/schema.sql"]);
  for (const migration of readdirSync("db/migrations").filter((name) => name.endsWith(".sql")).sort()) {
    postgres("psql", [...psql, "-f", join("db/migrations", migration)]);
  }
  postgres("psql", [...psql, "-v", `demo_email=${demoEmail}`, "-v", `demo_hash=${demoHash}`, "-f", "scripts/preview-frontend-seed.sql"]);

  const tsconfig = ".local/frontend-review-tsconfig.json";
  mkdirSync(".local", { recursive: true });
  writeFileSync(tsconfig, JSON.stringify({
    extends: "../tsconfig.json",
    compilerOptions: { baseUrl: "..", plugins: [{ name: "next" }] },
  }));
  const server = spawn(process.execPath, [
    "--import", "./tests/helpers/network-deny-bootstrap.mjs",
    next, "dev", "-H", "127.0.0.1", "-p", "34110",
  ], {
    stdio: "inherit",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "development",
      AUTH_SECRET: randomBytes(32).toString("hex"),
      SITE_URL: origin,
      FRONTEND_REVIEW_MODE: "true",
      FRONTEND_REVIEW_EMAIL: demoEmail,
      FRONTEND_REVIEW_PASSWORD: demoPassword,
      FRONTEND_REVIEW_ADMIN_USER: demoAdminUser,
      FRONTEND_REVIEW_ADMIN_PASSWORD: demoAdminPassword,
      ADMIN_USER: demoAdminUser,
      ADMIN_PASSWORD: demoAdminPassword,
      ADMIN_TOTP_SECRET: "",
      LOCAL_DEV_MODE: "false",
      DISABLE_DB: "false",
      DATABASE_URL: databaseUrl,
      REDIS_URL: "redis://127.0.0.1:1",
      GOOGLE_CLIENT_ID: "",
      OPENAI_API_KEY: "",
      ANTHROPIC_PROXY_URL: "",
      RAZORPAY_KEY_ID: "",
      RAZORPAY_KEY_SECRET: "",
      SMTP_HOST: "",
      GCP_VOICE_ENABLED: "false",
      JOBS_QA_DIST_DIR: ".next-frontend-review",
      JOBS_QA_TSCONFIG: tsconfig,
      JOBS_WORKFLOWS_ENABLED: "false",
      ROLE_APPLY_GMAIL_SEND_ENABLED: "false",
      ROLE_APPLY_MICROSOFT_SEND_ENABLED: "false",
    },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => server.kill(signal));
  }
  console.log(`RoleSharp frontend review: ${origin}/dev/frontend-review\nDemo sign-in: ${demoEmail} / ${demoPassword}`);
  process.exitCode = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.once("exit", (code, signal) => resolve(code ?? (signal ? 0 : 1)));
  });
} finally {
  if (databaseStarted) postgres("pg_ctl", ["-D", cluster, "-m", "fast", "stop"]);
  rmSync(root, { recursive: true, force: true });
}
