"use client";
import { useState } from "react";

// Absolute and production-pinned on purpose: this widget renders inside other
// people's sites, so a relative href would resolve against their domain and a
// staging host would send their visitors somewhere that is not the product.
// Written once here because it was previously repeated in two places.
const CHECKER_URL = "https://rolesharp.com/checker";

const ACTION_VERBS = [
  "achieved","built","led","improved","increased","reduced","managed","developed",
  "launched","optimized","drove","delivered","created","designed","implemented",
  "spearheaded","streamlined","coordinated","established","generated","accelerated",
  "transformed","negotiated","executed","oversaw","trained","mentored","analyzed",
];

const SECTION_HEADINGS = [
  /experience|work history|employment/i,
  /education|academic/i,
  /skills|competencies|expertise/i,
  /summary|objective|profile/i,
];

function scoreResume(text: string): { total: number; breakdown: { label: string; score: number; max: number; note: string }[] } {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);

  // 1. Length (20pts): 400-800 ideal
  const lengthScore = words < 100 ? 0 : words < 300 ? 8 : words <= 800 ? 20 : words <= 1200 ? 14 : 8;
  const lengthNote = words < 100 ? "Too short — add more content" : words > 1000 ? `${words} words — trim to under 800` : `${words} words — good length`;

  // 2. Action verbs (25pts)
  const lower = text.toLowerCase();
  const foundVerbs = ACTION_VERBS.filter(v => lower.includes(v));
  const verbScore = Math.min(25, Math.round((foundVerbs.length / 8) * 25));
  const verbNote = foundVerbs.length < 4 ? `Only ${foundVerbs.length} action verbs — add more (led, built, improved…)` : `${foundVerbs.length} action verbs found`;

  // 3. Quantified bullets (25pts): numbers with % $ x or plain numbers ≥2 digits
  const quantMatches = (text.match(/\d+\s*%|\$\s*\d+|\d{2,}[\+k]?|\d+x\b/gi) || []).length;
  const quantScore = Math.min(25, Math.round((quantMatches / 5) * 25));
  const quantNote = quantMatches < 2 ? "Add numbers: % improvements, $ amounts, team sizes" : `${quantMatches} quantified achievements`;

  // 4. Section headings (15pts)
  const foundSections = SECTION_HEADINGS.filter(rx => lines.some(l => rx.test(l)));
  const sectionScore = Math.round((foundSections.length / SECTION_HEADINGS.length) * 15);
  const sectionNote = foundSections.length < 3 ? "Missing sections — add Experience, Education, Skills" : "All key sections present";

  // 5. Skills density (15pts): lines matching keyword-list patterns
  const skillLines = lines.filter(l => /,/.test(l) && l.length < 120).length;
  const skillScore = Math.min(15, Math.round((skillLines / 3) * 15));
  const skillNote = skillLines < 2 ? "Add a dedicated Skills section with comma-separated keywords" : "Skills section detected";

  const total = lengthScore + verbScore + quantScore + sectionScore + skillScore;
  return {
    total,
    breakdown: [
      { label: "Length", score: lengthScore, max: 20, note: lengthNote },
      { label: "Action Verbs", score: verbScore, max: 25, note: verbNote },
      { label: "Quantified Results", score: quantScore, max: 25, note: quantNote },
      { label: "Section Structure", score: sectionScore, max: 15, note: sectionNote },
      { label: "Skills Keywords", score: skillScore, max: 15, note: skillNote },
    ],
  };
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#dc2626";
  const r = 36; const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" aria-label={`ATS score: ${score}`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform="rotate(-90 50 50)" style={{ transition: "stroke-dasharray .6s ease" }} />
      <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill={color}>{score}</text>
      <text x="50" y="62" textAnchor="middle" fontSize="10" fill="#6b7280">/100</text>
    </svg>
  );
}

export default function EmbedAtsScore() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReturnType<typeof scoreResume> | null>(null);

  const run = () => { if (text.trim().length > 20) setResult(scoreResume(text)); };

  return (
    <div style={{ fontFamily: "system-ui,sans-serif", background: "#fff", minHeight: "100vh", padding: "16px", boxSizing: "border-box" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          Free ATS Resume Score
        </h1>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 10 }}>
          Paste your resume text to get an instant ATS readiness score.
        </p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste your resume text here…"
          rows={7}
          style={{ width: "100%", padding: "10px 12px", border: "1.5px solid #d1d5db", borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none" }}
        />
        <button
          onClick={run}
          disabled={text.trim().length < 20}
          style={{ marginTop: 8, width: "100%", padding: "10px 0", background: "#4F46E5", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", opacity: text.trim().length < 20 ? 0.5 : 1 }}
        >
          Check ATS Score
        </button>

        {result && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <ScoreRing score={result.total} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: result.total >= 75 ? "#16a34a" : result.total >= 50 ? "#d97706" : "#dc2626" }}>
                  {result.total >= 75 ? "Strong" : result.total >= 50 ? "Needs Work" : "Weak"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>Quick ATS readiness estimate</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {result.breakdown.map(b => (
                <div key={b.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                    <span style={{ color: "#374151", fontWeight: 500 }}>{b.label}</span>
                    <span style={{ color: "#6b7280" }}>{b.score}/{b.max}</span>
                  </div>
                  <div style={{ background: "#f3f4f6", borderRadius: 99, height: 6 }}>
                    <div style={{ width: `${(b.score / b.max) * 100}%`, background: b.score / b.max >= 0.75 ? "#16a34a" : b.score / b.max >= 0.5 ? "#d97706" : "#ef4444", borderRadius: 99, height: 6, transition: "width .4s ease" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{b.note}</div>
                </div>
              ))}
            </div>
            <a
              href={CHECKER_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "block", marginTop: 14, padding: "9px 0", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, textAlign: "center", fontSize: 12, color: "#0369a1", fontWeight: 600, textDecoration: "none" }}
            >
              Get full AI-powered analysis →
            </a>
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 10, borderTop: "1px solid #f3f4f6", textAlign: "center" }}>
          <a href={CHECKER_URL} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "#6b7280", textDecoration: "none" }}>
            ⚡ Powered by <strong style={{ color: "#4F46E5" }}>RoleSharp</strong> — Free ATS Resume Checker
          </a>
        </div>
      </div>
    </div>
  );
}
