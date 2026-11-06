import { z } from "zod";

const optionalText = z.union([z.string(), z.null()]).transform((value) => value ?? undefined).optional();

const ImpactFactsSchema = z.object({
  metric: optionalText,
  scope: optionalText,
  outcome: optionalText,
  timeframe: optionalText,
});

// User-supplied structured facts. The LLM may ONLY use these — no invention.
const ProfileSchema = z.object({
  name: z.string(),
  email: optionalText,
  phone: optionalText,
  linkedin: optionalText,
  country: optionalText,
  location: optionalText,
  links: z.array(z.string()).default([]),
  careerLevel: optionalText,
  summary: optionalText,
  skills: z.array(z.string()).default([]),
  experiences: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        location: optionalText,
        start: optionalText,
        end: optionalText,
        bullets: z.array(z.string()).default([]),
        impactFacts: ImpactFactsSchema.optional(),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        degree: z.string(),
        school: z.string(),
        year: optionalText,
        detail: optionalText,
      }),
    )
    .default([]),
  projects: z
    .array(z.object({ name: z.string(), detail: z.string() }))
    .default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  achievements: z.array(z.string()).default([]),
});

export const GenerateRequest = z.object({
  profile: ProfileSchema,
  companySlug: optionalText,
  roleSlug: optionalText,
  // Free-typed company/role (when the user didn't pick a DB match) so the LLM
  // still gets a real name instead of "(generic)".
  companyNameRaw: z.string().max(120).optional(),
  roleTitleRaw: z.string().max(120).optional(),
  jdText: z.union([z.string().max(20000), z.null()]).optional().transform((value) => value ?? undefined), // pasted JD = strongest signal
  deviceId: z.union([z.string().max(64), z.null()]).optional().transform((value) => value ?? undefined),
  template: z.string().max(32).default("basic"),
});
export type GenerateRequest = z.infer<typeof GenerateRequest>;

// Structured resume the LLM must return (validated -> no malformed output).
const resumeText = z.string().max(4000);
const resumeShortText = z.string().max(500);
const optionalResumeText = z.union([resumeText, z.null()]).transform((value) => value ?? undefined).optional();
const optionalResumeShortText = z.union([resumeShortText, z.null()]).transform((value) => value ?? undefined).optional();
const resumeList = <T extends z.ZodTypeAny>(item: T, max = 50) => z.array(item).max(max);

export const ResumeContent = z.object({
  headline: resumeShortText,
  contact: z
    .object({
      email: resumeShortText.optional(),
      phone: optionalResumeShortText,
      linkedin: optionalResumeShortText,
      location: optionalResumeShortText,
      links: resumeList(resumeShortText, 20).optional(),
    })
    .optional(),
  summary: resumeText,
  skills: resumeList(resumeShortText, 100),
  experiences: resumeList(
    z.object({
      title: resumeShortText,
      company: resumeShortText,
      period: optionalResumeShortText,
      bullets: resumeList(resumeText, 50),
    }),
    50,
  ),
  education: resumeList(
    z.object({ degree: resumeShortText, school: resumeShortText, year: optionalResumeShortText, detail: optionalResumeText }),
    30,
  ),
  projects: resumeList(z.object({ name: resumeShortText, detail: resumeText }), 50).default([]),
  certifications: resumeList(resumeShortText, 100).default([]),
  languages: resumeList(resumeShortText, 50).default([]),
  achievements: resumeList(resumeText, 100).default([]),
});
export type ResumeContent = z.infer<typeof ResumeContent>;
