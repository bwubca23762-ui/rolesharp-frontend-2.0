import { domainToASCII } from "node:url";
import { createHash } from "node:crypto";
import { normalizeSkillText } from "./normalization";

type IndexedJob = {
  title: string;
  description: string | null;
  location: string | null;
  country_code: string;
  is_remote: boolean;
  job_type: string | null;
  salary_min: string | number | null;
  salary_max: string | number | null;
  salary_currency: string | null;
  salary_interval: string | null;
  date_posted: string | Date | null;
  last_seen_at: string | Date;
  expires_at: string | Date;
  recipientProvenance?: Parameters<typeof extractApplicationRecipient>[1];
};

const seniorityFromTitle = (title: string) => {
  const value = title.toLocaleLowerCase("en");
  if (/\b(principal)\b/u.test(value)) return "principal" as const;
  if (/\b(staff|lead)\b/u.test(value)) return "staff_or_lead" as const;
  if (/\b(senior|sr\.?|iii)\b/u.test(value)) return "senior" as const;
  if (/\b(intern|internship)\b/u.test(value)) return "intern" as const;
  if (/\b(junior|jr\.?|entry|graduate)\b/u.test(value)) return "entry" as const;
  return "mid" as const;
};

const workType = (value: string | null) => {
  const text = (value ?? "").toLocaleLowerCase("en").replace(/\s+/gu, "");
  if (text.includes("parttime")) return "part_time" as const;
  if (text.includes("contract")) return "contract" as const;
  if (text.includes("intern")) return "internship" as const;
  if (text.includes("temporary")) return "temporary" as const;
  return "full_time" as const;
};

const period = (value: string | null) => {
  const text = (value ?? "").toLocaleLowerCase("en");
  if (text.includes("hour")) return "hourly" as const;
  if (text.includes("day")) return "daily" as const;
  if (text.includes("week")) return "weekly" as const;
  if (text.includes("month")) return "monthly" as const;
  return "annual" as const;
};

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "icloud.com", "proton.me", "protonmail.com", "aol.com",
]);

function relatedDomain(candidate: string, employer?: string): boolean {
  if (!employer) return true;
  return candidate === employer || candidate.endsWith(`.${employer}`) || employer.endsWith(`.${candidate}`);
}

function instructionContext(body: string, offset: number, endOffset: number) {
  // Newlines are stable instruction-block boundaries; punctuation cannot be
  // used because dots inside email domains would split the provenance block.
  const leftBoundary = Math.max(body.lastIndexOf("\n", offset - 1), offset - 500);
  const nextLine = body.indexOf("\n", endOffset);
  const rightBoundary = Math.min(nextLine >= 0 ? nextLine : body.length, endOffset + 500);
  const start = Math.max(0, leftBoundary + 1);
  return { start, end: rightBoundary, text: body.slice(start, rightBoundary).trim() };
}

function explicitApplicationInstruction(value: string): boolean {
  return /\b(?:apply|application|resume|cv)\b/iu.test(value)
    && /\b(?:email|e-mail|send|forward)\b/iu.test(value);
}

