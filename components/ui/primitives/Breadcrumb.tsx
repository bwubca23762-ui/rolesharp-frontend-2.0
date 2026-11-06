import type { ReactNode } from "react";

export type Crumb = { label: ReactNode; href?: string };

/**
 * The directory breadcrumb.
 *
 * Eleven pages rendered this trail in six different ways: two Tailwind link
 * treatments, one with no link styling at all, a `.page-breadcrumb` compat
 * class, a `.note` class, and a bare font-semibold. None of them was marked up
 * as navigation, so a screen-reader user got a run of links with no indication
 * they were a hierarchy or where in it the current page sat.
 *
 * It is a labelled nav around an ordered list now, with the last crumb carrying
 * aria-current="page" and no link, because linking the page you are on is noise.
 * Separators are decorative and hidden: the list structure already conveys the
 * order, so announcing "slash" between every item is pure interference.
 */
export function Breadcrumb({ items, className = "" }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`mb-4 ${className}`}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[var(--muted-fg)]">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.href ?? "current"}-${index}`} className="flex items-center gap-x-1.5">
              {index > 0 && (
                <span aria-hidden="true" className="text-[var(--text-faint)]">
                  /
                </span>
              )}
              {item.href && !last ? (
                <a
                  href={item.href}
                  className="font-semibold text-[var(--primary)] underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                >
                  {item.label}
                </a>
              ) : (
                <span aria-current={last ? "page" : undefined}>{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
