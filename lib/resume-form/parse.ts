/**
 * Skills and similar short tags: commas, semicolons and newlines all separate.
 * Deliberately aggressive, because "React, TypeScript" pasted on one line is
 * two skills. Do NOT use this for values whose items contain commas of their
 * own, such as certifications; use bulletLines for those.
 */
export function splitList(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function bulletLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export function parseEducation(value: string) {
  return bulletLines(value).map((line) => {
    const [degree = line, school = "", year = "", detail = ""] = line
      .split("|")
      .map((item) => item.trim());
    return { degree, school, year, detail };
  });
}

export function parseProjects(value: string) {
  return bulletLines(value).map((line) => {
    const [name = "Project", ...rest] = line.split("|").map((item) => item.trim());
    return { name, detail: rest.join(" - ") || line };
  });
}
