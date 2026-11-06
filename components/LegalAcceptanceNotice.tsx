"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Notice } from "@/components/ui/primitives";
import { useSession } from "@/app/session-context";

export default function LegalAcceptanceNotice() {
  const { session, refreshSession } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = session?.loggedIn ? session.pendingLegalAcceptances ?? [] : [];
  if (pending.length === 0) return null;

  async function accept() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/legal/accept", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionIds: pending.map((version) => version.id), surface: "legal_notice" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new globalThis.Error(result.error || "legal_acceptance_failed");
      await refreshSession();
    } catch {
      setError("We could not record acceptance. Review the documents and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6" role="region" aria-label="Updated legal terms">
      <Notice variant="warning">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <strong>Review updated RoleSharp terms.</strong>{" "}
            {pending.map((version, index) => (
              <span key={version.id}>
                {index > 0 ? " and " : ""}
                <Link className="font-semibold underline" href={`/${version.documentKey === "terms" ? "terms" : "privacy"}?version=${version.versionNumber}`}>
                  {version.title} v{version.versionNumber}
                </Link>
              </span>
            ))}. High-impact actions stay paused until the current versions are accepted. Support, export, privacy controls, and deletion remain available.
          </div>
          <Button type="button" onClick={accept} isLoading={busy}>Accept current versions</Button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm">{error}</p>}
      </Notice>
    </div>
  );
}