export function extractApplicationRecipient(description: string | null, provenance: {
  canonicalJobKey?: string;
  sourceUrl?: string;
  providerNamespace?: string;
  providerJobId?: string;
  capturedAt?: string | Date;
  expectedEmployerDomain?: string;
  contentHash?: string;
} = {}) {
  const body = (description ?? "").slice(0, 200_000);
  const contentHash = provenance.contentHash ?? createHash("sha256").update(body, "utf8").digest("hex");
  const employerDomain = provenance.expectedEmployerDomain?.toLocaleLowerCase("en").replace(/^www\./u, "");
  const candidates: Array<Record<string, unknown> & { email: string; warnings: string[] }> = [];
  let invalidInstructionAddress = false;
  const tokenPattern = /[^\s<>()"',;:\r\n]+@[^\s<>()"',;:\r\n]+/gu;
  let token: RegExpExecArray | null;
  while ((token = tokenPattern.exec(body)) !== null) {
    const raw = token[0].replace(/[.?!]+$/u, "");
    const startOffset = token.index;
    const endOffset = startOffset + raw.length;
    const context = instructionContext(body, startOffset, endOffset);
    if (!explicitApplicationInstruction(context.text)) continue;
    const at = raw.lastIndexOf("@");
    const local = raw.slice(0, at);
    const literalDomain = raw.slice(at + 1);
    const asciiDomain = domainToASCII(literalDomain).toLocaleLowerCase("en");
    const asciiLocal = /^[\x21-\x7E]+$/u.test(local);
    const valid = asciiLocal && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/iu.test(local)
      && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..")
      && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(asciiDomain);
    if (!valid) { invalidInstructionAddress = true; continue; }
    const email = `${local.toLocaleLowerCase("en")}@${asciiDomain}`;
    const warnings: string[] = [];
    if (local.includes("+")) warnings.push("plus_address");
    if (FREE_MAIL_DOMAINS.has(asciiDomain)) warnings.push("free_mail_domain");
    if (!relatedDomain(asciiDomain, employerDomain)) warnings.push("employer_domain_mismatch");
    if (literalDomain !== asciiDomain || asciiDomain.includes("xn--")) warnings.push("unicode_or_punycode_domain");
    const before = body.slice(Math.max(0, startOffset - 160), startOffset);
    const after = body.slice(endOffset, Math.min(body.length, endOffset + 2));
    if (/<\s*$/u.test(before) && /^\s*>/u.test(after)) warnings.push("display_name_address");
    if (/^[\r\n]+\s*(?:bcc|cc|to|from|subject)\s*:/iu.test(body.slice(endOffset, endOffset + 160))) {
      warnings.push("header_injection_context");
    }
    candidates.push({
      email, literal: raw, startOffset, endOffset,
      instruction: context.text.slice(0, 1000), instructionStartOffset: context.start,
      source: "stored_posting", warnings,
    });
  }
  const unique = [...new Map(candidates.map((candidate) => [candidate.email, candidate])).values()];
  const contextText = unique.map((candidate) => String(candidate.instruction)).join("\n");
  const unsafeContext = /\b(?:support|privacy|data protection|legal|press|media|accommodation|accessibility|technical issue|questions? about)\b/iu.test(contextText)
    || unique.some((candidate) => candidate.warnings.includes("header_injection_context"));
  const obfuscatedPattern = /\b[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\)| at )\s*[A-Z0-9.-]+\s*(?:\[dot\]|\(dot\)| dot )\s*[A-Z]{2,}\b/giu;
  const obfuscatedInstruction = [...body.matchAll(obfuscatedPattern)].some((match) =>
    explicitApplicationInstruction(instructionContext(body, match.index, match.index + match[0].length).text));
  const malformedInstruction = invalidInstructionAddress;
  const employerDomainVerified = Boolean(employerDomain);
  const disposition = unsafeContext || obfuscatedInstruction || malformedInstruction
    ? "manual_only" : unique.length === 0 ? "manual_only"
      : unique.length > 1 || !employerDomainVerified
        || unique.some((candidate) => candidate.warnings.length > 0)
        ? "review_required" : "auto_eligible";
  const hasInstruction = unique.length > 0 || obfuscatedInstruction || malformedInstruction;
  const record = {
    disposition,
    candidates: unique,
    ...(unique.length === 1 ? { email: unique[0]?.email } : {}),
    source: "stored_posting",
    canonicalJobKey: provenance.canonicalJobKey,
    canonicalSourceUrl: provenance.sourceUrl,
    providerNamespace: provenance.providerNamespace,
    providerJobId: provenance.providerJobId,
    capturedAt: provenance.capturedAt instanceof Date ? provenance.capturedAt.toISOString() : provenance.capturedAt,
    contentHash,
    extractionVersion: 1,
    employerDomainRelationship: employerDomain ?? "unavailable",
    reasons: [
      ...(unsafeContext ? ["unsafe_or_unrelated_context"] : []),
      ...(obfuscatedInstruction ? ["obfuscated_address"] : []),
      ...(malformedInstruction ? ["malformed_address"] : []),
      ...(!employerDomainVerified && unique.length > 0 ? ["employer_domain_unavailable"] : []),
    ],
  };
  return {
    emailInstruction: hasInstruction ? "explicit" as const : "missing" as const,
    recipient: unique.length > 0 && !unsafeContext ? "source_backed" as const
      : hasInstruction ? "unverified" as const : "missing" as const,
    record: hasInstruction ? record : null,
  };
}

