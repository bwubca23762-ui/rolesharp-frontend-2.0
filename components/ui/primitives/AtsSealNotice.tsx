import { Notice } from "./Notice";
import type { AtsSeal } from "@/lib/ats-extract";

// The ATS text-layer seal, rendered. Shown next to export buttons after a
// download: what a machine parser saw in the exact bytes that were served.
// Success is one calm line; findings are named plainly, never dressed up.
export function AtsSealNotice({ seal, className = "" }: { seal: AtsSeal | null; className?: string }) {
  if (!seal) return null;
  const errors = seal.findings.filter((f) => f.severity === "error");
  const warnings = seal.findings.filter((f) => f.severity === "warning");

  if (seal.ok && !warnings.length) {
    return (
      <Notice variant="success" role="status" className={className} title="ATS-readable — verified on this exact file">
        A production PDF/DOCX parser extracted every section and your contact details from the download.
      </Notice>
    );
  }

  return (
    <Notice
      variant={errors.length ? "danger" : "warning"}
      role="status"
      className={className}
      title={errors.length ? "ATS readability problems found in this file" : "ATS readability warnings for this file"}
    >
      <ul className="list-disc pl-5 space-y-1">
        {[...errors, ...warnings].map((f) => (
          <li key={f.id}>{f.detail}</li>
        ))}
      </ul>
    </Notice>
  );
}
