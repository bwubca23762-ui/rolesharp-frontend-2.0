import { chat } from "./llm";
import type { BlogPost, BlogSection } from "./blog";

// Multi-pass AI blog generator. Pipeline adapted from the n8n SEO-blog recipe:
//   outline -> write (1500+ words) -> AEO edit -> humanize -> assemble.
// Uses the existing provider chain (Claude -> Gemini -> Atomesus). No n8n.
//
// Humanizing rules (kill the "AI-made" smell): vary sentence length, use
// contractions, active voice, and NEVER the clichés below.
const AI_CLICHES = [
  "In conclusion", "It is worth noting", "Furthermore", "Moreover",
  "In today's fast-paced world", "Let's dive in", "Dive into", "In the realm of",
  "It's important to note", "Last but not least", "When it comes to",
  "Navigating the", "Unlock", "Unleash", "Elevate", "In summary",
];

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function parseJson<T>(raw: string, label: string): T {
  const cleaned = stripFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Salvage the first {...} or [...] block if the model wrapped it in prose.
    const obj = cleaned.match(/\{[\s\S]*\}/);
    const arr = cleaned.match(/\[[\s\S]*\]/);
    const candidate = arr && (!obj || arr.index! <= obj.index!) ? arr[0] : obj?.[0];
    if (candidate) {
      try { return JSON.parse(candidate) as T; } catch {}
      // Last resort: trim a truncated array back to its last complete object.
      const fixed = trimTruncatedArray(candidate);
      if (fixed) { try { return JSON.parse(fixed) as T; } catch {} }
    }
    throw new Error(`blog-gen: ${label} returned invalid JSON`);
  }
}

// If a JSON array got cut off mid-stream (token limit), close it after the last
// complete top-level object so we keep the sections that did come through.
function trimTruncatedArray(s: string): string | null {
  if (!s.startsWith("[")) return null;
  let depth = 0, inStr = false, esc = false, lastClose = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) lastClose = i; }
  }
  if (lastClose === -1) return null;
  return s.slice(0, lastClose + 1) + "]";
}

const BRAND = `You are writing for RoleSharp (rolesharp.com), a free global AI resume builder and ATS checker that tailors resumes to a specific company, role, and country. Audience: job seekers worldwide across North America, Europe, Asia-Pacific, India, and the Middle East. Tone: direct, practical, no fluff, no hype. You may mention RoleSharp where genuinely relevant, but never sound like an ad.`;

type Outline = {
  title: string;
  h1: string;
  description: string;
  answer: string;
  category: "How-To" | "Comparison" | "Guide" | "List";
  tags: string[];
  sections: { heading: string; intent: string }[];
  faqs: string[];
};

// Pass 1 — research-free outline (the topic + brand context is the brief).
async function outline(topic: string): Promise<Outline> {
  const prompt = `${BRAND}

Create a detailed blog outline for the topic: "${topic}".

Rules:
- title: under 60 characters, includes the primary keyword, compelling.
- h1: the visible headline (can equal title or be slightly longer).
- description: meta description under 160 characters, includes the keyword.
- answer: a direct 40-60 word answer to the core question (this becomes a "Quick answer" box for featured snippets). No preamble.
- category: one of "How-To" | "Comparison" | "Guide" | "List".
- tags: 3-5 short topic tags.
- sections: 5-8 sections, each {heading, intent}. Headings should be specific; where natural, phrase as a question. intent = one sentence on what that section covers.
- faqs: 5 real questions a reader would ask (just the questions here).

Return ONLY JSON: {"title","h1","description","answer","category","tags":[],"sections":[{"heading","intent"}],"faqs":[]}`;
  const raw = await chat([{ role: "user", content: prompt }], { json: true, temperature: 0.4, model: "claude" });
  return parseJson<Outline>(raw, "outline");
}

