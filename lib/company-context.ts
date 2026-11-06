export type CompanyStyleProfile = {
  tone: string[];
  values: string[];
  keyword_density: "medium" | "high";
  summary_focus: string[];
  bullet_style: string[];
  preferred_emphasis: string[];
};

export type CompanyContext = {
  name?: string;
  sector?: string;
  atsSystem?: string;
  sizeBand?: string;
  styleProfile?: CompanyStyleProfile | null;
  guidanceSource: "catalog_profile" | "sector_inference";
} | null;

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function inferCompanyStyleProfile(sector?: string | null): CompanyStyleProfile {
  const key = (sector ?? "").toLowerCase();
  if (/(technology|software|internet|cloud|ai|semiconductor)/i.test(key)) {
    return {
      tone: ["technical", "execution-focused", "innovation-minded"],
      values: ["ownership", "scalability", "cross-functional collaboration"],
      keyword_density: "high",
      summary_focus: ["systems impact", "technical depth", "shipping at scale"],
      bullet_style: ["action-led", "metric-driven", "architecture-aware"],
      preferred_emphasis: ["performance", "reliability", "distributed systems", "product delivery"],
    };
  }
  if (/(it services|consulting|professional services|outsourcing)/i.test(key)) {
    return {
      tone: ["client-facing", "delivery-focused", "process-driven"],
      values: ["stakeholder management", "quality", "continuous improvement"],
      keyword_density: "high",
      summary_focus: ["delivery ownership", "client outcomes", "cross-team execution"],
      bullet_style: ["impact-first", "stakeholder-aware", "process-improvement"],
      preferred_emphasis: ["SLA delivery", "stakeholder communication", "quality", "implementation"],
    };
  }
  if (/(banking|financial|insurance|fintech)/i.test(key)) {
    return {
      tone: ["risk-aware", "precision-focused", "regulated"],
      values: ["compliance", "accuracy", "trust", "stakeholder communication"],
      keyword_density: "medium",
      summary_focus: ["accuracy", "risk control", "regulated execution"],
      bullet_style: ["precise", "control-oriented", "audit-friendly"],
      preferred_emphasis: ["compliance", "reconciliation", "data accuracy", "risk mitigation"],
    };
  }
  if (/(health|pharma|biotech)/i.test(key)) {
    return {
      tone: ["evidence-based", "quality-focused", "regulated"],
      values: ["documentation", "reliability", "patient impact"],
      keyword_density: "medium",
      summary_focus: ["quality of care", "evidence-based work", "documentation discipline"],
      bullet_style: ["clear", "safe", "outcome-aware"],
      preferred_emphasis: ["patient outcomes", "documentation", "protocol adherence", "quality"],
    };
  }
  if (/(automotive|manufacturing|industrial|energy)/i.test(key)) {
    return {
      tone: ["process-focused", "quality-driven", "operations-aware"],
      values: ["safety", "reliability", "continuous improvement"],
      keyword_density: "medium",
      summary_focus: ["process improvement", "operations quality", "reliability"],
      bullet_style: ["operations-oriented", "efficiency-led", "quality-first"],
      preferred_emphasis: ["throughput", "safety", "cost reduction", "process discipline"],
    };
  }
  return {
    tone: ["clear", "results-focused", "professional"],
    values: ["ownership", "teamwork", "execution"],
    keyword_density: "medium",
    summary_focus: ["relevant experience", "execution", "results"],
    bullet_style: ["action-led", "clear", "specific"],
    preferred_emphasis: ["results", "collaboration", "execution"],
  };
}

export function buildCompanyContext(input: {
  name?: string | null;
  sector?: string | null;
  ats_system?: string | null;
  ats_system_source_url?: string | null;
  ats_system_verified_at?: string | Date | null;
  size_band?: string | null;
  style_profile?: Partial<CompanyStyleProfile> | null;
}): CompanyContext {
  const inferred = inferCompanyStyleProfile(input.sector);
  const profile = input.style_profile
    ? {
        tone: unique([...(input.style_profile.tone ?? []), ...inferred.tone]),
        values: unique([...(input.style_profile.values ?? []), ...inferred.values]),
        keyword_density: input.style_profile.keyword_density === "high" ? "high" : inferred.keyword_density,
        summary_focus: unique([...(input.style_profile.summary_focus ?? []), ...inferred.summary_focus]),
        bullet_style: unique([...(input.style_profile.bullet_style ?? []), ...inferred.bullet_style]),
        preferred_emphasis: unique([...(input.style_profile.preferred_emphasis ?? []), ...inferred.preferred_emphasis]),
      }
    : inferred;
  return {
    name: input.name ?? undefined,
    sector: input.sector ?? undefined,
    // An ATS name affects formatting claims and must not be inferred from a
    // company name, sector, or stale aggregator row.
    atsSystem: input.ats_system && input.ats_system_source_url && input.ats_system_verified_at
      ? input.ats_system
      : undefined,
    sizeBand: input.size_band ?? undefined,
    styleProfile: profile,
    guidanceSource: input.style_profile ? "catalog_profile" : "sector_inference",
  };
}

export function companyEmbeddingText(input: {
  slug?: string | null;
  name?: string | null;
  sector?: string | null;
  aliases?: string[] | null;
  styleProfile?: Partial<CompanyStyleProfile> | null;
}) {
  const profile = input.styleProfile ?? inferCompanyStyleProfile(input.sector);
  return [
    input.name ?? "",
    input.sector ?? "",
    input.slug ?? "",
    ...(input.aliases ?? []).slice(0, 10),
    ...(profile.tone ?? []),
    ...(profile.values ?? []),
    ...(profile.summary_focus ?? []),
    ...(profile.bullet_style ?? []),
    ...(profile.preferred_emphasis ?? []),
    profile.keyword_density ?? "",
  ].filter(Boolean).join("\n");
}
