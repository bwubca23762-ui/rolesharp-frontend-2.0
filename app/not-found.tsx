import type { Metadata } from "next";
import { Container, Button } from "@/components/ui/primitives";

// Dedicated 404 with its own metadata: the root layout's canonical ("/") and
// hreflang cluster must not bleed onto error responses — a 404 that claims to
// be the canonical homepage is contradictory-signal noise for crawlers.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
  alternates: null,
};

export default function NotFound() {
  return (
    <main className="content">
      <Container className="py-24 text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-primary)] mb-3">404</p>
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">
          Page not found
        </h1>
        <p className="text-lg text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-md mx-auto mb-8">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button as="a" href="/">Go home</Button>
          <Button as="a" href="/checker" variant="outline">Check my resume</Button>
        </div>
      </Container>
    </main>
  );
}
