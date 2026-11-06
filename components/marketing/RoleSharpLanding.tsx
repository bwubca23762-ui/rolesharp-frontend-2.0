import Link from "next/link";
import { ArrowRight, Check, FileSearch, FileText, Search } from "lucide-react";
import { LandingQuote } from "./LandingQuote";
import styles from "./RoleSharpLanding.module.css";

const toolRows = [
  [
    "Resume check",
    "See parsing issues, missing evidence, and a readable next edit",
    "/checker",
    "01",
  ],
  [
    "Resume Studio",
    "Build a role-specific version without inventing experience",
    "/build",
    "02",
  ],
  [
    "Templates",
    "Choose an ATS-safe export built from the same content",
    "/resume-templates",
    "03",
  ],
  [
    "Application tracker",
    "Keep each follow-up and application decision in view",
    "/tracker",
    "04",
  ],
];

export function RoleSharpLanding() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title">
            Tailor your resume to the job.
          </h1>
          <p className={styles.lede}>
            Turn the work you have done into a resume that a hiring team can
            actually understand, verify, and remember.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/checker">
              Check my resume free <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className={styles.secondaryAction} href="/build">
              Build a tailored resume
            </Link>
            <Link className="sr-only" href="/resume-templates">
              Browse templates
            </Link>
          </div>
          <p className={styles.actionNote}>
            Start with a PDF, DOCX, or pasted text. No card required.
          </p>
        </div>
        <figure
          className={styles.productStage}
          aria-label="Example of RoleSharp connecting resume evidence to a job requirement"
        >
          <div className={styles.stageHeader}>
            <span>
              <FileSearch size={16} aria-hidden="true" /> Evidence review
            </span>
            <span>Product manager</span>
          </div>
          <article className={styles.resume}>
            <div className={styles.resumeName}>
              Alex Morgan<span>Product manager · Seattle</span>
            </div>
            <div className={styles.resumeLine} />
            <p className={styles.resumeLabel}>Experience</p>
            <strong>Product lead · Lattice Works</strong>
            <p className={styles.highlight}>
              Led onboarding experiments that raised activation 12% across two
              releases.
            </p>
            <p>
              Interviewed 24 customers to identify where trial users dropped
              off.
            </p>
            <p className={styles.resumeLabel}>Skills</p>
            <p>Experiment design, research, SQL</p>
          </article>
          <aside className={styles.evidence}>
            <div>
              <Check size={16} aria-hidden="true" />
              <h3>Supported by the resume</h3>
              <p>
                The 12% lift is a concrete outcome the hiring team can evaluate.
              </p>
            </div>
            <div>
              <Search size={16} aria-hidden="true" />
              <h3>Check before adding</h3>
              <p>
                The role asks for pricing tests. This resume shows onboarding
                tests.
              </p>
            </div>
            <div className="desk-source mt-3 text-xs border-t border-[var(--hairline)] pt-2 text-[#1e293b]">
              <dt className="font-semibold text-[#0f172a]">Sample source</dt>
              <dd className="text-[#334155]">Onboarding release notes and experiment results</dd>
            </div>
          </aside>
          <figcaption className="sr-only">Fictional candidate and job posting</figcaption>
        </figure>
      </section>

      <section className={styles.proof} aria-label="RoleSharp principles">
        <p>
          <strong>Clear evidence</strong>
          <span>Suggestions link back to your experience</span>
        </p>
        <p>
          <strong>One job at a time</strong>
          <span>Tailor without rewriting your history</span>
        </p>
        <p>
          <strong>Export-ready</strong>
          <span>Use the same document you preview</span>
        </p>
      </section>

      <section className={styles.statement}>
        <LandingQuote compact />
      </section>

      <section className={styles.workflow} aria-labelledby="workflow-title">
        <div className={styles.sectionIntro}>
          <h2 id="workflow-title">A better application is built in public.</h2>
          <p>
            You should be able to see what changed, why it changed, and decide
            whether it belongs in your resume.
          </p>
        </div>
        <ol>
          <li>
            <span>Bring a draft</span>
            <p>Start with what you already have, even if it is unfinished.</p>
          </li>
          <li>
            <span>Review the evidence</span>
            <p>Separate strong proof from claims that still need context.</p>
          </li>
          <li>
            <span>Tailor with intent</span>
            <p>Create a targeted version you can read before you send it.</p>
          </li>
        </ol>
      </section>

      <section className={styles.tools} aria-labelledby="tools-title">
        <div className={styles.sectionIntro}>
          <h2 id="tools-title">Keep moving after the resume is ready.</h2>
          <p>
            RoleSharp connects the document, the role, and the follow-through
            without pretending the job search is a single click.
          </p>
        </div>
        <div className={styles.toolList}>
          {toolRows.map(([title, description, href, number]) => (
            <Link href={href} key={href} className={styles.toolRow}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] hover:underline" href="/tools#catalogue">
            Browse all career tools <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className={styles.templates} aria-labelledby="templates-title">
        <div>
          <p className={styles.context}>ATS-safe exports</p>
          <h2 id="templates-title">
            Your content should not have to choose between clarity and
            character.
          </h2>
          <Link className={styles.secondaryAction} href="/resume-templates">
            View every template <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div
          className={styles.templateStack}
          aria-label="Resume template previews"
        >
          <article>
            <span>Alex Morgan</span>
            <i />
            <b>Experience</b>
            <em />
            <em />
            <em />
          </article>
          <article>
            <span>Alex Morgan</span>
            <i />
            <b>Experience</b>
            <em />
            <em />
            <em />
          </article>
          <article>
            <span>Alex Morgan</span>
            <i />
            <b>Experience</b>
            <em />
            <em />
            <em />
          </article>
        </div>
      </section>

      <section className={styles.close}>
        <div>
          <FileText size={22} aria-hidden="true" />
          <h2>Start with the resume you have.</h2>
          <p>
            RoleSharp will help you see the strongest next move before you
            apply.
          </p>
        </div>
        <Link className={styles.primaryAction} href="/checker">
          Check your resume <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
