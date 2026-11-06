import Link from "next/link";
import { ArrowRight, Check, FileText, Search } from "lucide-react";
import { LandingQuote } from "./LandingQuote";

const entryPoints = [
  { title: "Check a resume", text: "Find parsing issues and gaps against a job.", href: "/checker" },
  { title: "Build from a template", text: "Start with a layout you can preview.", href: "/resume-templates" },
  { title: "Find jobs", text: "Browse markets and tailor to a real posting.", href: "/jobs" },
];

export function ApplicationDesk() {
  return (
    <div className="desk-wrap">
      <LandingQuote />

      <section className="desk-hero" aria-labelledby="desk-title">
        <div className="desk-hero-copy">
          <h1 id="desk-title">RoleSharp: One step ahead towards a successful career.</h1>
          <p>See where your experience matches the posting, then review each suggested edit against the work you actually did.</p>
          <div className="desk-actions">
            <Link className="desk-button" href="/checker">Check my resume free <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className="desk-link" href="/build">Build a tailored resume</Link>
          </div>
          <small>No card required · PDF, DOCX or pasted text</small>
        </div>

        <figure className="desk-proof">
          <div className="desk-proof-title"><FileText size={17} aria-hidden="true" /> Sample review <span>Product Manager</span></div>
          <div className="desk-proof-body">
            <div className="desk-paper">
              <p className="desk-paper-name">Alex Morgan</p>
              <p className="desk-paper-meta">Product Manager / Seattle, WA</p>
              <h2>Experience</h2>
              <p><strong>Product Lead · Lattice Works</strong></p>
              <p className="desk-marked">Led onboarding experiments that raised activation 12% across two releases.</p>
              <p>Interviewed 24 customers to identify where trial users dropped off.</p>
              <h2>Skills</h2>
              <p>Experiment design, research, SQL</p>
            </div>
            <div className="desk-annotations">
              <div className="desk-note">
                <h2><Check size={16} aria-hidden="true" /> Supported by the resume</h2>
                <p>The 12% lift gives the hiring team a concrete outcome to evaluate.</p>
              </div>
              <div className="desk-note desk-note-gap">
                <h2><Search size={16} aria-hidden="true" /> Check before adding</h2>
                <p>The posting asks for pricing tests. This resume shows onboarding tests.</p>
              </div>
            </div>
          </div>
          <figcaption>Fictional candidate and job posting</figcaption>
        </figure>
      </section>

      <section className="desk-revision" aria-labelledby="desk-revision">
        <div>
          <h2 id="desk-revision">A clearer bullet.<br />The same facts.</h2>
          <p>Start with the original. Add detail only when you can point to where it came from.</p>
        </div>
        <dl>
          <div><dt>Original resume</dt><dd>Worked on improving the onboarding experience.</dd></div>
          <div><dt>Suggested revision</dt><dd>Led onboarding experiments that raised activation 12% across two releases.</dd></div>
          <div className="desk-source"><dt>Sample source</dt><dd>Onboarding release notes and experiment results</dd></div>
        </dl>
      </section>

      <section className="desk-entry" aria-labelledby="desk-entry">
        <h2 id="desk-entry">Where are you in your search?</h2>
        <ul>
          {entryPoints.map(({ title, text, href }) => (
            <li key={href}>
              <Link href={href}>{title}<ArrowRight size={18} aria-hidden="true" /></Link>
              <p>{text}</p>
            </li>
          ))}
        </ul>
        <Link className="desk-link mt-3" href="/tools#catalogue">Browse all career tools <ArrowRight size={16} aria-hidden="true" /></Link>
      </section>
    </div>
  );
}
