"use client";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";

/**
 * The card wrapper every settings panel sits in. Shared so the panels can live
 * in their own lazily-loaded modules without each one restating the heading
 * structure.
 *
 * v2: the icon chip gains a rounded-square treatment with a hairline border
 * (matches MetricCard's icon language) and an optional one-line description
 * under the title, so panels can say what they govern without a paragraph
 * inside the body.
 */
export default function FeatureSection({ icon, title, description, children }: { icon: ReactNode; title: ReactNode; description?: ReactNode; children: ReactNode }) {
  return (
    <Card className="min-w-0 p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center gap-3.5 mb-5">
        <div className="w-10 h-10 rounded-[0.7rem] border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] text-[var(--color-primary)] dark:border-transparent dark:bg-[var(--color-dark-surface-2)] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-bold! font-[family-name:var(--font-display)]! tracking-tight text-[var(--color-text)] dark:text-[var(--color-dark-text)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm leading-6 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </Card>
  );
}
