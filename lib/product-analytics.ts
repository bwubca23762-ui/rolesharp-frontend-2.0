export const PRODUCT_EVENT_NAMES = [
  "nav_menu_open",
  "nav_item_select",
  "featured_workflow_select",
  "demo_view",
  "demo_step",
  "demo_complete",
  "demo_cta_select",
  "tool_meaningful_start",
  // The counterpart to tool_meaningful_start. Every tool validates before it
  // starts work and returns early with a message, and those returns sit ABOVE
  // the meaningful_start call — so someone who presses the button and is turned
  // away is currently invisible. 258 of 274 signups never generate anything and
  // nothing measures where they stop; this is the cheapest event that can tell
  // a dead funnel apart from a validation wall. Context names the gate, never
  // what the user typed.
  "tool_start_blocked",
  "first_value_view",
  "auth_start",
  "auth_verified",
  "destination_resumed",
  "workflow_handoff",
  "template_preview",
  "template_use",
  "example_view",
  "example_use",
  "methodology_view",
  "source_open",
  "pricing_boundary_view",
  // A purchase funnel must distinguish interest, provider choice, and a
  // confirmed payment. Without these, failed conversion looks identical to a
  // user who never intended to buy.
  "checkout_intent",
  "checkout_provider_selected",
  "checkout_started",
  "checkout_cancelled",
  "checkout_failed",
  "checkout_verified",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
export type ProductPageFamily =
  | "marketing"
  | "tool"
  | "auth"
  | "workspace"
  | "directory"
  | "editorial"
  | "legal"
  | "unknown";
export type ProductDeviceClass = "mobile" | "tablet" | "desktop";
export type ProductAuthState = "anonymous" | "authenticated" | "unknown";

export type ProductAnalyticsEvent = {
  type: "event";
  event: ProductEventName;
  path: string;
  pageFamily: ProductPageFamily;
  deviceClass: ProductDeviceClass;
  authState: ProductAuthState;
  sessionId: string;
  context?: string;
};

const EVENT_NAMES = new Set<string>(PRODUCT_EVENT_NAMES);
const PAGE_FAMILIES = new Set<string>([
  "marketing",
  "tool",
  "auth",
  "workspace",
  "directory",
  "editorial",
  "legal",
  "unknown",
]);
const DEVICE_CLASSES = new Set<string>(["mobile", "tablet", "desktop"]);
const AUTH_STATES = new Set<string>(["anonymous", "authenticated", "unknown"]);
const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9/_-]*$/u;
const SAFE_CONTEXT_PATTERN = /^[A-Za-z0-9:_-]+$/u;

export function normalizeAnalyticsPath(path: string) {
  const value = path.trim();
  if (!SAFE_PATH_PATTERN.test(value) || value.length > 240) return null;
  return value.replace(/\/{2,}/gu, "/") || "/";
}

export function sanitizeAnalyticsContext(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 80 || !SAFE_CONTEXT_PATTERN.test(normalized)) return undefined;
  return normalized;
}

export function isProductEventName(value: unknown): value is ProductEventName {
  return typeof value === "string" && EVENT_NAMES.has(value);
}

export function isProductPageFamily(value: unknown): value is ProductPageFamily {
  return typeof value === "string" && PAGE_FAMILIES.has(value);
}

export function isProductDeviceClass(value: unknown): value is ProductDeviceClass {
  return typeof value === "string" && DEVICE_CLASSES.has(value);
}

export function isProductAuthState(value: unknown): value is ProductAuthState {
  return typeof value === "string" && AUTH_STATES.has(value);
}

export function pageFamilyForPath(path: string): ProductPageFamily {
  if (/^\/(login|forgot-password|reset-password)(?:\/|$)/u.test(path)) return "auth";
  if (/^\/(dashboard|settings|account|billing|security|support|tracker|daily-matches|application-queue|email-connection|campaign-settings)(?:\/|$)/u.test(path)) return "workspace";
  if (/^\/(build|checker|resume-maker|resume-fixer|linkedin-checker|cover-letter-generator|interview-prep)(?:\/|$)/u.test(path)) return "tool";
  if (/^\/(roles|companies|resume-templates|resume-examples|jobs|internships)(?:\/|$)/u.test(path)) return "directory";
  if (/^\/(privacy|terms|refund)(?:\/|$)/u.test(path)) return "legal";
  if (/^\/(blog|learn|help|about|compare|careers|prompts)(?:\/|$)/u.test(path)) return "editorial";
  if (path === "/" || /^\/[a-z]{2}-[a-z]{2}(?:\/|$)/u.test(path) || path === "/pricing") return "marketing";
  return "unknown";
}

export function deviceClassForWidth(width: number): ProductDeviceClass {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
