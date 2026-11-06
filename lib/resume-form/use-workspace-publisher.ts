"use client";

import { useEffect, useState } from "react";
import { readStorage, writeStorage, type WorkspaceDraft } from "../workspace-context";

/** Publish edits only after an input changes. Restoring an old form must not
 * overwrite a newer shared resume merely because the studio was opened. */
export function useWorkspacePublisher(patch: WorkspaceDraft, origin: string) {
  const [edited, setEdited] = useState(false);
  const serialized = JSON.stringify(patch);
  useEffect(() => {
    if (!edited) return;
    const timer = setTimeout(() => {
      const value = JSON.parse(serialized) as WorkspaceDraft;
      if (!value.resumeText?.trim()) return;
      writeStorage({ ...readStorage(), ...value, origin });
    }, 500);
    return () => clearTimeout(timer);
  }, [edited, serialized, origin]);
  return () => setEdited(true);
}
