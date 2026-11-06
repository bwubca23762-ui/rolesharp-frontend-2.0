import { matchResumeToJob } from "../lib/match-engine";

const jd = "We are hiring a Senior Data Analyst. Requirements: 5+ years experience with SQL and Python. Strong Power BI and Tableau skills required. Experience with data visualization dashboards and AWS ETL pipelines. Bachelor degree in Statistics or related field. Knowledge of stakeholder management preferred.";

const strongResume = `Senior data analyst with 6 years of experience in SQL, Python, and Tableau.
Built data visualization dashboards and ETL pipelines on AWS for executive reporting.
Bachelor degree in Statistics. Led stakeholder management across product teams.
Skilled in Power BI and machine learning fundamentals.`;

const weakResume = `Marketing graduate looking to transition into tech.
Experience with social media campaigns and content writing.
Familiar with Excel spreadsheets.`;

console.log("=== STRONG resume vs JD ===");
const r1 = matchResumeToJob(strongResume, jd);
console.log(`fit: ${r1.fitScore} (${r1.grade})`);
console.log(`matched: ${r1.matched.join(", ")}`);
console.log(`missing: ${r1.missing.slice(0, 6).join(", ")}`);
console.log(`hints: ${r1.experienceHints.join(" | ")}`);

console.log("\n=== WEAK resume vs JD ===");
const r2 = matchResumeToJob(weakResume, jd);
console.log(`fit: ${r2.fitScore} (${r2.grade})`);
console.log(`missing (top 6): ${r2.missing.slice(0, 6).join(", ")}`);

console.log("\n=== assertions ===");
if (r1.fitScore <= r2.fitScore) throw new Error("strong should outscore weak");
if (r1.fitScore < 50) throw new Error("strong resume should score >= 50");
if (r2.fitScore > 40) throw new Error("weak resume should score <= 40");
if (!r1.matched.includes("sql")) throw new Error("SQL should be matched");
if (!r1.experienceHints.some((h) => /5\+?\s*years/i.test(h))) throw new Error("experience hint missing");
if (!r2.missing.includes("python")) throw new Error("python should be missing from weak resume");
console.log("ALL MATCH-ENGINE CHECKS PASSED ✓");
