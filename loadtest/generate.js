import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// Measures the math from the plan: latency, throughput, p95, shed rate.
// Run:  BASE=http://localhost:3000 k6 run loadtest/generate.js
const BASE = __ENV.BASE || "http://localhost:3000";

const genTime = new Trend("resume_gen_ms", true);
const shed = new Rate("shed_503"); // backpressure activations

export const options = {
  scenarios: {
    // Ramp arrival rate (λ) to find where p95 blows up.
    ramp: {
      executor: "ramping-arrival-rate",
      startRate: 2,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: 500,
      stages: [
        { target: 5, duration: "1m" },   // λ=5/s
        { target: 13, duration: "1m" },  // λ=μ (on-box ceiling)
        { target: 25, duration: "1m" },  // λ>μ -> queue/backpressure kicks in
        { target: 0, duration: "30s" },  // drain
      ],
    },
  },
  thresholds: {
    "http_req_duration{status:200}": ["p(95)<9000"], // healthy if p95 < 9s
    shed_503: ["rate<0.5"],
  },
};

const profile = {
  name: "Test User",
  skills: ["JavaScript", "React", "Node.js", "SQL"],
  experiences: [
    { title: "Software Engineer", company: "Acme", start: "2021", end: "2024",
      bullets: ["Built APIs", "Cut latency 40%"] },
  ],
  education: [{ degree: "B.Tech CSE", school: "ABC University", year: "2021" }],
};

export default function generateResume() {
  const payload = JSON.stringify({
    profile,
    companySlug: "google",
    roleSlug: "software-engineer",
    jdText: "Looking for a Software Engineer with React, Node.js, SQL, AWS, system design.",
  });
  const res = http.post(`${BASE}/api/generate`, payload, {
    headers: { "Content-Type": "application/json" },
    timeout: "70s",
  });
  shed.add(res.status === 503);
  if (res.status === 200) {
    const body = res.json();
    if (body && body.gen_ms) genTime.add(body.gen_ms);
  }
  check(res, {
    "ok or shed": (r) => r.status === 200 || r.status === 503 || r.status === 202,
  });
  sleep(1);
}
