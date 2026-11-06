import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className = "",
}: {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-black/[0.07] dark:border-white/[0.1] bg-black/[0.045] dark:bg-white/[0.07] p-1 backdrop-blur-md ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-xs sm:text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0071E3] disabled:cursor-not-allowed disabled:opacity-50 ${
              selected
                ? "bg-white dark:bg-zinc-800 text-[var(--fg)] shadow-[0_1px_4px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.8)]"
                : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
