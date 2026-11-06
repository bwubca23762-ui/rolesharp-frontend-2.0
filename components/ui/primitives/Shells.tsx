import type { ReactNode } from "react";
import { Container } from "./Container";
import { PageHeader } from "./PageHeader";

function ShellSurface({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "small" | "default" | "large";
}) {
  return <Container size={size} className={className}>{children}</Container>;
}

export function MarketingShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`relative min-h-screen overflow-clip ${className}`}>{children}</main>;
}

export function WorkspaceShell({
  children,
  eyebrow,
  title,
  description,
  actions,
  meta,
  showHeader = true,
  className = "",
}: {
  children: ReactNode;
  eyebrow?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <main className={`desk-workspace min-h-screen py-6 md:py-9 ${className}`}>
      <ShellSurface size="large">
        {showHeader && title ? (
          <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} meta={meta} compact />
        ) : actions ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
        {children}
      </ShellSurface>
    </main>
  );
}

export function EditorialShell({
  children,
  eyebrow,
  title,
  description,
  meta,
  aside,
  className = "",
}: {
  children: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <main className={`desk-editorial min-h-screen py-8 md:py-12 ${className}`}>
      <ShellSurface>
        <PageHeader eyebrow={eyebrow} title={title} description={description} meta={meta} compact />
        <div className={aside ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start" : "max-w-4xl"}>
          <article className="prose min-w-0 max-w-none">{children}</article>
          {aside && <aside className="lg:sticky lg:top-24">{aside}</aside>}
        </div>
      </ShellSurface>
    </main>
  );
}

export function AuthShell({
  children,
  eyebrow,
  title,
  description,
  aside,
  className = "",
}: {
  children: ReactNode;
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <main className={`desk-auth min-h-[calc(100dvh-4rem)] py-6 md:py-10 ${className}`}>
      <Container size="large" className="desk-auth-layout">
        <div className="desk-auth-message">
          <p className="desk-auth-heading">Pick up where you left off.</p>
          <p>Keep the versions, evidence, and next steps for each application together.</p>
        </div>
        <div className="desk-auth-form">
          <PageHeader eyebrow={eyebrow} title={title} description={description} compact />
          {aside && <div className="mt-5 flex flex-wrap gap-2">{aside}</div>}
          <div className="mt-6 edt-hairline pt-6">{children}</div>
        </div>
      </Container>
    </main>
  );
}
