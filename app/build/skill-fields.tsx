"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/primitives";
import { Plus, X } from "../icons";

function fieldId(index: number) {
  return index === 0 ? "bp-skills" : `bp-skills-${index + 1}`;
}

export default function SkillFields({ values, onChange, suggestions, onHighlight }: {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: string[];
  onHighlight: (active: boolean) => void;
}) {
  const focusIndex = useRef<number | null>(null);

  useEffect(() => {
    if (focusIndex.current === null) return;
    document.getElementById(fieldId(focusIndex.current))?.focus();
    focusIndex.current = null;
  }, [values]);

  const entered = values.map((value) => value.trim().toLowerCase()).filter(Boolean);
  const options = suggestions.filter((skill) => !entered.includes(skill.toLowerCase()));

  function addSkill(skill = "") {
    const emptyIndex = skill ? values.findIndex((value) => !value.trim()) : -1;
    focusIndex.current = emptyIndex < 0 ? values.length : emptyIndex;
    onChange(emptyIndex < 0 ? [...values, skill] : values.map((value, index) => index === emptyIndex ? skill : value));
  }

  function removeSkill(index: number) {
    focusIndex.current = Math.min(index, values.length - 2);
    onChange(values.filter((_, row) => row !== index));
  }

  return (
    <div className="mb-5">
      <label className="label" id="step-skills" htmlFor="bp-skills">Skills</label>
      <p id="bp-skills-help" className="mb-2! text-sm text-[var(--muted-fg)]">Choose a suggestion or type a skill you can demonstrate.</p>
      <div className="grid gap-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              id={fieldId(index)}
              className="field min-w-0"
              aria-label={index > 0 ? `Skill ${index + 1}` : undefined}
              aria-describedby="bp-skills-help"
              value={value}
              placeholder={index === 0 ? "Enter a skill" : "Enter another skill"}
              onChange={(event) => onChange(values.map((skill, row) => row === index ? event.target.value : skill))}
              onFocus={() => onHighlight(true)}
              onBlur={() => onHighlight(false)}
            />
            {values.length > 1 && (
              <Button type="button" variant="ghost" size="sm" className="shrink-0" aria-label={`Remove skill ${index + 1}`} onClick={() => removeSkill(index)}>
                <X size={16} aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-3" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => addSkill()}>
        Add skill
      </Button>
      {options.length > 0 && (
        <div className="mt-3">
          <p className="mb-2! text-sm font-semibold">Suggested skills</p>
          <div className="flex flex-wrap gap-2">
            {options.map((skill) => (
              <Button key={skill} type="button" variant="secondary" size="sm" onClick={() => addSkill(skill)}>
                {skill}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
