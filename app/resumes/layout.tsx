import type { Metadata } from "next";

// Per-user saved resumes. Each id is a private document behind the API's
// ownership check, but the route itself inherited the root layout's
// index: true -- so crawlers could index an empty shell under an unbounded
// space of /resumes/<uuid> URLs. nofollow as well: there is nothing here for a
// crawler to usefully walk into.
export const metadata: Metadata = {
  title: "Saved resume",
  description: "A saved RoleSharp resume and its export tools.",
  robots: { index: false, follow: false },
};

export default function ResumesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
