"use client";
import { useState } from "react";
import { Grip, Trash, ChevronDown } from "@/app/icons";

export default function RepeatableCard({
  title,
  subtitle,
  index,
  total,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle?: string;
  index: number;
  total: number;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="repeat-card">
      <div className="repeat-head">
        <span className="repeat-grip" aria-hidden="true">
          <Grip />
        </span>
        <button
          type="button"
          className="repeat-toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={`repeat-chev ${open ? "open" : ""}`} aria-hidden="true">
            <ChevronDown />
          </span>
          <span className="repeat-titles">
            <span className="repeat-title">{title || "Untitled"}</span>
            {subtitle ? <span className="repeat-subtitle">{subtitle}</span> : null}
          </span>
        </button>
        <div className="repeat-actions">
          <button
            type="button"
            className="icon-btn-sm"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label="Move up"
            title="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-btn-sm"
            disabled={index === total - 1}
            onClick={onMoveDown}
            aria-label="Move down"
            title="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            className="icon-btn-sm danger"
            onClick={onDelete}
            aria-label="Delete entry"
            title="Delete"
          >
            <Trash />
          </button>
        </div>
      </div>
      {open ? <div className="repeat-body">{children}</div> : null}
    </div>
  );
}
