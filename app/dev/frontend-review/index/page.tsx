import Link from "next/link";

const routes = ["/", "/checker", "/build", "/resume-maker", "/resume-templates", "/jobs", "/pricing", "/login", "/dashboard", "/tracker", "/daily-matches", "/application-queue", "/campaign-settings", "/email-connection"];

export default function CurrentApplicationRoutes() {
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-16"><h1 className="text-4xl font-bold">Current application routes</h1><p className="mt-4 max-w-2xl text-[var(--muted-fg)]">These are the existing branch pages. They are intentionally separate from the self-contained Frontend 2.0 prototype.</p><p className="mt-6"><Link className="desk-link" href="/dev/frontend-review">Open the Frontend 2.0 prototype</Link></p><ul className="mt-10 grid gap-3 sm:grid-cols-2">{routes.map((route) => <li key={route}><Link className="desk-link" href={route}>{route === "/" ? "Homepage" : route}</Link></li>)}</ul></main>;
}
