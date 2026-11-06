// Client-side shape of GET /api/admin/stats and GET /api/admin/session.
// Kept in step with app/api/admin/stats/route.ts — the payload built there is
// the source of truth for everything below.

export type AdminTotals = {
  users: number;
  freeUsers: number;
  premiumUsers: number;
  /** Premium accounts whose source is not the student offer (paid or admin-granted). */
  paidUsers: number;
  /** Premium accounts on the student offer (premium_source='student'). */
  studentUsers: number;
  resumes: number;
  signupsToday: number;
  resumesToday: number;
  payRows: number;
  revenue: number;
  revenueCurrency: string;
  avgAts: number;
  lowAts: number;
  withJd: number;
  avgGenMs: number;
  p95GenMs: number;
  freeResumes: number;
  premiumResumes: number;
  freeAvgGenMs: number;
  premiumAvgGenMs: number;
  verifiedUsers: number;
  revenue30: number;
  successfulPayments: number;
  failedPayments: number;
};

/** BullMQ getJobCounts — every key is absent when the queue call fails and returns {}. */
export type AdminQueueCounts = Partial<Record<
  "waiting" | "active" | "completed" | "failed" | "delayed" | "paused",
  number
>>;

export type AdminJobIngestionRun = {
  status: string;
  country_code: string | null;
  search_term: string | null;
  providers: unknown;
  fetched_count: number | null;
  stored_count: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

export type AdminHealth = {
  /** -1 when the queue could not be reached. */
  queueDepth: number;
  queueCounts: AdminQueueCounts;
  keys: { total: number; available: number; cooling: number };
  workerConcurrency: number;
  maxQueueDepth: number;
  jobs: {
    total: number;
    fresh: number;
    last_seen_at: string | null;
    countries: Array<{ country_code: string | null; total: number }>;
    runs: AdminJobIngestionRun[];
  };
};

export type AdminSystem = {
  hostname: string;
  platform: string;
  uptimeSec: number;
  loadAvg: number[];
  cpuCount: number;
  totalMem: number;
  freeMem: number;
  processUptimeSec: number;
  rss: number;
  heapUsed: number;
  heapTotal: number;
  /** null on platforms where statfs is unavailable. */
  disk: { total: number; free: number; used: number; usedPct: number } | null;
  node: string;
  pid: number;
};

export type AdminPayments = {
  razorpay?: Array<{ currency: string; paid: number; failed: number; revenue: number; revenue30: number }>;
  nowpayments: {
    live: boolean;
    dev: boolean;
    apiKeyConfigured: boolean;
    ipnSecretConfigured: boolean;
    currency: string;
  };
  plans: Array<{ id: string; label: string; price: number; days: number }>;
  status: Array<{ status: string; n: number; amount: string }>;
  byPlan: Array<{ plan: string | null; n: number; amount: string }>;
};

export type AdminRecentUser = {
  premium_until: string | null;
  created_at: string;
  resumes: number;
};

export type AdminRecentResume = {
  ats_score: number | null;
  template: string | null;
  created_at: string;
  has_jd: boolean;
};

export type AdminRecentPayment = {
  status: string;
  plan: string | null;
  price_amount: string | number | null;
  pay_currency: string | null;
  created_at: string;
};

export type AdminSlowResume = {
  gen_ms: number;
  ats_score: number | null;
  created_at: string;
};

export type AdminStats = {
  totals: AdminTotals;
  system: AdminSystem;
  health: AdminHealth;
  support: { openCount: number };
  students: { pendingCount: number };
  internshipReports: { pendingCount: number };
  limits: { freeMonthly: number; premiumMonthly: number };
  topRoles: Array<{ title: string; n: number }>;
  topCompanies: Array<{ name: string; n: number }>;
  payments: AdminPayments;
  adminActions: Array<{ action: string; created_at: string }>;
  recentSlow: AdminSlowResume[];
  recentUsers: AdminRecentUser[];
  recentResumes: AdminRecentResume[];
  recentPayments: AdminRecentPayment[];
  recentFailures: AdminRecentPayment[];
  perDay?: Array<{ d: string; n: number }>;
};

export type AdminSessionStatus = {
  authenticated: true;
  principal: {
    staffAccountId: string | null;
    email: string | null;
    displayName: string | null;
    roles: string[];
    permissions: string[];
    authenticationMethod: "google" | "break_glass";
    breakGlass: boolean;
  };
  environment: {
    label: string;
    nodeEnvironment: string;
    isProduction: boolean;
    localDevMode: boolean;
  };
  navigation: {
    openTickets: number;
    pendingReports: number;
    pendingStudents: number;
    pendingAccessRequests: number;
    monitored: boolean;
  };
  generatedAt: string;
};
