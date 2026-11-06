# Shared UI primitives

## `components/ui/primitives/Button.tsx` — Button
Primary/secondary/outline/ghost/danger/accent button with link and label forms; uses a rounded-pill visual language and a visible focus ring.

```tsx
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes, LabelHTMLAttributes } from "react";
type BaseProps = { children: ReactNode; variant?: "primary" | "primaryInverse" | "secondary" | "outline" | "outlineInverse" | "ghost" | "danger" | "accent"; size?: "compact" | "sm" | "md" | "lg"; fullWidth?: boolean; isLoading?: boolean; leftIcon?: ReactNode; rightIcon?: ReactNode; className?: string; };
export type ButtonProps = BaseProps & (ButtonHTMLAttributes<HTMLButtonElement> | AnchorHTMLAttributes<HTMLAnchorElement> | LabelHTMLAttributes<HTMLLabelElement>);
// Primary: blue #0A84FF → #0066CC; secondary: amber #F59E0B → #D97706.
// Sizes: compact 36px; sm/md 44px; lg 52px. All variants have rounded-full.
export function Button(props: ButtonProps) { /* see source for HTML element branching */ }
```

## `components/ui/primitives/Container.tsx` — Container

```tsx
import type { ReactNode } from "react";
export function Container({ children, className = "", size = "default" }: { children: ReactNode; className?: string; size?: "default" | "small" | "large" }) {
  const sizes = { small: "max-w-[760px]", default: "max-w-[var(--maxw)]", large: "max-w-[1280px]" };
  return <div className={`w-full mx-auto px-4 sm:px-6 lg:px-8 ${sizes[size]} ${className}`}>{children}</div>;
}
```

## `components/ui/primitives/Card.tsx` — Card

```tsx
import type { HTMLAttributes, ReactNode } from "react";
export function Card({ children, className = "", variant = "default", ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; variant?: "default" | "interactive" | "muted" | "dark" }) {
  return <div className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] ${className}`} {...props}>{children}</div>;
}
```

## `components/ui/primitives/PageHeader.tsx` — Page and section headings

```tsx
import type { ReactNode } from "react";
export function PageHeader({ eyebrow, title, description, actions, meta, compact = false }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode; compact?: boolean }) {
  return <header className={compact ? "mb-6" : "mb-10"}>{eyebrow && <p>{eyebrow}</p>}<h1>{title}</h1>{description && <p>{description}</p>}{actions}{meta}</header>;
}
```

## Reusable conventions

- Primary action is blue; amber is only Premium/selected brand emphasis.
- Input and primary touch target floor is 44px.
- Use semantic status colours; never colour alone as the status carrier.
- Use visible keyboard focus; never rely on hover alone.
