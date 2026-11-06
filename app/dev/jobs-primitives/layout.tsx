import type { Metadata } from "next";
import type { ReactNode } from "react";

// A dev-only primitives fixture (Playwright uses it as the webServer readiness
// URL). It is a client page with no metadata of its own, so it was inheriting
// the root layout's canonical and eleven hreflangs — advertising itself to
// Google as a duplicate of the homepage.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function JobsPrimitivesLayout({ children }: { children: ReactNode }) {
  return children;
}
