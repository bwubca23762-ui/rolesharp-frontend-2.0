"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "./icons";

type Theme = "light" | "dark";

const THEME_EVENT = "rolesharp:theme-change";
let activeChange: { transition: ViewTransition; target: Theme } | null = null;

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem("rolesharp-theme", theme);
  } catch {
    // The current page can still switch themes when storage is unavailable.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

function clearReveal(root: HTMLElement) {
  delete root.dataset.themeReveal;
  for (const property of ["--theme-reveal-x", "--theme-reveal-y", "--theme-reveal-radius"]) {
    root.style.removeProperty(property);
  }
}

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const syncTheme = () => {
      const next = currentTheme();
      setTheme(next);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#f7f9fc" : "#061426");
    };
    syncTheme();
    window.addEventListener(THEME_EVENT, syncTheme);
    return () => window.removeEventListener(THEME_EVENT, syncTheme);
  }, []);

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    const root = document.documentElement;
    const next = (activeChange?.target ?? currentTheme()) === "dark" ? "light" : "dark";
    if (activeChange) {
      activeChange.transition.skipTransition();
      activeChange = null;
      clearReveal(root);
      applyTheme(next);
      return;
    }
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme(next);
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.style.setProperty("--theme-reveal-x", `${x}px`);
    root.style.setProperty("--theme-reveal-y", `${y}px`);
    root.style.setProperty("--theme-reveal-radius", `${Math.ceil(radius) + 1}px`);
    root.dataset.themeReveal = next;

    const transition = document.startViewTransition(() => {
      if (activeChange?.transition === transition) flushSync(() => applyTheme(next));
    });
    activeChange = { transition, target: next };
    const finish = () => {
      if (activeChange?.transition !== transition) return;
      activeChange = null;
      clearReveal(root);
    };
    void transition.ready.catch(() => {});
    void transition.finished.then(finish, finish);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      className={`rs-theme-toggle inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors dark:border-[var(--color-dark-border)] dark:bg-[var(--color-dark-surface)] dark:text-[var(--color-dark-text-muted)] dark:hover:text-[var(--color-primary)] ${compact ? "rs-theme-toggle-compact" : "px-3 py-2"}`}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
      <span className={compact ? "sr-only" : "hidden sm:inline"}>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
