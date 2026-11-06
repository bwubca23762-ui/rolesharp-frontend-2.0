/**
 * Compact static resume preview used as illustrative product proof in the hero.
 * Ported from the "RoleSharp Redefined" concept. Renders as a light "paper"
 * document in both themes (resumes are paper), so no dark: variants needed.
 */
export default function ResumePreview({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rs-paper-preview aspect-[3/4] w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-[10px] leading-snug text-slate-900 shadow-[var(--shadow-md)] ${className}`}
      aria-hidden
    >
      <div className="grid h-full grid-cols-[1fr_2fr]">
        <aside className="border-r border-slate-200 bg-slate-50 p-4">
          <div className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Profile</div>
          <div className="mt-1 font-display text-[13px] font-semibold leading-tight text-slate-900">
            Amina Osei
          </div>
          <div className="text-[10px] text-slate-600">Senior Product Designer</div>
          <div className="mt-3 text-[8px] uppercase tracking-widest text-slate-500">Contact</div>
          <ul className="mt-1 space-y-0.5 text-slate-700">
            <li>Berlin, Germany</li>
            <li>amina@example.com</li>
            <li>linkedin.com/in/amina</li>
          </ul>
          <div className="mt-3 text-[8px] uppercase tracking-widest text-slate-500">Skills</div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {["Design systems", "Research", "Prototyping", "Figma", "SaaS", "B2B"].map((s) => (
              <li key={s} className="rounded-sm bg-white px-1.5 py-0.5 text-[9px] text-slate-700 ring-1 ring-slate-200">
                {s}
              </li>
            ))}
          </ul>
          <div className="mt-3 text-[8px] uppercase tracking-widest text-slate-500">Languages</div>
          <ul className="mt-1 space-y-0.5 text-slate-700">
            <li>English — native</li>
            <li>German — B2</li>
            <li>Twi — native</li>
          </ul>
        </aside>
        <section className="p-4" aria-label="Resume content">
          <div className="text-[8px] font-semibold uppercase tracking-widest text-slate-500">Summary</div>
          <p className="mt-1 text-slate-800">
            Product designer with 7 years focused on B2B SaaS workflows. Shipped
            design systems, drove activation lift on onboarding, and partnered
            directly with research and engineering.
          </p>
          <div className="mt-3 text-[8px] font-semibold uppercase tracking-widest text-slate-500">Experience</div>
          <div className="mt-1 space-y-2">
            {[
              {
                r: "Senior Product Designer",
                c: "Ledgerline — Berlin",
                y: "2022 — Present",
                b: [
                  "Led redesign of billing flow, reducing failed renewals by 18%.",
                  "Owned the design system rollout across 4 product surfaces.",
                  "Ran quarterly research cycles with sales and support.",
                ],
              },
              {
                r: "Product Designer",
                c: "Northwind — Remote",
                y: "2019 — 2022",
                b: [
                  "Shipped onboarding revamp that lifted activation 24%.",
                  "Designed the reporting workspace used by 12k weekly users.",
                ],
              },
            ].map((e) => (
              <div key={e.r}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-semibold text-slate-900">{e.r}</div>
                  <div className="text-[9px] text-slate-500">{e.y}</div>
                </div>
                <div className="text-slate-600">{e.c}</div>
                <ul className="mt-1 list-disc space-y-0.5 pl-3 text-slate-700">
                  {e.b.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[8px] font-semibold uppercase tracking-widest text-slate-500">Education</div>
          <div className="mt-1 text-slate-800">
            <div className="flex justify-between">
              <span className="font-semibold">B.A. Interaction Design</span>
              <span className="text-[9px] text-slate-500">2015 — 2019</span>
            </div>
            <div className="text-slate-600">Universität der Künste, Berlin</div>
          </div>
        </section>
      </div>
    </div>
  );
}
