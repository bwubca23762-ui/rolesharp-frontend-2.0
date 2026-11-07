"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/primitives";
import { ChevronDown, ChevronUp, Plus, X } from "../icons";

function fieldId(index: number) {
  return index === 0 ? "bp-skills" : `bp-skills-${index + 1}`;
}

const DEFAULT_SKILL_VALUES: readonly string[] = Object.freeze([""]);

export default function SkillFields({
  values,
  onChange,
  suggestions,
  onHighlight,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: string[];
  onHighlight: (active: boolean) => void;
}) {
  const focusIndex = useRef<number | null>(null);

  // Guarantee at least one skill input is always present
  const safeValues = values.length === 0 ? (DEFAULT_SKILL_VALUES as string[]) : values;

  useEffect(() => {
    if (focusIndex.current === null) return;
    const target = document.getElementById(fieldId(focusIndex.current));
    if (target) {
      target.focus();
    }
    focusIndex.current = null;
  }, [safeValues]);

  const entered = useMemo(
    () => safeValues.map((v) => v.trim().toLowerCase()).filter(Boolean),
    [safeValues],
  );

  // Detect duplicate skills to assist candidates
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const val of safeValues) {
      const normalized = val.trim().toLowerCase();
      if (!normalized) continue;
      if (seen.has(normalized)) {
        dupes.add(val.trim());
      } else {
        seen.add(normalized);
      }
    }
    return Array.from(dupes);
  }, [safeValues]);

  const options = suggestions.filter((skill) => !entered.includes(skill.toLowerCase()));

  function addSkill(skill = "") {
    const emptyIndex = skill ? safeValues.findIndex((value) => !value.trim()) : -1;
    if (emptyIndex >= 0) {
      focusIndex.current = emptyIndex;
      onChange(safeValues.map((val, idx) => (idx === emptyIndex ? skill : val)));
    } else {
      focusIndex.current = safeValues.length;
      onChange([...safeValues, skill]);
    }
  }

  function removeSkill(index: number) {
    if (safeValues.length <= 1) {
      // Clear first field rather than removing entirely
      onChange([""]);
      focusIndex.current = 0;
      return;
    }
    focusIndex.current = Math.max(0, index - 1);
    onChange(safeValues.filter((_, row) => row !== index));
  }

  function moveSkill(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= safeValues.length) return;
    const next = [...safeValues];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    focusIndex.current = targetIndex;
    onChange(next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      // Add a new skill row immediately below and shift focus
      const next = [...safeValues];
      next.splice(index + 1, 0, "");
      focusIndex.current = index + 1;
      onChange(next);
    } else if (event.key === "ArrowDown") {
      if (index < safeValues.length - 1) {
        event.preventDefault();
        document.getElementById(fieldId(index + 1))?.focus();
      }
    } else if (event.key === "ArrowUp") {
      if (index > 0) {
        event.preventDefault();
        document.getElementById(fieldId(index - 1))?.focus();
      }
    } else if (event.key === "Backspace" && safeValues[index] === "" && safeValues.length > 1) {
      event.preventDefault();
      removeSkill(index);
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1">
        <label className="label mb-0" id="step-skills" htmlFor="bp-skills">
          Skills
        </label>
        <span className="text-xs text-[var(--muted-fg)] font-medium">
          {safeValues.filter((v) => v.trim()).length} added
        </span>
      </div>
      <p id="bp-skills-help" className="mb-3 text-sm text-[var(--muted-fg)]">
        Add individual skills you can demonstrate. Enter one skill per row or choose from suggested keywords below.
      </p>

      {/* Duplicate warning notification */}
      {duplicates.length > 0 && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-md border border-[var(--warning)]/30 bg-[var(--warning-bg)] px-3 py-2 text-xs text-[var(--warning)]"
        >
          <span className="font-semibold">Notice:</span>
          <span>
            Duplicate {duplicates.length === 1 ? "skill" : "skills"} detected: &ldquo;{duplicates.join(", ")}&rdquo;. Keeping each skill unique maximizes ATS keyword coverage.
          </span>
        </div>
      )}

      {/* Dynamic Skill Rows List */}
      <div className="grid gap-2" role="group" aria-labelledby="step-skills">
        {safeValues.map((value, index) => (
          <div
            key={index}
            className="group flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 transition-colors focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]"
          >
            {/* Position indicator */}
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold text-[var(--muted-fg)]"
              aria-hidden="true"
            >
              #{index + 1}
            </span>

            {/* Input field */}
            <input
              id={fieldId(index)}
              className="field min-w-0 flex-1 border-0! bg-transparent! p-1.5! shadow-none! focus:ring-0! text-[var(--fg)] text-sm"
              aria-label={index > 0 ? `Skill ${index + 1}` : undefined}
              aria-describedby="bp-skills-help"
              value={value}
              placeholder={
                index === 0
                  ? "Enter a primary skill (e.g. Distributed Systems, Product Strategy)"
                  : `Enter skill ${index + 1} (press Enter to add next)`
              }
              onChange={(event) =>
                onChange(safeValues.map((skill, row) => (row === index ? event.target.value : skill)))
              }
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => onHighlight(true)}
              onBlur={() => onHighlight(false)}
            />

            {/* Reorder controls */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-fg)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label={`Move skill ${index + 1} up`}
                disabled={index === 0}
                onClick={() => moveSkill(index, "up")}
              >
                <ChevronUp size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded text-[var(--muted-fg)] hover:text-[var(--fg)] hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                aria-label={`Move skill ${index + 1} down`}
                disabled={index === safeValues.length - 1}
                onClick={() => moveSkill(index, "down")}
              >
                <ChevronDown size={14} aria-hidden="true" />
              </button>
            </div>

            {/* Remove control */}
            {safeValues.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-[var(--muted-fg)] hover:text-[var(--danger)]"
                aria-label={`Remove skill ${index + 1}`}
                onClick={() => removeSkill(index)}
              >
                <X size={15} aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Clear "+ Add another skill" action below the input list */}
      <div className="mt-3 flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-medium"
          leftIcon={<Plus size={16} aria-hidden="true" />}
          onClick={() => addSkill()}
          aria-label="Add skill"
        >
          Add skill
        </Button>
        <span className="text-xs text-[var(--muted-fg)] hidden sm:inline">
          Tip: Press <kbd className="rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-mono">Enter</kbd> to add the next skill
        </span>
      </div>

      {/* Suggestions pill cloud */}
      {options.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--hairline)]">
          <p className="mb-2 text-xs font-semibold text-[var(--muted-fg)] uppercase tracking-wider">
            Suggested skills for this role
          </p>
          <div className="flex flex-wrap gap-1.5">
            {options.slice(0, 12).map((skill) => (
              <button
                key={skill}
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--fg)] hover:border-[var(--primary)] hover:bg-[var(--surface)] transition-colors cursor-pointer"
                onClick={() => addSkill(skill)}
              >
                <Plus size={12} className="text-[var(--primary)]" aria-hidden="true" />
                <span>{skill}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