// Pass 2 — write each section body (paragraphs + optional bullets/table).
async function writeSections(topic: string, o: Outline): Promise<BlogSection[]> {
  const prompt = `${BRAND}

Write the full body for a blog post titled "${o.h1}" on the topic "${topic}".

Sections to write (in order):
${o.sections.map((s, i) => `${i + 1}. ${s.heading} — ${s.intent}`).join("\n")}

Rules:
- Total length 1500-2200 words across all sections.
- Primary keyword appears in the first 100 words and in at least two section headings.
- Each section: 2-4 short paragraphs. Break up any paragraph longer than 5 sentences.
- Use bullet lists for steps/tips (set "ordered":true for sequential steps).
- If a section compares options or prices, include a "table" with headers + rows instead of prose.
- Write for a person, not a search engine. Concrete examples over generic advice.

Return ONLY JSON: an array matching the sections, each:
{"heading","paragraphs":["..."],"bullets":["..."]?,"ordered":true|false?,"table":{"headers":[],"rows":[[]]}?}`;
  const raw = await chat([{ role: "user", content: prompt }], { json: true, temperature: 0.5, model: "claude", maxTokens: 8000 });
  const arr = parseJson<BlogSection[]>(raw, "sections");
  return Array.isArray(arr) ? arr : [];
}

// Pass 3 — humanize: strip AI clichés, vary rhythm, keep meaning + length.
async function humanize(sections: BlogSection[]): Promise<BlogSection[]> {
  const prompt = `${BRAND}

Rewrite the paragraphs in this JSON to sound genuinely human-written. Keep the same JSON structure, headings, bullets, and tables. Keep roughly the same length and ALL facts.

Humanizing rules:
- Vary sentence length dramatically — mix short punchy sentences with longer ones.
- Use contractions and active voice. Occasional first-person observation is fine.
- NEVER use these phrases: ${AI_CLICHES.join(", ")}.
- No hype words, no filler transitions. Cut anything that sounds like marketing.

Input JSON:
${JSON.stringify(sections).slice(0, 12000)}

Return ONLY the rewritten JSON array, same shape.`;
  const raw = await chat([{ role: "user", content: prompt }], { json: true, temperature: 0.6, model: "claude", maxTokens: 8000 });
  try {
    const arr = parseJson<BlogSection[]>(raw, "humanize");
    return Array.isArray(arr) && arr.length ? arr : sections;
  } catch {
    return sections; // humanize is best-effort; never lose the draft
  }
}

// Pass 4 — short FAQ answers (40-60 words each, snippet-friendly).
async function answerFaqs(o: Outline): Promise<[string, string][]> {
  const prompt = `${BRAND}

Answer each of these questions in 40-60 words, directly, no preamble:
${o.faqs.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Return ONLY JSON: an array of [question, answer] pairs: [["q","a"], ...]`;
  const raw = await chat([{ role: "user", content: prompt }], { json: true, temperature: 0.4, model: "claude" });
  try {
    const arr = parseJson<[string, string][]>(raw, "faqs");
    return Array.isArray(arr) ? arr.filter((x) => Array.isArray(x) && x.length === 2) : [];
  } catch {
    // No usable JSON from the model — skip the FAQ section rather than
    // rendering questions with blank answers. (The old "fallback" built
    // [q, ""] pairs then filtered on the empty answer — always [].)
    return [];
  }
}

function wordCount(sections: BlogSection[]): number {
  return sections.reduce((n, s) => {
    const p = (s.paragraphs ?? []).join(" ");
    const b = (s.bullets ?? []).join(" ");
    return n + (p + " " + b).split(/\s+/).filter(Boolean).length;
  }, 0);
}

export type GeneratedPost = BlogPost & { _words: number };

export async function generatePost(topic: string, todayIso: string): Promise<GeneratedPost> {
  const o = await outline(topic);
  let sections = await writeSections(topic, o);
  if (!sections.length) throw new Error("blog-gen: no sections produced");
  sections = await humanize(sections);
  const faqs = await answerFaqs(o);
  const words = wordCount(sections);
  const readMins = Math.max(3, Math.round(words / 220));

  const post: BlogPost = {
    slug: slugify(o.title || topic),
    title: o.title,
    h1: o.h1 || o.title,
    description: o.description,
    answer: o.answer,
    datePublished: todayIso,
    dateModified: todayIso,
    readMins,
    tags: o.tags ?? [],
    category: o.category ?? "Guide",
    sections,
    faqs,
  };
  return { ...post, _words: words };
}
