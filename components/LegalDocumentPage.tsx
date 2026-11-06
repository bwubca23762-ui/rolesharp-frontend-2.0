import "@/app/reading-surfaces.css";
import Link from "next/link";
import { EditorialShell } from "@/components/ui/primitives";
import LegalMarkdown from "@/components/LegalMarkdown";
import { currentLegalDocument, legalDocumentHistory, type RequiredLegalDocumentKey } from "@/lib/legal";
import { SUPPORT_EMAIL } from "@/lib/contact";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

export default async function LegalDocumentPage({
  documentKey,
  versionNumber,
}: {
  documentKey: RequiredLegalDocumentKey;
  versionNumber?: number | null;
}) {
  const [current, history] = await Promise.all([
    currentLegalDocument(documentKey, versionNumber),
    legalDocumentHistory(documentKey),
  ]);
  if (!current) {
    return (
      <EditorialShell className="reading-shell reading-document" eyebrow="Legal" title={documentKey === "terms" ? "Terms of Service" : "Privacy Policy"}>
        <p>The current legal document is temporarily unavailable. No acceptance can be recorded until the published version is restored.</p>
      </EditorialShell>
    );
  }
  return (
    <EditorialShell className="reading-shell reading-document"
      eyebrow="Legal"
      title={current.title}
      description={current.changeSummary}
      meta={<>Version {current.versionNumber} — Effective {formatDate(current.effectiveAt)}</>}
      aside={history.length > 1 ? (
        <nav aria-label={`${current.title} version history`} className="reading-toc">
          <h2 className="text-base font-bold">Version history</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {history.map((version) => (
              <li key={version.id}>
                <Link aria-current={version.versionNumber === current.versionNumber ? "page" : undefined} href={`/${documentKey === "terms" ? "terms" : "privacy"}?version=${version.versionNumber}`}>
                  Version {version.versionNumber} — {formatDate(version.effectiveAt)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    >
      <p><strong>Published:</strong> {formatDate(current.publishedAt)}. <strong>Change classification:</strong> {current.materialChange ? "Material change" : "Baseline or non-material change"}.</p>
      <LegalMarkdown markdown={current.bodyMarkdown} />
      <hr />
      <p>Questions about this document can be sent to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> or through the <Link href="/contact">support form</Link>.</p>
    </EditorialShell>
  );
}
