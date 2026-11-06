import assert from "node:assert/strict";
import test from "node:test";
import { readStorage, writeStorage, WORKSPACE_STORAGE_KEY } from "../lib/workspace-context";

test("shared workspace preserves job-only drafts, migrates legacy resumes, and publishes edits and clearing", () => {
  const values = new Map<string, string>();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const target = new EventTarget();
  const updates: unknown[] = [];
  target.addEventListener("rolesharp:workspace-change", (event) => updates.push((event as CustomEvent).detail));
  Object.defineProperty(globalThis, "window", { configurable: true, value: target });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
  try {
    writeStorage({ jdText: "Looking for a software engineer", targetCompany: "Example" });
    assert.equal(readStorage()?.jdText, "Looking for a software engineer");
    assert.equal(readStorage()?.resumeText, undefined);
    writeStorage({ ...readStorage(), resumeText: "Engineer with five years of experience" });
    assert.equal(readStorage()?.targetCompany, "Example");
    assert.equal(updates.length, 2);
    writeStorage(null);
    assert.equal(readStorage(), null);
    assert.equal(updates.at(-1), null);
    assert.equal(values.has(WORKSPACE_STORAGE_KEY), false);
    values.set("rolesharp-checker-draft", JSON.stringify({ resumeText: "Legacy resume" }));
    assert.equal(readStorage()?.resumeText, "Legacy resume");
    assert.equal(values.has("rolesharp-checker-draft"), false);
    assert.equal(readStorage()?.origin, "checker-migrated");
  } finally {
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
