"use client";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Notice } from "@/components/ui/primitives";
import Skeleton from "@/components/ui/Skeleton";
import { MIN_RELIABLE_SAMPLE, type VariantSummary } from "@/lib/applications/variant-stats";

// Variant insights (Phase 4 A/B analytics). The candidate tags each
// application with the resume version they sent; this tab compares their
// own records. It is explicitly NOT a controlled experiment: stages are
// self-reported, samples are small, and the copy never claims statistical
// significance. Under five sent applications, the number is labelled noise.

export default function VariantInsights() {
  const [variants, setVariants] = useState<VariantSummary[] | null>(null);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);

  async function load() {
    setError("");
    try {
      const res = await fetch("/api/applications/variant-stats");
      if (res.status === 401) return;
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { variants: VariantSummary[] };
      setVariants(data.variants);
      setLoadFailed(false);
    } catch {
      setError("Could not load variant insights. Your data is unchanged; try again in a moment.");
      setVariants((current) => current ?? []);
      setLoadFailed(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (variants === null && !error) {
    return <Skeleton variant="card" height="180px" />;
  }

  if (!variants?.length) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold! font-[family-name:var(--font-display)]!">
          Which resume version actually gets replies?
        </h2>
        <p className="mt-2 max-w-2xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
          Tag each application on your board with the resume version you sent — for example
          &ldquo;Resume A — skills-forward&rdquo; or &ldquo;Resume B — leadership&rdquo;. Once you
          have a few tagged, this tab compares them: interviews, offers, and rejections per version,
          from your own records. Nothing is inferred about employer outcomes, and the tool never
          picks a winner for you.
        </p>
      </Card>
    );
  }

  return (
    <section aria-label="Variant insights" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold! font-[family-name:var(--font-display)]!">Variant insights</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            Your own records, per resume version you tagged. This is not a controlled experiment —
            self-reported stages and small samples mean these are hints, not proof. We flag samples
            under {MIN_RELIABLE_SAMPLE} sent as noise rather than ranking them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loadFailed && variants.length === 0}>
          Refresh
        </Button>
      </div>
      {error && <Notice variant="danger" role="alert">{error}</Notice>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              <th scope="col" className="py-2 pr-4">Resume version</th>
              <th scope="col" className="py-2 pr-4 text-right">Sent</th>
              <th scope="col" className="py-2 pr-4 text-right">Interviews</th>
              <th scope="col" className="py-2 pr-4 text-right">Offers</th>
              <th scope="col" className="py-2 pr-4 text-right">Rejections</th>
              <th scope="col" className="py-2 text-right">Got a reply</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.label} className="border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
                <th scope="row" className="py-3 pr-4 text-left font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
                  <span className="flex flex-wrap items-center gap-2">
                    {variant.label}
                    {variant.leading && (
                      <Badge variant="outline">leading so far</Badge>
                    )}
                  </span>
                  {variant.sampleTooSmall && (
                    <span className="mt-1 block text-xs font-normal text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                      under {MIN_RELIABLE_SAMPLE} sent — treat as noise
                    </span>
                  )}
                </th>
                <td className="py-3 pr-4 text-right tabular-nums">{variant.sent}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{variant.interviews}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{variant.offers}</td>
                <td className="py-3 pr-4 text-right tabular-nums">{variant.rejections}</td>
                <td className="py-3 text-right tabular-nums">
                  {variant.responseRate === null ? "—" : `${variant.responseRate}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
