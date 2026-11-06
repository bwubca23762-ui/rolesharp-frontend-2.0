import { z } from "zod";

type PhotoPolicyStatus = "prohibited" | "discouraged" | "optional" | "customary" | "required";

export type PhotoPolicy = {
  status: PhotoPolicyStatus;
  title: string;
  guidance: string;
};

type Rules = Record<string, unknown> | undefined;

// Legacy country rows used yes/no/optional without sources. A legacy "yes" is
// treated as customary, never required. Only an explicitly verified structured
// policy may force or prohibit a photo.
export function resumePhotoPolicy(rules: Rules): PhotoPolicy {
  const structured = rules?.photoPolicy;
  if (structured && typeof structured === "object") {
    const value = structured as Record<string, unknown>;
    const status = value.status;
    const verified = value.verified === true;
    if (verified && status === "required") {
      return { status, title: "Photo required for this application", guidance: "This requirement is backed by a verified application rule. Add a recent professional headshot." };
    }
    if (verified && status === "prohibited") {
      return { status, title: "Do not add a photo", guidance: "A verified employer or application rule prohibits photos for this application." };
    }
    if (status === "discouraged") {
      return { status, title: "Photo normally discouraged", guidance: "Leave it out unless the employer or job posting explicitly requests one." };
    }
    if (status === "customary") {
      return { status, title: "Photo can be customary", guidance: "It is optional. Include one only when it suits the role and local application practice." };
    }
  }

  const legacy = typeof rules?.photo === "string" ? rules.photo.toLowerCase() : "";
  if (legacy === "no") {
    return { status: "discouraged", title: "Photo normally discouraged", guidance: "Keep the resume photo-free unless the employer or job posting explicitly asks for one." };
  }
  if (legacy === "yes") {
    return { status: "customary", title: "Photo may be customary", guidance: "This is an older market convention, not a verified requirement. Adding a photo remains your choice." };
  }
  return { status: "optional", title: "Photo optional", guidance: "No verified requirement was found. A photo is available, but the privacy-safe default is to leave it out." };
}

export const ResumePhotoDataUrl = z
  .string()
  .max(1_500_000)
  .regex(/^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/)
  .optional();

export function photoDataUrlBuffer(value?: string): { data: Buffer; type: "jpg" | "png" } | null {
  const parsed = ResumePhotoDataUrl.safeParse(value);
  if (!parsed.success || !parsed.data) return null;
  const comma = parsed.data.indexOf(",");
  return {
    data: Buffer.from(parsed.data.slice(comma + 1), "base64"),
    type: parsed.data.startsWith("data:image/png") ? "png" : "jpg",
  };
}
