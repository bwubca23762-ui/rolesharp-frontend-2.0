const profile = process.env.LIGHTHOUSE_PROFILE === "mobile" ? "mobile" : "desktop";
const desktop = profile === "desktop";
const port = Number(process.env.JOBS_QA_PORT ?? 34101);
const evidenceRoot = process.env.JOBS_EVIDENCE_ROOT ?? ".omo/evidence/task-21-auto-apply";

module.exports = {
  ci: {
    collect: {
      url: [
        `http://127.0.0.1:${port}/auto-apply`,
        `http://127.0.0.1:${port}/daily-matches`,
        `http://127.0.0.1:${port}/campaign-settings`,
      ],
      numberOfRuns: 3,
      startServerCommand: "npm run start:qa",
      startServerReadyPattern: "Ready in|started server|Local:",
      startServerReadyTimeout: 120000,
      settings: desktop ? {
        chromeFlags: "--headless=new --no-sandbox",
        formFactor: "desktop",
        screenEmulation: { mobile: false, width: 1280, height: 900, deviceScaleFactor: 1, disabled: false },
        throttlingMethod: "simulate",
      } : {
        chromeFlags: "--headless=new --no-sandbox",
        formFactor: "mobile",
        screenEmulation: { mobile: true, width: 375, height: 812, deviceScaleFactor: 2.625, disabled: false },
        throttlingMethod: "simulate",
      },
    },
    assert: {
      aggregationMethod: "median-run",
      assertions: {
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 1 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: `${evidenceRoot}/lighthouse-${profile}`,
    },
  },
};
