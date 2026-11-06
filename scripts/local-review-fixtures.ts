import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { scryptSync, randomBytes } from "node:crypto";

// Security assertion: Never runnable in production
if (process.env.NODE_ENV === "production" && process.env.LOCAL_DEV_MODE !== "true") {
  console.error("FATAL: local-review-fixtures is strictly disabled in production.");
  process.exit(1);
}

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64, SCRYPT).toString("hex");
  return `${salt}:${hash}`;
}

const LOCAL_DIR = join(process.cwd(), ".local");
const STORE_FILE = join(LOCAL_DIR, "dev-store.json");
const FIXTURES_FILE = join(LOCAL_DIR, "fictional-review-data.json");

export const FICTIONAL_USER = {
  id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  email: "avery.chen@rolesharp.example",
  password: "RoleSharp-Demo-2026!",
  candidateName: "Avery Chen",
};

export const FICTIONAL_RESUMES = [
  {
    id: "avery-product-manager-resume",
    userId: FICTIONAL_USER.id,
    candidateName: FICTIONAL_USER.candidateName,
    atsScore: 92,
    template: "signal",
    premiumUnlock: true,
    creditUsed: true,
    companyName: "Harbor Labs",
    roleTitle: "Senior Product Manager",
    jdText: "Lead product development for high-growth SaaS platform. Requires experimentation, research-to-roadmap, and stakeholder communication.",
    createdAt: new Date().toISOString(),
    content: {
      basics: {
        name: "Avery Chen",
        email: "avery.chen@rolesharp.example",
        phone: "+1 (555) 019-2834",
        location: "New York, NY",
        title: "Senior Product Manager",
        summary: "Product manager with 6+ years leading customer-centric roadmap decisions, iterative experiments, and cross-functional teams.",
      },
      skills: ["Product Strategy", "Experimentation", "SQL & Metrics", "Customer Research", "Roadmap Planning", "A/B Testing"],
      experience: [
        {
          company: "Northline",
          position: "Senior Product Manager",
          startDate: "2022-03",
          endDate: "Present",
          summary: "Led product strategy and experimentation across activation and retention funnels.",
          highlights: [
            "Increased user activation rate by 24% through redesigned 3-step onboarding flow.",
            "Ran 18 A/B experiments across 120k MAU, identifying top conversion levers with statistical significance.",
            "Aligned engineering, design, and marketing leads around quarterly outcome-based OKRs."
          ]
        },
        {
          company: "Fieldnote",
          position: "Product Manager",
          startDate: "2019-06",
          endDate: "2022-02",
          summary: "Owned core workflow tooling used by 45,000 teams globally.",
          highlights: [
            "Cut average task completion time by 38% by overhauling key navigation pathways.",
            "Conducted 50+ user interviews to define requirement specs for real-time collaboration features."
          ]
        }
      ],
      education: [
        {
          institution: "Columbia University",
          area: "Computer Science & Economics",
          studyType: "B.S.",
          startDate: "2015",
          endDate: "2019"
        }
      ]
    }
  }
];

export const FICTIONAL_WORKSPACE = {
  user: FICTIONAL_USER,
  jobs: [
    { id: "job-1", title: "Product Manager", company: "Harbor Labs", location: "Remote · US", matchScore: 92, fitReason: "Strong experimentation and roadmap evidence aligns with team requirements." },
    { id: "job-2", title: "Growth Product Manager", company: "Morrow", location: "New York · Hybrid", matchScore: 87, fitReason: "Activation and retention focus matches growth role scope." },
    { id: "job-3", title: "Product Strategy Lead", company: "Aster", location: "Remote · US", matchScore: 83, fitReason: "Demonstrated senior roadmap execution." }
  ],
  tracker: [
    { id: "track-1", company: "Morrow", role: "Growth Product Manager", stage: "saved", notes: "Review compensation details before applying", followUpDue: "2026-11-10" },
    { id: "track-2", company: "Harbor Labs", role: "Product Manager", stage: "applied", notes: "Tailored resume submitted with 92% match", followUpDue: "2026-11-12" },
    { id: "track-3", company: "Northwind", role: "Senior PM", stage: "interview", notes: "Technical round scheduled for next Tuesday", followUpDue: "2026-11-08" }
  ],
  campaign: {
    status: "active",
    targetRole: "Product Manager",
    targetLocations: ["Remote", "New York, NY"],
    autoApply: false,
    dailyMatchesReceived: 3
  }
};

async function readStore() {
  try {
    return JSON.parse(await readFile(STORE_FILE, "utf8"));
  } catch {
    return { users: [], resumes: [] };
  }
}

async function seed() {
  console.log("Seeding local review environment fixtures...");
  await mkdir(LOCAL_DIR, { recursive: true });

  const store = await readStore();
  
  // Ensure fixture user exists
  const existingIdx = store.users.findIndex((u: any) => u.email === FICTIONAL_USER.email);
  const passwordHash = hashPassword(FICTIONAL_USER.password);
  
  const devUser = {
    id: FICTIONAL_USER.id,
    email: FICTIONAL_USER.email,
    passwordHash,
    premiumUntil: "2026-12-31T23:59:59.000Z",
    premiumSource: "paid",
    emailVerifiedAt: new Date().toISOString(),
    credits: 10,
    inviteCode: "averychen",
    createdAt: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    store.users[existingIdx] = devUser;
  } else {
    store.users.push(devUser);
  }

  // Ensure fixture resumes exist
  for (const resume of FICTIONAL_RESUMES) {
    const rIdx = store.resumes.findIndex((r: any) => r.id === resume.id);
    if (rIdx >= 0) {
      store.resumes[rIdx] = resume;
    } else {
      store.resumes.push(resume);
    }
  }

  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
  await writeFile(FIXTURES_FILE, JSON.stringify(FICTIONAL_WORKSPACE, null, 2), "utf8");

  console.log("✓ Fictional user seeded: " + FICTIONAL_USER.email);
  console.log("✓ Fictional password: " + FICTIONAL_USER.password);
  console.log("✓ Fictional resumes & workspace data seeded in .local/");
}

async function reset() {
  console.log("Resetting local review environment fixtures...");
  await mkdir(LOCAL_DIR, { recursive: true });

  const store = await readStore();
  store.users = store.users.filter((u: any) => u.id !== FICTIONAL_USER.id);
  store.resumes = store.resumes.filter((r: any) => r.userId !== FICTIONAL_USER.id);

  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
  try {
    const { rm } = await import("node:fs/promises");
    await rm(FIXTURES_FILE, { force: true });
  } catch {}

  console.log("✓ Fictional user and review fixtures cleared from local store.");
}

async function main() {
  const command = process.argv[2] ?? "seed";
  if (command === "reset") {
    await reset();
  } else {
    await seed();
  }
}

void main();

