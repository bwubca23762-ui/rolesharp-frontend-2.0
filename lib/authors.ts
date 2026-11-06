// Named authors for E-E-A-T. Blog posts reference an author by key; the byline
// and Person schema both read from here so there's one source of truth. A real
// named person with a bio is a stronger trust signal than a faceless "Team"
// byline, which matters for career (YMYL-adjacent) advice.

import { env } from "./env";

export type Author = {
  key: string;
  name: string;
  title: string; // role, shown next to the byline
  bio: string; // 1-2 sentences, used on the post + author page
  // Stable @id so BlogPosting.author points at one canonical Person node that
  // is itself worksFor the sitewide Organization (#org).
  sameAs?: string[]; // public profiles that corroborate the person
};

const AUTHORS: Record<string, Author> = {
  mustak: {
    key: "mustak",
    name: "Mustak",
    title: "Founder of RoleSharp",
    bio: "Mustak is the founder of RoleSharp. He built the platform after seeing how much stronger a resume performs when it's tailored to a specific company and role, and writes about ATS systems, resume strategy, and the modern job search.",
    sameAs: [],
  },
};

const DEFAULT_AUTHOR_KEY = "mustak";

export function getAuthor(key?: string): Author {
  return AUTHORS[key ?? DEFAULT_AUTHOR_KEY] ?? AUTHORS[DEFAULT_AUTHOR_KEY];
}

export function authorId(a: Author): string {
  return `${env.siteUrl}/#person-${a.key}`;
}

// Person node for the JSON-LD graph — linked from BlogPosting.author and tied
// back to the Organization so search engines resolve author→publisher.
export function authorPersonLd(a: Author) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": authorId(a),
    name: a.name,
    jobTitle: a.title,
    description: a.bio,
    worksFor: { "@id": `${env.siteUrl}/#org` },
    url: `${env.siteUrl}/about#founder`,
    ...(a.sameAs && a.sameAs.length ? { sameAs: a.sameAs } : {}),
  };
}
