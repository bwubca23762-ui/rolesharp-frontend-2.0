# Shared layouts

## `app/app-shell.tsx` — application shell

```tsx
"use client";
import { usePathname } from "next/navigation";
import Nav from "./nav";
import Footer from "./footer";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "./session-context";
import WorkspaceContextNav from "./workspace-context-nav";
import ToolWorkspaceNav from "@/components/tools/ToolWorkspaceNav";
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return <ToastProvider>{children}</ToastProvider>;
  if (pathname?.startsWith("/embed/")) return children;
  return <ToastProvider><SessionProvider><a className="skip-link" href="#page-content">Skip to content</a><Nav /><WorkspaceContextNav /><div id="page-content"><ToolWorkspaceNav />{children}</div><Footer /></SessionProvider></ToastProvider>;
}
```

## `components/ui/primitives/Shells.tsx` — page-family shells

```tsx
export function MarketingShell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <main className={`relative min-h-screen overflow-clip ${className}`}>{children}</main>;
}
export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen py-5 md:py-7">{children}</main>;
}
export function EditorialShell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen py-8 md:py-12">{children}</main>; }
export function AuthShell({ children }: { children: React.ReactNode }) { return <main className="min-h-[calc(100dvh-4rem)] py-6 md:py-10">{children}</main>; }
```

## Navigation / footer contract

- Nav includes real RoleSharp mark, menu, interview-practice route and account context.
- Tool pages add workspace breadcrumb + related-tools control below nav.
- Public pages use full discovery footer; task pages should preferentially use a reduced task footer in the redesign direction.
- Admin is an intentionally separate visual system.
