import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes } from "react";

const inputBase =
  "w-full min-h-[46px] px-3.5 rounded-[12px] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] bg-[var(--surface)] text-[var(--fg)] placeholder:text-[var(--muted-fg)]/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-150";

const inputBorder =
  "border-black/[0.12] dark:border-white/[0.14] hover:border-black/[0.22] dark:hover:border-white/[0.24]";

const inputError =
  "border-[var(--color-danger)] focus:ring-[var(--color-danger)]/20 focus:border-[var(--color-danger)]";

export function Label({
  children,
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & { children: ReactNode }) {
  return (
    <label
      className={`block text-[13px] font-semibold tracking-[-0.01em] text-[var(--fg)] mb-1.5 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}

export function Input({
  className = "",
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return (
    <input
      className={`${inputBase} ${error ? inputError : inputBorder} ${className}`}
      {...props}
    />
  );
}

export function Select({
  className = "",
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select
      className={`${inputBase} ${error ? inputError : inputBorder} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={`${inputBase} ${error ? inputError : inputBorder} py-3 min-h-[116px] resize-y leading-6 ${className}`}
      {...props}
    />
  );
}

export function FieldError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="text-sm font-semibold text-[var(--color-danger)] mt-2" role="alert">
      {children}
    </p>
  );
}
