import type { ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 mb-3 rounded-full border border-[#0071E3]/20 bg-[#0071E3]/[0.08] px-3 py-1 font-[family-name:var(--font-mono)] text-eyebrow font-semibold uppercase tracking-[0.12em] text-[#0066CC] dark:text-[#5AC8FA]">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
