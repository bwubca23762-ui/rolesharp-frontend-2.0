import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildQuestionBank } from "@/lib/interview-bank";
import JsonLd from "@/app/json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { Breadcrumb, ToolShell } from "@/components/ui/primitives";
import QuestionPracticeStudio from "./question-practice-studio";

type Params = { params: Promise<{ role: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { role } = await params;
  const bank = await buildQuestionBank(role).catch(() => null);
  if (!bank) return {};
  const title = `${bank.roleTitle} Interview Questions (2026) — Behavioral, Technical & Situational`;
  return {
    title: { absolute: title },
    description: `${bank.questions.length} real interview questions for ${bank.roleTitle} roles, built from actual job requirements, with notes on what strong answers demonstrate. Free.`,
    alternates: { canonical: `/interview-questions/${role}` },
    openGraph: {
      type: "website",
      images: [`/interview-questions/${role}/opengraph-image`],
      title,
      description: `Practice ${bank.roleTitle} interview questions — free.`,
      url: `/interview-questions/${role}`,
    },
  };
}

export default async function InterviewBankPage({ params }: Params) {
  const { role: slug } = await params;
  const bank = await buildQuestionBank(slug).catch(() => null);
  if (!bank || bank.questions.length < 4) notFound();

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: bank.questions.slice(0, 20).map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: `Strong answers show: ${q.lookingFor}` },
    })),
  };

  return (
    <ToolShell
      eyebrow="Interview question bank"
      title={`${bank.roleTitle} interview questions`}
      subtitle={`Browse ${bank.questions.length} questions drawn from ${bank.roleTitle} job requirements. Choose one to rehearse with notes and a two-minute timer.`}
      workspaceSize="large"
    >
      <JsonLd data={faqLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: "/" },
          { name: "Interview Questions", item: "/interview-questions" },
          { name: `${bank.roleTitle} interview questions`, item: `/interview-questions/${slug}` },
        ])}
      />
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Interview Questions", href: "/interview-questions" },
          { label: bank.roleTitle },
        ]}
      />
      <QuestionPracticeStudio roleTitle={bank.roleTitle} questions={bank.questions} />
    </ToolShell>
  );
}
