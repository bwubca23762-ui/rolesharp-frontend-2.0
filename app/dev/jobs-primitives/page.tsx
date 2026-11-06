"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import AccessibleDialog from "@/components/ui/AccessibleDialog";
import {
  AlertTriangle,
  Briefcase,
  Check,
  Info,
  RefreshCw,
  Shield,
  Target,
} from "@/app/icons";
import { Button } from "@/components/ui/primitives";

const scoreSignals = [
  ["Required skills", "+24 fit", "High-confidence evidence"],
  ["Title and job family", "+17 fit", "Exact normalized family"],
  ["Experience", "+10 fit", "Verified dated history"],
  ["Preferred skills", "+5 fit", "One skill is unverified"],
] as const;

const connections = [
  ["connection-active", "success", "Connected", "Gmail", "applications@candidate.example — gmail.send only", "Disconnect"],
  ["connection-expired", "warning", "Reconnect required", "Microsoft Outlook", "Authorization expired. No queued email can be sent.", "Reconnect"],
  ["connection-disconnected", "neutral", "Disconnected", "No pinned sender", "Your RoleSharp login does not grant mailbox sending permission.", "Connect mailbox"],
] as const;

const queueRows = [
  ["queue-ready", "Ready for review", "success", "Senior Product Designer", "Northstar Health — fit 91 — confidence 94", "Recipient verified from the posting. Approval expires in 21 hours."],
  ["queue-stale", "Stale", "warning", "Staff Design Systems Lead", "Common Thread — fit 88 — confidence 86", "The profile changed. Rebuild the package before approval."],
  ["queue-long-label", "Official link required", "danger", "Principal Product Designer for Internationalization, Accessibility, and Enterprise Design Systems", "Longform Research Cooperative — fit 89 — confidence 82", "applications-and-accessibility-review@very-long-unbroken-employer-subdomain.example"],
] as const;

