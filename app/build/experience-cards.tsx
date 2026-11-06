"use client";
import { useState } from "react";
import RepeatableCard from "@/components/ui/RepeatableCard";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash, Sparkles } from "@/app/icons";
import { Button } from "@/components/ui/primitives";
import { hasMetric } from "@/lib/ats-score";

export type ExperienceEntry = {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end: string;
  current: boolean;
  bullets: string[];
  impactFacts: {
    metric: string;
    scope: string;
    outcome: string;
    timeframe: string;
  };
};

let _seq = 0;
function uid() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {}
  return `exp-${++_seq}-${Date.now()}`;
}

export function newExperience(partial: Partial<ExperienceEntry> = {}): ExperienceEntry {
  const impactFacts = {
    metric: partial.impactFacts?.metric ?? "",
    scope: partial.impactFacts?.scope ?? "",
    outcome: partial.impactFacts?.outcome ?? "",
    timeframe: partial.impactFacts?.timeframe ?? "",
  };
  return {
    id: uid(),
    title: "",
    company: "",
    location: "",
    start: "",
    end: "",
    current: false,
    bullets: [""],
    ...partial,
    impactFacts,
  };
}

export default function ExperienceCards({
  experiences,
  setExperiences,
  role,
  company,
}: {
  experiences: ExperienceEntry[];
  setExperiences: (next: ExperienceEntry[]) => void;
  role?: string;
  company?: string;
}) {
  const { toast } = useToast();
  const [improving, setImproving] = useState<string | null>(null);

  const update = (id: string, patch: Partial<ExperienceEntry>) =>
    setExperiences(experiences.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const updateImpact = (id: string, key: keyof ExperienceEntry["impactFacts"], value: string) => {
    const e = experiences.find((x) => x.id === id);
    if (!e) return;
    update(id, { impactFacts: { ...e.impactFacts, [key]: value } });
  };

  const remove = (id: string) => setExperiences(experiences.filter((e) => e.id !== id));

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= experiences.length) return;
    const next = [...experiences];
    [next[idx], next[j]] = [next[j], next[idx]];
    setExperiences(next);
  };

  // ---- bullet ops ----
  const setBullet = (id: string, bi: number, val: string) => {
    const e = experiences.find((x) => x.id === id);
    if (!e) return;
    const bullets = e.bullets.map((b, i) => (i === bi ? val : b));
    update(id, { bullets });
  };
  const addBullet = (id: string) => {
    const e = experiences.find((x) => x.id === id);
    if (!e) return;
    update(id, { bullets: [...e.bullets, ""] });
  };
  const removeBullet = (id: string, bi: number) => {
    const e = experiences.find((x) => x.id === id);
    if (!e) return;
    const bullets = e.bullets.filter((_, i) => i !== bi);
    update(id, { bullets: bullets.length ? bullets : [""] });
  };
  const moveBullet = (id: string, bi: number, dir: -1 | 1) => {
    const e = experiences.find((x) => x.id === id);
    if (!e) return;
    const j = bi + dir;
    if (j < 0 || j >= e.bullets.length) return;
    const bullets = [...e.bullets];
    [bullets[bi], bullets[j]] = [bullets[j], bullets[bi]];
    update(id, { bullets });
  };

  async function improveBullet(id: string, bi: number) {
    const e = experiences.find((x) => x.id === id);
    const text = e?.bullets[bi]?.trim();
    if (!text) { toast("Write the bullet first.", "info"); return; }
    const key = `${id}:${bi}`;
    setImproving(key);
    try {
      const r = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet: text, role: role || e?.title, company }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { toast("Log in to use AI improve.", "info"); return; }
      if (!r.ok || !j.improved) { toast(j.error || "Could not improve that bullet.", "error"); return; }
      setBullet(id, bi, j.improved);
      toast("Bullet improved.", "success");
    } catch {
      toast("Network error. Try again.", "error");
    } finally {
      setImproving(null);
    }
  }

  return (
    <div className="exp-cards">
      {experiences.map((e, idx) => (
        <RepeatableCard
          key={e.id}
          title={e.title || "New experience"}
          subtitle={[e.company, e.current ? "Present" : e.end].filter(Boolean).join(" — ")}
          index={idx}
          total={experiences.length}
          onDelete={() => remove(e.id)}
          onMoveUp={() => move(idx, -1)}
          onMoveDown={() => move(idx, 1)}
          defaultOpen={experiences.length <= 2}
        >
          <div className="form-grid">
            <div><label className="label" htmlFor={`experience-${e.id}-title`}>Job title</label><input id={`experience-${e.id}-title`} className="field" value={e.title} onChange={(ev) => update(e.id, { title: ev.target.value })} placeholder="Accountant" /></div>
            <div><label className="label" htmlFor={`experience-${e.id}-company`}>Company</label><input id={`experience-${e.id}-company`} className="field" value={e.company} onChange={(ev) => update(e.id, { company: ev.target.value })} placeholder="Acme Pvt Ltd" /></div>
            <div><label className="label" htmlFor={`experience-${e.id}-location`}>Location</label><input id={`experience-${e.id}-location`} className="field" value={e.location} onChange={(ev) => update(e.id, { location: ev.target.value })} placeholder="City, Country" /></div>
            <div>
              <label className="label" htmlFor={`experience-${e.id}-start`}>Start</label>
              <input id={`experience-${e.id}-start`} className="field" value={e.start} onChange={(ev) => update(e.id, { start: ev.target.value })} placeholder="Jan 2024" />
            </div>
            <div>
              <label className="label" htmlFor={`experience-${e.id}-end`}>End</label>
              <input id={`experience-${e.id}-end`} className="field" value={e.current ? "" : e.end} disabled={e.current} onChange={(ev) => update(e.id, { end: ev.target.value })} placeholder={e.current ? "Present" : "Dec 2024"} />
            </div>
            <div className="exp-current">
              <label className="exp-check" htmlFor={`experience-${e.id}-current`}>
                <input id={`experience-${e.id}-current`} type="checkbox" checked={e.current} onChange={(ev) => update(e.id, { current: ev.target.checked, end: ev.target.checked ? "" : e.end })} />
                <span>I currently work here</span>
              </label>
            </div>
          </div>

          <span className="label" id={`experience-${e.id}-bullets-label`}>What you did <span className="text-[0.85rem] text-[var(--muted-fg)]">(one achievement per bullet)</span></span>
          <div className="bullet-list" role="group" aria-labelledby={`experience-${e.id}-bullets-label`}>
            {e.bullets.map((b, bi) => {
              const key = `${e.id}:${bi}`;
              return (
                <div className="bullet-row" key={bi}>
                  <div className="bullet-move">
                    <button type="button" className="icon-btn-sm" disabled={bi === 0} onClick={() => moveBullet(e.id, bi, -1)} aria-label="Move bullet up" title="Move up">↑</button>
                    <button type="button" className="icon-btn-sm" disabled={bi === e.bullets.length - 1} onClick={() => moveBullet(e.id, bi, 1)} aria-label="Move bullet down" title="Move down">↓</button>
                  </div>
                  <textarea
                    aria-label={`Achievement ${bi + 1} for ${e.title || "this experience"}`}
                    className="field bullet-input"
                    rows={2}
                    value={b}
                    onChange={(ev) => setBullet(e.id, bi, ev.target.value)}
                    placeholder="Reconciled 120+ monthly invoices, cutting errors by 30%"
                  />
                  <div className="bullet-actions">
                    <Button type="button" variant="ghost" size="compact" className="bullet-improve" disabled={improving === key} isLoading={improving === key} onClick={() => improveBullet(e.id, bi)} title="Rewrite with AI">
                      <Sparkles size={14} /> AI improve
                    </Button>
                    <button type="button" className="icon-btn-sm danger" onClick={() => removeBullet(e.id, bi)} aria-label="Delete bullet" title="Delete bullet"><Trash size={14} /></button>
                  </div>
                  {b.trim().length > 12 && !hasMetric(b) && (
                    <div className="bullet-hint" title="Bullets with numbers score much higher">
                      📈 Add a number — how much? how many? how fast? (e.g. “by 30%”, “2M users”, “in 5 days”)
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Button type="button" variant="ghost" size="compact" className="add-bullet" onClick={() => addBullet(e.id)}><Plus size={14} /> Add bullet</Button>
          <div className="form-grid" style={{ marginTop: 14 }}>
            <div><label className="label" htmlFor={`experience-${e.id}-metric`}>Impact metric</label><input id={`experience-${e.id}-metric`} className="field" value={e.impactFacts.metric} onChange={(ev) => updateImpact(e.id, "metric", ev.target.value)} placeholder="32% faster, 120 invoices/month, $80k saved" /></div>
            <div><label className="label" htmlFor={`experience-${e.id}-scope`}>Scope</label><input id={`experience-${e.id}-scope`} className="field" value={e.impactFacts.scope} onChange={(ev) => updateImpact(e.id, "scope", ev.target.value)} placeholder="customer workflow, 3 squads, 2M users" /></div>
            <div><label className="label" htmlFor={`experience-${e.id}-outcome`}>Outcome</label><input id={`experience-${e.id}-outcome`} className="field" value={e.impactFacts.outcome} onChange={(ev) => updateImpact(e.id, "outcome", ev.target.value)} placeholder="reduced errors, improved uptime, increased conversions" /></div>
            <div><label className="label" htmlFor={`experience-${e.id}-timeframe`}>Timeframe</label><input id={`experience-${e.id}-timeframe`} className="field" value={e.impactFacts.timeframe} onChange={(ev) => updateImpact(e.id, "timeframe", ev.target.value)} placeholder="per month, in Q2, within 6 weeks" /></div>
          </div>
          <p className="text-[0.85rem] text-[var(--muted-fg)]" style={{ marginTop: 6 }}>These are optional but high-impact. Premium uses them to turn vague bullets into quantified, ATS-friendly achievements without inventing facts.</p>
        </RepeatableCard>
      ))}

      <Button type="button" variant="outline" className="add-exp" onClick={() => setExperiences([...experiences, newExperience()])}>
        <Plus size={16} /> Add experience
      </Button>
    </div>
  );
}
