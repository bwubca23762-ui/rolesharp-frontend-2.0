export const COMPANY_TYPE_KEYS = [
  "general", "enterprise", "big-tech", "startup", "consulting", "government",
  "finance", "healthcare", "nonprofit", "academic",
] as const;

export type CompanyType = (typeof COMPANY_TYPE_KEYS)[number];

export const COMPANY_GUIDANCE: Record<CompanyType, { label: string; priorities: string[] }> = {
  general: {
    label: "General / not sure",
    priorities: ["Use standard headings and reverse chronology.", "Match only truthful job-description terms.", "Lead bullets with action, evidence, and result."],
  },
  enterprise: {
    label: "Large enterprise / ATS-heavy",
    priorities: ["Use a single column and standard headings.", "Repeat exact tools and certifications beside proof.", "Verify every auto-filled application field after upload."],
  },
  "big-tech": {
    label: "Big tech / product company",
    priorities: ["Show impact, scale, technical depth, and tradeoffs.", "Use concise Accomplished X, measured by Y, by doing Z bullets.", "Link strong projects or work samples when relevant."],
  },
  startup: {
    label: "Startup / scale-up",
    priorities: ["Show ownership, speed, breadth, and customer outcomes.", "Name what you shipped and the constraint you handled.", "Keep tools tied to delivered work, not a long inventory."],
  },
  consulting: {
    label: "Consulting / professional services",
    priorities: ["Show structured problem solving and quantified business results.", "Surface client, stakeholder, and communication evidence.", "Prioritize recent, high-impact work over routine duties."],
  },
  government: {
    label: "Government / public sector",
    priorities: ["Follow the announcement's qualifications and required-document rules exactly.", "Include month/year dates and hours worked per week for each relevant role.", "Use plain language and address every specialized-experience requirement."],
  },
  finance: {
    label: "Finance / regulated company",
    priorities: ["Show accuracy, controls, compliance, risk, and measurable outcomes.", "Name relevant licenses, systems, and regulated domains truthfully.", "Avoid exposing confidential client or transaction data."],
  },
  healthcare: {
    label: "Healthcare / life sciences",
    priorities: ["Lead with licenses, clinical or domain scope, quality, and safety.", "Use role-specific systems and standards only where evidenced.", "Remove patient-identifying or confidential information."],
  },
  nonprofit: {
    label: "Nonprofit / mission-led",
    priorities: ["Connect skills to mission outcomes and communities served.", "Quantify fundraising, program reach, volunteers, or delivery results.", "Show partnership and resource stewardship evidence."],
  },
  academic: {
    label: "Academic / research",
    priorities: ["Prioritize education, research, publications, methods, and teaching as relevant.", "Use a CV only when the institution or role expects one.", "State contribution, methods, outputs, and verified recognition clearly."],
  },
};

export function companyGuidance(type?: CompanyType) {
  return COMPANY_GUIDANCE[type ?? "general"];
}