export function extractIndexedJobFacts(job: IndexedJob, canonicalJobKey: string) {
  const description = (job.description ?? "").slice(0, 200_000);
  const sentences = description.split(/(?<=[.!?\n])\s+/u).slice(0, 1000);
  const requirements = new Map<string, {
    text: string; kind: "required" | "preferred" | "negated"; mandatory: boolean;
    evidence: "explicit_prose"; sourceId: string;
  }>();
  sentences.forEach((sentence, index) => {
    const skills = normalizeSkillText(sentence);
    const negated = /\b(no|not|required without|does not require)\b/iu.test(sentence);
    const preferred = /\b(preferred|nice to have|bonus|plus)\b/iu.test(sentence);
    const mandatory = /\b(must|required|mandatory)\b/iu.test(sentence) && !negated;
    for (const skill of skills) {
      const candidate = {
        text: skill,
        kind: negated ? "negated" as const : preferred ? "preferred" as const : "required" as const,
        mandatory,
        evidence: "explicit_prose" as const,
        sourceId: `job:sentence:${index + 1}`,
      };
      const current = requirements.get(skill);
      if (!current || (candidate.kind === "required" && current.kind !== "required")) requirements.set(skill, candidate);
    }
  });
  const years = description.match(/\b(\d{1,2})\s*\+?\s*years?(?:\s+of)?\s+(?:relevant\s+)?experience\b/iu);
  const recipient = extractApplicationRecipient(description, job.recipientProvenance);
  const captured = new Date(job.last_seen_at);
  const published = job.date_posted ? new Date(job.date_posted) : null;
  const validPublished = published && !Number.isNaN(published.getTime()) && published.getTime() <= captured.getTime() + 300_000;
  const toMinor = (value: string | number | null) => {
    if (value === null) return undefined;
    const minor = Math.round(Number(value) * 100);
    return Number.isSafeInteger(minor) && minor >= 0 && minor <= 1_000_000_000_000 ? minor : undefined;
  };
  const lower = toMinor(job.salary_min);
  const upper = toMinor(job.salary_max);
  const currency = job.salary_currency?.toUpperCase();
  return {
    canonicalJobKey,
    title: { text: job.title.slice(0, 200), evidence: "structured" as const },
    skillRequirements: [...requirements.values()],
    ...(years?.[1] ? { experience: {
      minimumMonths: Math.min(Number(years[1]) * 12, 1200), nonNegotiable: /\b(required|must)\b/iu.test(years[0]), evidence: "explicit" as const,
    } } : {}),
    seniority: { level: seniorityFromTitle(job.title), track: /\b(manager|director|head of)\b/iu.test(job.title) ? "management" as const : "individual" as const, evidence: "inferred" as const, forbiddenLevels: [] },
    location: { locations: [(job.location || job.country_code).slice(0, 120)], remotePolicy: job.is_remote ? "remote" as const : "onsite" as const, evidence: "explicit" as const },
    authorization: {
      sponsorship: /\b(no|unable to)\s+sponsor/iu.test(description) ? "unavailable" as const
        : /\bvisa sponsorship (?:is )?(?:available|provided)/iu.test(description) ? "available" as const : "silent" as const,
      evidence: /sponsor/iu.test(description) ? "explicit" as const : "silent" as const,
    },
    workType: { type: workType(job.job_type), evidence: "explicit" as const },
    ...(currency && /^[A-Z]{3}$/u.test(currency) && (lower !== undefined || upper !== undefined) ? { compensation: {
      ...(lower === undefined ? {} : { lowerMinor: lower }), ...(upper === undefined ? {} : { upperMinor: upper }),
      currency, period: period(job.salary_interval), evidence: "explicit" as const,
    } } : {}),
    ...(validPublished ? { freshness: { publishedAt: published.toISOString(), capturedAt: captured.toISOString(), evidence: "provider" as const } } : {}),
    recipient,
  };
}
