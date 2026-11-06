import assert from "node:assert/strict";
import test from "node:test";
import { previewText } from "../lib/resume-form/preview-text";
import { newExperience } from "../app/build/experience-cards";

test("studio workspace text preserves authored sections without preview placeholders", () => {
  const empty = { name: "", role: "", company: "", email: "", phone: "", linkedin: "", location: "", links: [], summary: "", skills: [], experiences: [], education: [], projects: [], certifications: [], languages: [], achievements: [] };
  assert.equal(previewText(empty), "");
  const text = previewText({ ...empty, name: "A Candidate", role: "Engineer", skills: ["Go", "C#"], experiences: [newExperience({ title: "Engineer", company: "Example", location: "Remote", start: "2024", current: true, bullets: ["Reduced latency 20%"] })], education: [{ degree: "BSc", school: "University" }], certifications: ["Cloud certification"] });
  for (const value of ["A Candidate", "Go, C#", "Example", "Remote", "Present", "Reduced latency 20%", "University", "Cloud certification"]) assert.ok(text.includes(value));
  assert.equal(text.includes("Your Name"), false);
});
