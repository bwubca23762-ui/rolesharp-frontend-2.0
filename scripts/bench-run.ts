import { DATASET } from "./bench-dataset";
import { tailor } from "../lib/tailor";
import { atsScore, atsDiagnostics } from "../lib/ats-score";
import { env } from "../lib/env";
import type { ResumeContent as RC } from "../lib/types";
import type { GenerateRequest } from "../lib/types";

// Map an original sample resume (profile shape) into the ResumeContent shape so
// it can be scored by the SAME atsScore() that grades RoleSharp's output.
function profileToContent(p: any): RC {
  return {
    headline: p.experiences?.[0]?.title || "",
    contact: { email: p.email, phone: p.phone, location: p.location },
    summary: p.summary || "",
    skills: p.skills || [],
    experiences: (p.experiences || []).map((e: any) => ({
      title: e.title, company: e.company,
      period: [e.start, e.end].filter(Boolean).join("–"),
      bullets: e.bullets || [],
    })),
    education: p.education || [],
    projects: p.projects || [],
    certifications: p.certifications || [],
    languages: p.languages || [],
    achievements: p.achievements || [],
  };
}

function bulletStats(content: RC) {
  const bullets = content.experiences.flatMap((e) => e.bullets || []);
  const withNum = bullets.filter((b) => /\d/.test(b)).length;
  return { count: bullets.length, quantified: withNum, pctQuantified: bullets.length ? Math.round((withNum / bullets.length) * 100) : 0 };
}

async function run() {
  const onlyId = process.argv.find((arg) => arg.startsWith("--id="))?.split("=")[1];
  const data = onlyId ? DATASET.filter((item) => item.id === onlyId) : DATASET;
  const model: "claude" | "gemini" = env.proxyUrl ? "claude" : "gemini";
  const rows: any[] = [];
  for (const item of data) {
    const orig = profileToContent(item.profile);
    const origScore = atsScore(item.jdText, orig);
    const origDiag = atsDiagnostics(item.jdText, orig);
    const origBul = bulletStats(orig);

    const req = {
      profile: item.profile,
      roleTitleRaw: item.roleTitle,
      companyNameRaw: item.company,
      jdText: item.jdText,
      template: "basic",
    } as unknown as GenerateRequest;

    let outScore = 0, outKw = 0, outBul = { count: 0, quantified: 0, pctQuantified: 0 }, err = "";
    let outMissing: string[] = [];
    const origMissing = origDiag.missingKeywords;
    try {
      // premium=true exercises the full ATS-optimization pass (best output).
      const { content, atsScore: s } = await tailor(req, null, item.company, model, true);
      outScore = s;
      const outDiag = atsDiagnostics(item.jdText, content);
      outKw = Math.round(outDiag.keywordCoverage * 100);
      outBul = bulletStats(content);
      outMissing = outDiag.missingKeywords;
    } catch (e: any) {
      err = e?.message || String(e);
    }

    const r = {
      id: item.id, role: item.role, level: item.level,
      origScore, outScore, deltaScore: outScore - origScore,
      origKw: Math.round(origDiag.keywordCoverage * 100), outKw, deltaKw: outKw - Math.round(origDiag.keywordCoverage * 100),
      origBulletsQ: origBul.pctQuantified, outBulletsQ: outBul.pctQuantified,
      origMissing, outMissing,
      err,
    };
    rows.push(r);
    console.log(`#${r.id} ${r.role} (${r.level}): ATS ${origScore}→${outScore} (+${r.deltaScore}) | KW ${r.origKw}%→${outKw}% | quantified ${origBul.pctQuantified}%→${outBul.pctQuantified}% | missing ${origMissing.length}→${outMissing.length} ${err ? "ERR:" + err : ""}`);
  }

  // Summary
  const ok = rows.filter((r) => !r.err);
  if (!ok.length) {
    console.log("\n===== SUMMARY (n=0) =====");
    console.log("No successful benchmark runs. Check model credentials or proxy availability.");
    console.log("\nJSON:\n" + JSON.stringify(rows));
    return;
  }
  const avg = (f: (r: any) => number) => Math.round(ok.reduce((s, r) => s + f(r), 0) / ok.length);
  console.log("\n===== SUMMARY (n=" + ok.length + ") =====");
  console.log(`Avg ATS:        ${avg((r) => r.origScore)} -> ${avg((r) => r.outScore)}  (+${avg((r) => r.deltaScore)})`);
  console.log(`Avg KW match:   ${avg((r) => r.origKw)}% -> ${avg((r) => r.outKw)}%  (+${avg((r) => r.deltaKw)})`);
  console.log(`Avg quantified: ${avg((r) => r.origBulletsQ)}% -> ${avg((r) => r.outBulletsQ)}%`);
  const wins = ok.filter((r) => r.outScore > r.origScore).length;
  const avgMissing = Math.round(ok.reduce((sum, r) => sum + r.outMissing.length, 0) / ok.length);
  console.log(`RoleSharp scored higher on ${wins}/${ok.length} resumes.`);
  console.log(`Avg remaining missing keywords: ${avgMissing}`);
  console.log("\nJSON:\n" + JSON.stringify(rows));
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
