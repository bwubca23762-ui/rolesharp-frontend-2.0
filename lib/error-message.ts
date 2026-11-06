// Validation-failure responses used to carry parsed.error.flatten() objects;
// the routes now serialize to a string, but any consumer that renders an
// error into JSX must never trust the shape — an object child crashes React
// ("Objects are not valid as a React child"). One sanitizer, everywhere an
// API error lands in state.
export function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const shape = value as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const firstField = shape.fieldErrors ? Object.values(shape.fieldErrors)[0]?.[0] : undefined;
    return shape.formErrors?.[0] || firstField || fallback;
  }
  return fallback;
}
