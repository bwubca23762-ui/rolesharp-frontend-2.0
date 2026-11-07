"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionProvider, useSession } from "@/app/session-context";
import LegalAcceptanceNotice from "@/components/LegalAcceptanceNotice";
import { PrototypeChecker, PrototypeStudio, PrototypeJobs, PrototypeTracker, PrototypeWorkspace } from "./prototype-workflows";
import LanguagePicker from "@/app/language-picker";
import ThemeToggle from "@/app/theme-toggle";
import { LandingQuote } from "@/components/marketing/LandingQuote";
import type { ReactNode } from "react";
import { ArrowRight, CircleCheck, Sparkles } from "lucide-react";
import styles from "./prototype.module.css";

type Screen = "home" | "checker" | "build" | "templates" | "jobs" | "workspace" | "track";
const nav = [["Resume check", "/dev/frontend-review/checker", "checker"], ["Studio", "/dev/frontend-review/build", "build"], ["Templates", "/dev/frontend-review/templates", "templates"], ["Jobs", "/dev/frontend-review/jobs", "jobs"], ["Workspace", "/dev/frontend-review/workspace", "workspace"]] as const;

function Brand() { return <Link href="/dev/frontend-review" className={styles.brand} aria-label="RoleSharp prototype home"><span>R</span>RoleSharp</Link>; }
function Button({ href, children, quiet = false }: { href: string; children: ReactNode; quiet?: boolean }) { return <Link className={quiet ? styles.buttonQuiet : styles.button} href={href}>{children}<ArrowRight size={16} /></Link>; }
function Header({ screen }: { screen: Screen }) {
  const pathname = usePathname();
  const { session } = useSession();
  return (
    <header className={styles.header}>
      <Brand />
      <nav className={styles.nav} aria-label="Prototype pages">
        {nav.map(([label, href, key]) => (
          <Link key={key} href={href} aria-current={screen === key ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <div className={styles.controls}>
        <Link className={styles.account} href={session?.loggedIn ? "/dev/frontend-review/workspace" : "/login?next=%2Fdev%2Ffrontend-review%2Fworkspace"}>{session?.loggedIn ? "Your workspace" : "Demo sign-in"}</Link>
        <ThemeToggle compact />
        <LanguagePicker pathname={pathname} />
      </div>
    </header>
  );
}
function MiniResume() { return <section className={styles.resumeSheet} aria-label="Example resume preview"><div className={styles.sheetHeader}><div><strong>Avery Chen</strong><span>Product manager · New York</span></div><span className={styles.ready}>Ready to tailor</span></div><div className={styles.sheetRule} /><p className={styles.sheetLabel}>Product experience</p><div className={styles.sheetRole}><strong>Senior product manager</strong><span>Northline · 2022 — present</span><p>Led a research-to-roadmap practice that clarified quarterly bets for three product teams.</p></div><div className={styles.sheetRole}><strong>Product manager</strong><span>Fieldnote · 2019 — 2022</span><p>Designed experiments and measurement plans for a workflow used by 45k teams.</p></div><div className={styles.sheetRule} /><div className={styles.sheetFooter}><span>Evidence: 8 of 9 claims</span><span>One detail to add</span></div></section>; }

function Home() { return <main className={styles.home}><section className={styles.hero}><div className={styles.heroCopy}><h1>RoleSharp: One step ahead towards a successful career.</h1><p>RoleSharp turns your experience into clear, role-specific evidence. No inflated claims. No black-box score.</p><div className={styles.actions}><Button href="/dev/frontend-review/checker">Check a resume</Button><Button href="/dev/frontend-review/build" quiet>Start in Studio</Button></div><div className={styles.trust}><span><CircleCheck size={17} /> You control every line</span><span><CircleCheck size={17} /> Built for real applications</span></div><div className={styles.heroQuote}><LandingQuote compact /></div></div><div className={styles.heroArtifact}><div className={styles.artifactNote}><Sparkles size={18} /><p><strong>Evidence, not decoration.</strong> Every suggestion points back to a detail you can verify.</p></div><MiniResume /></div></section><section className={styles.sequence}><div><span>01</span><h2>Bring what you have</h2><p>A draft, a role description, or just your work history.</p></div><div><span>02</span><h2>See the missing proof</h2><p>Understand what is clear, vague, or unsupported before you edit.</p></div><div><span>03</span><h2>Send a resume you trust</h2><p>Keep the choices human and language specific to the role.</p></div></section></main>; }
function Templates() { const templates = [["Signal", "Clean hierarchy for product and strategy roles", "Selected"], ["Brief", "A compact editorial reading rhythm", ""], ["Frame", "Structured evidence for technical roles", ""], ["Ledger", "A quiet, data-forward layout", ""]]; return <main className={styles.screen}><div className={styles.pageIntro}><h1>Choose a reading rhythm</h1><p>Each template keeps the same content. Pick the one that makes your evidence easiest to scan.</p></div><div className={styles.templateGrid}>{templates.map(([title, copy], index) => <article className={`${styles.template} ${index === 0 ? styles.templateSelected : ""}`} key={title}><div className={`${styles.paper} ${styles[`paper${index}`]}`}><b>Avery Chen</b><i /><span /><span /><i /><span /><span /><span /></div><h2>{title}</h2><p>{copy}</p><Button href={"/dev/frontend-review/build?template=" + ["basic", "compact", "modern", "executive"][index]} quiet>Use {title}</Button></article>)}</div></main>; }
export function PrototypePage({ screen }: { screen: Screen }) { const views = { home: <Home />, checker: <PrototypeChecker />, build: <PrototypeStudio />, templates: <Templates />, jobs: <PrototypeJobs />, workspace: <PrototypeWorkspace />, track: <PrototypeTracker /> }; return <SessionProvider><div className={styles.prototype}><Header screen={screen} /><LegalAcceptanceNotice />{views[screen]}<footer className={styles.footer}><Brand /><span>Frontend 2.0 · Sample screens and local workflows</span><Link href="/dev/frontend-review/track">Tracker preview</Link><Link href="/dev/frontend-review/index">View current application route inventory</Link></footer></div></SessionProvider>; }
