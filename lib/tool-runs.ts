// Client-safe half of tool-run history: the shape and the labels. No server
// imports here — the dashboard is a client component, and pulling auth
// (next/headers) or db (pg) into its bundle breaks the build. The server
// halves live in lib/tool-runs-server.ts.

export type ToolRun = {
  tool: string;
  score: number | null;
  summary: string | null;
  created_at: string;
};

const TOOL_LABELS: Record<string, string> = {
  ats_check: "ATS check",
  summary: "Summary generator",
  bullets: "Bullet points generator",
  experience: "Experience writer",
  career: "Career summary generator",
  resignation: "Resignation letter generator",
};

export function toolRunLabel(tool: string): string {
  return TOOL_LABELS[tool] ?? tool;
}
