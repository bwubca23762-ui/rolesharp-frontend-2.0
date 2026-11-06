"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/primitives";
import { SampleProvenance } from "@/components/marketing/ProductDemo";
import { trackProductEvent } from "@/app/product-analytics";

type Category = "All" | "ATS" | "Modern" | "Executive" | "Student" | "International";

type Template = {
  name: string;
  /** The template id lib/pdf.tsx and the maker's TEMPLATES list actually accept. */
  engineId: string;
  category: Exclude<Category, "All">;
  desc: string;
  best: string;
};

const CATEGORIES: Category[] = ["All", "ATS", "Modern", "Executive", "Student", "International"];

const TEMPLATES: Template[] = [
  {
    name: "Clarity",
    engineId: "basic",
    category: "ATS",
    desc: "A calm single-column layout with standard headings and a predictable reading order.",
    best: "Operations, healthcare, government",
  },
  {
    name: "Momentum",
    engineId: "modern",
    category: "Modern",
    desc: "A skills-forward layout for candidates whose tools and projects need to scan quickly.",
    best: "Engineering, product, data",
  },
  {
    name: "Ledger",
    engineId: "executive",
    category: "Executive",
    desc: "A restrained two-column system that gives leadership scope and credentials room to breathe.",
    best: "Finance, consulting, leadership",
  },
  {
    name: "Studio",
    engineId: "elegant",
    category: "Modern",
    desc: "A confident editorial frame for portfolios, selected work, and recognizable clients.",
    best: "Design, brand, creative",
  },
  {
    name: "First Step",
    engineId: "compact",
    category: "Student",
    desc: "Education, projects, and practical skills lead when a long work history is not the story yet.",
    best: "Students and career starters",
  },
  {
    name: "Borderless",
    engineId: "minimal",
    category: "International",
    desc: "Country-aware structure with flexible personal details, date formats, and section order.",
    best: "Cross-border applications",
  },
];

export default function TemplateCatalog() {
  const [category, setCategory] = useState<Category>("All");
  const [selectedId, setSelectedId] = useState(TEMPLATES[0].engineId);
  const visible = category === "All" ? TEMPLATES : TEMPLATES.filter((item) => item.category === category);
  const selected = visible.find((item) => item.engineId === selectedId) ?? visible[0];

  function select(template: Template) {
    setSelectedId(template.engineId);
    trackProductEvent("template_preview", { context: `catalog:${template.name.toLowerCase().replace(/\s+/gu, "_")}`, authState: "anonymous" });
  }

  return (
    <div>
      <fieldset aria-label="Filter resume templates" className="mb-5 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold">Filter resume templates</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[var(--border)]">
          {CATEGORIES.map((item) => (
            <label key={item} className="desk-template-filter">
              <input className="sr-only" type="radio" name="template-category" checked={category === item} onChange={() => {
                setCategory(item);
                const first = TEMPLATES.find((template) => item === "All" || template.category === item);
                if (first) select(first);
              }} />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div role="dialog" aria-label="Resume template details and preview" className="desk-template-layout">
        <figure className="desk-template-stage">
          <Image src={`/templates/${selected.engineId}.webp`} alt={`Sample resume in the ${selected.name} template`} width={460} height={650} sizes="(max-width: 767px) 85vw, 460px" priority />
          <figcaption><SampleProvenance status="fictional" detail="This example shows the layout." className="mt-3 justify-center" /></figcaption>
        </figure>
        <div className="min-w-0 py-4 md:py-8">
          <fieldset className="mb-5 min-w-0 border-0 p-0">
            <legend className="mb-2 text-sm font-semibold">Choose a template to preview</legend>
            <div className="flex flex-wrap gap-2">
              {visible.map((template) => (
                <label className="desk-template-option" key={template.engineId}>
                  <input className="sr-only" type="radio" name="resume-template" checked={selected === template} onChange={() => select(template)} />
                  <span>{template.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div aria-live="polite">
            <h3 className="text-[clamp(2rem,4vw,3rem)]! leading-tight!">{selected.name}</h3>
            <p className="mt-3 text-base text-[var(--muted-fg)]">{selected.desc}</p>
            <dl className="my-6 border-y border-[var(--border)] py-4">
              <dt className="text-sm font-semibold">Best for</dt>
              <dd className="mt-1 text-[var(--muted-fg)]">{selected.best}</dd>
            </dl>
          </div>
          <Button as="a" href={`/resume-maker?template=${selected.engineId}`} onClick={() =>
            trackProductEvent("template_use", { context: `catalog:${selected.name.toLowerCase().replace(/\s+/gu, "_")}`, authState: "anonymous" })
          }>Use this template</Button>
        </div>
      </div>
    </div>
  );
}
