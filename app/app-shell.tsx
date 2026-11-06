"use client";
import { usePathname } from "next/navigation";
import Nav from "./nav";
import Footer from "./footer";
import PageTracker from "./page-tracker";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "./session-context";
import WorkspaceContextNav from "./workspace-context-nav";
import LegalAcceptanceNotice from "@/components/LegalAcceptanceNotice";
import NotificationCenter from "@/components/NotificationCenter";
import CookieConsent from "@/components/CookieConsent";
import ToolWorkspaceNav from "@/components/tools/ToolWorkspaceNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = pathname?.startsWith("/admin");
  const embed = pathname?.startsWith("/embed/");
  const frontendPrototype = pathname?.startsWith("/dev/frontend-review");
  if (admin) return <ToastProvider>{children}</ToastProvider>;
  if (embed) return children;
  if (frontendPrototype) return <ToastProvider>{children}</ToastProvider>;
  return (
    <ToastProvider>
      <SessionProvider>
        <PageTracker />
        <a className="skip-link" href="#page-content">Skip to content</a>
        <Nav />
        <NotificationCenter />
        <WorkspaceContextNav />
        <LegalAcceptanceNotice />
        <div id="page-content"><ToolWorkspaceNav />{children}</div>
        <CookieConsent />
        <Footer />
      </SessionProvider>
    </ToastProvider>
  );
}
