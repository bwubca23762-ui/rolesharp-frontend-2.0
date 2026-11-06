import type { Metadata } from "next";
import MicroGeneratorPage from "@/components/tools/micro-generator-page";

export const metadata: Metadata = {
  title: "30-60-90 Day Plan Generator — Free, No Account",
  description:
    "Generate a 30-60-90 day plan for your new role from what you were hired to achieve — learn, own, deliver, with check-in questions for each phase. Free, no signup.",
  alternates: { canonical: "/30-60-90-day-plan-generator" },
  openGraph: {
    type: "website",
    images: ["/opengraph-image"],
    title: "30-60-90 Day Plan Generator | RoleSharp",
    description: "A starting scaffold for your first 90 days — from your role and goals. Free.",
    url: "/30-60-90-day-plan-generator",
  },
};

export default function OnboardingPlanPage() {
  return (
    <MicroGeneratorPage
      tool="onboarding"
      eyebrow="Free — no account"
      title="30-60-90 day plan generator"
      intro="Enter the role, what you were hired to achieve, and the systems to learn first — get a three-phase plan with a check-in question for each phase. The plan weaves in exactly what you provide and marks what you did not as placeholders: a structure to bring to your manager, not invented specifics."
      cta="Build my 30-60-90 plan"
      faqs={[
        ["When do I send a 30-60-90 plan?", "Best use: bring a draft to the final interview or the first week, and mark it up live with your manager. The mark-up is the point — it shows how you think, and their edits tell you what they actually value."],
        ["What if I don't know the goals yet?", "Leave the goals out and the plan uses labeled placeholders. Fill them in week 1 — the day-30 check-in is the natural moment to confirm them."],
        ["Is this plan invented?", "No. Every line is a structure from what you entered — role, company, goals, systems. Where you gave nothing, the plan says so instead of inventing company specifics."],
      ]}
    />
  );
}