export default function JobsPrimitivesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      let stop: (() => void) | undefined;
      // The lite entry avoids the full toolbar's external version request,
      // keeping this deterministic development fixture network-independent.
      void import("react-scan/lite").then(({ instrument }) => {
        stop = instrument().stop;
      });
      return () => stop?.();
    }
  }, []);

  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="jobs-primitives-page" data-testid="jobs-primitives-showcase">
      <header className="jobs-primitives-hero">
        <div className="jobs-primitives-container">
          <span className="jobs-primitives-kicker">Development reference</span>
          <h1>Jobs workflow primitives</h1>
          <p>The extracted RoleSharp contract for explainable matching, mailbox consent, review queues, and truthful recovery states.</p>
        </div>
      </header>

      <div className="jobs-primitives-container jobs-primitives-stack">
        <nav className="jobs-primitives-tabs" aria-label="Jobs workspace previews">
          {["Daily matches", "Auto Apply", "Application queue", "Email connection"].map((label, index) => (
            <a href={`#preview-${index + 1}`} aria-current={index === 0 ? "page" : undefined} key={label}>{label}</a>
          ))}
        </nav>
        <p className="jobs-primitives-notice" role="status" aria-live="polite">
          {notice}
        </p>

        <section className="jobs-primitives-section" id="preview-1">
          <div className="jobs-primitives-heading">
            <div><span className="jobs-primitives-overline">Campaign fields</span><h2>Clear criteria before activation</h2></div>
            <span className="jobs-state-badge neutral">Draft</span>
          </div>
          <form className="jobs-campaign-form">
            <fieldset>
              <legend>Match criteria</legend>
              <div className="jobs-field-grid">
                <label>Desired title<input defaultValue="Product designer" /><span>Canonical titles keep matching deterministic.</span></label>
                <label>Work arrangement<select defaultValue="remote"><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="office">On-site</option></select><span>Unknown posting evidence lowers confidence.</span></label>
                <label>Daily application limit<input type="number" min="1" max="10" defaultValue="5" /><span>One to ten; provider limits can lower this cap.</span></label>
                <label>Minimum fit<input type="number" min="85" max="100" defaultValue="85" /><span>The automation floor cannot be lowered below 85.</span></label>
              </div>
              <label className="jobs-checkbox"><input type="checkbox" defaultChecked />Pause automatically when sender authorization needs attention</label>
              <div className="jobs-form-actions"><Button variant="outline" type="button" onClick={() => setNotice("Draft settings saved in the showcase.")}>Save draft</Button><Button type="button" onClick={() => setNotice("Rule preview is ready for review.")}>Preview rules</Button></div>
            </fieldset>
          </form>
        </section>

        <section className="jobs-primitives-grid" aria-label="Score and connection primitives">
          <article className="jobs-primitives-card">
            <div className="jobs-primitives-heading">
              <div><span className="jobs-primitives-overline">Score breakdown</span><h2>Strong fit, verified evidence</h2></div>
              <div className="jobs-score-pair" aria-label="Fit 91, confidence 94"><span><strong>91</strong> fit</span><span><strong>94</strong> confidence</span></div>
            </div>
            <div className="jobs-score-signals">
              {scoreSignals.map(([label, points, evidence]) => <div key={label}><span><strong>{label}</strong><small>{evidence}</small></span><b>{points}</b></div>)}
            </div>
            <div className="jobs-state-callout warning" data-testid="score-low-confidence"><Info size={18} /><span><strong>Low confidence</strong> Missing salary evidence never improves fit.</span></div>
          </article>

          <article className="jobs-primitives-card">
            <span className="jobs-primitives-overline">Connection status</span>
            <h2>Mailbox permission is separate</h2>
            <div className="jobs-connection-list">
              {connections.map(([id, tone, label, title, detail, action]) => (
                <div data-testid={id} key={id}>
                  <span className={`jobs-state-icon ${tone}`} aria-hidden="true">{tone === "success" ? <Check size={17} /> : <Shield size={17} />}</span>
                  <span><span className={`jobs-state-badge ${tone}`}>{label}</span><strong>{title}</strong><small>{detail}</small></span>
                  <Button variant="outline" size="compact" type="button" onClick={() => setNotice(`${action} selected for ${title}.`)}>{action}</Button>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="jobs-primitives-section" id="preview-2">
          <div className="jobs-primitives-heading">
            <div><span className="jobs-primitives-overline">Queue rows</span><h2>Review state before any provider call</h2></div>
            <Button type="button" onClick={() => setDialogOpen(true)}>Open approval dialog</Button>
          </div>
          <div className="jobs-queue-list">
            {queueRows.map(([id, status, tone, title, company, detail]) => (
              <article data-testid={id} key={id}>
                <span className="jobs-queue-icon" aria-hidden="true">{tone === "danger" ? <AlertTriangle size={20} /> : <Briefcase size={20} />}</span>
                <span><span className={`jobs-state-badge ${tone}`}>{status}</span><h3>{title}</h3><p>{company}</p><small>{detail}</small></span>
                <Button as="a" variant="outline" size="compact" href="#preview-3">Review</Button>
              </article>
            ))}
          </div>
        </section>

        <section className="jobs-primitives-section" id="preview-3">
          <span className="jobs-primitives-overline">System states</span>
          <h2>Specific recovery, never false empty</h2>
          <div className="jobs-system-states">
            <article><Target size={24} /><h3>No applications waiting</h3><p>New eligible packages will appear after matching completes.</p><a href="/jobs">Find jobs</a></article>
            <div role="alert" className="error"><AlertTriangle size={24} /><h3>We could not refresh the queue</h3><p>Your saved packages are still available. Retry when the connection is ready.</p><Button variant="outline" size="compact" type="button" onClick={() => setNotice("Queue refresh requested.")}><RefreshCw size={16} /> Try again</Button></div>
            <article aria-busy="true" aria-label="Loading application queue"><div className="jobs-loading-mark" /><h3>Checking current packages</h3><div className="jobs-loading-line" /><div className="jobs-loading-line short" /></article>
          </div>
        </section>
      </div>

      {dialogOpen && (
        <AccessibleDialog label="Approve application email" onClose={() => setDialogOpen(false)}>
          <div className="jobs-primitives-dialog">
            <span className="jobs-primitives-overline">Review each</span>
            <h2>Approve this immutable package?</h2>
            <p>Approval expires in 24 hours. Any recipient, message, resume, score, policy, or sender change returns the package to review.</p>
            <div className="jobs-dialog-summary"><span><strong>Recipient</strong> jobs@northstar.example</span><span><strong>Sender</strong> applications@candidate.example</span></div>
            <div className="jobs-form-actions">
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel approval</Button>
              <Button type="button" onClick={() => { setNotice("Package approved in the showcase."); setDialogOpen(false); }}>Approve package</Button>
            </div>
          </div>
        </AccessibleDialog>
      )}
    </main>
  );
}
