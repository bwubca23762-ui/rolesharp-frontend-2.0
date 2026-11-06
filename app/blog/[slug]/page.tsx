import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import JsonLd from "@/app/json-ld";
import { notFound } from "next/navigation";
import { getPost, filePostSlugs, listPosts, type BlogPost } from "@/lib/blog";
import { env } from "@/lib/env";
import { breadcrumbLd } from "@/lib/seo";
import { getAuthor, authorId, authorPersonLd } from "@/lib/authors";
import { Container, Section, Card, Button, Badge, MarketingShell, Breadcrumb } from "@/components/ui/primitives";
import { blogSeoTitle, conciseSeoDescription } from "@/lib/seo-metadata";

// Internal linking: 3 most-related posts by tag overlap (same category breaks
// ties). Keeps crawlers and readers moving instead of dead-ending at the CTA.
function relatedPosts(post: BlogPost, all: BlogPost[]): BlogPost[] {
  return all
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({
      p,
      score:
        p.tags.filter((t) => post.tags.includes(t)).length * 2 +
        (p.category === post.category ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ p }) => p);
}

// Paragraphs are plain strings, but posts can embed markdown-style internal
// links ([text](/path)). Rendered as <a> here; the /blog/<slug>.md twin keeps
// them as markdown, which AI crawlers read natively.
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\[[^\]]+\]\(\/[^\s)]*\))/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const m = part.match(/^\[([^\]]+)\]\((\/[^\s)]*)\)$/);
    return m
      ? <a key={i} href={m[2]} className="font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">{m[1]}</a>
      : part;
  });
}

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return filePostSlugs().map((slug) => ({ slug }));
}

export const revalidate = 86400; // ISR: rebuilds stale blog pages every 24h
export const dynamicParams = true; // DB-generated posts (not in static params) render on demand

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const title = blogSeoTitle(post.slug, post.title);
  const description = conciseSeoDescription(post.description);
  return {
    title: { absolute: title },
    description,
    keywords: post.tags,
    alternates: {
      canonical: `/blog/${post.slug}`,
      // Markdown twin for AI crawlers (see app/blog/[slug].md/route.ts)
      types: { "text/markdown": `/blog/${post.slug}.md` },
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${env.siteUrl}/blog/${post.slug}`,
      images: [`/blog/${post.slug}/opengraph-image`],
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
    },
    twitter: { card: "summary_large_image", title, description, images: [`/blog/${post.slug}/opengraph-image`] },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const site = env.siteUrl;
  const related = relatedPosts(post, await listPosts());
  const author = getAuthor(post.author);

  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      mainEntityOfPage: { "@type": "WebPage", "@id": `${site}/blog/${post.slug}` },
      headline: post.h1,
      description: post.description,
      image: `${site}/blog/${post.slug}/opengraph-image`,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      // author is a named Person node (below); publisher @id refs the sitewide
      // #org entity (app/layout.tsx @graph) instead of duplicating it here.
      author: { "@id": authorId(author) },
      publisher: { "@id": `${site}/#org` },
      inLanguage: "en-US",
      keywords: post.tags.join(", "),
    },
    authorPersonLd(author),
    {
      ...breadcrumbLd([
        { name: "Home", item: `${site}/` },
        { name: "Blog", item: `${site}/blog` },
        { name: post.h1, item: `${site}/blog/${post.slug}` },
      ]),
    },
    ...(post.faqs?.length
      ? [{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: post.faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
        }]
      : []),
  ];

  const dateFmt = new Date(post.datePublished).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const modifiedFmt = new Date(post.dateModified).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const isRevized = post.dateModified.slice(0, 10) !== post.datePublished.slice(0, 10);

  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={ld} />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog", href: "/blog" }, { label: post.category }]} />
          <Badge variant="primary" className="mb-4">{post.category}</Badge>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 max-w-4xl">
            {post.h1}
          </h1>
          <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
            By {author.name}, {author.title} — {dateFmt} — {post.readMins} min read
            {isRevized && <span> — last verified {modifiedFmt}</span>}
          </p>
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          {/* AEO: direct answer up top — the snippet AI engines extract. */}
          <Card className="border-l-4 border-[var(--color-primary)] mb-6" padding="md">
            <strong className="text-[var(--color-text)] dark:text-[var(--color-dark-text)]">Quick answer:</strong>{" "}
            <span className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{post.answer}</span>
            <span className="mt-2 block text-xs text-[var(--color-text-faint)] dark:text-[var(--color-dark-text-faint)]">
              Verified against the tools and postings described on {modifiedFmt}. Guidance, not a guarantee of any recruiter's behavior.
            </span>
          </Card>

          <div className="reading-article-grid grid items-start gap-8">
            <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
              <nav aria-label="Article contents" className="reading-toc">
                <h2 className="text-base font-bold">On this page</h2>
                <ul className="text-sm">
                  {post.sections.map((section, index) => section.heading && (
                    <li key={index}><a href={`#section-${index}`}>{section.heading}</a></li>
                  ))}
                </ul>
              </nav>
            </aside>
            <article className="reading-measure min-w-0 space-y-6 lg:col-start-1 lg:row-start-1 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-[var(--color-border)] [&_h2]:pb-2 dark:[&_h2]:border-[var(--color-dark-border)]">
              {post.sections.map((s, i) => (
                <section key={i} id={`section-${i}`} className="scroll-mt-24">
                  {s.heading && <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{s.heading}</h2>}
                  {s.paragraphs?.map((p, j) => (
                    <p key={j} className="text-[var(--color-text)] dark:text-[var(--color-dark-text)] leading-relaxed mb-3">{renderInline(p)}</p>
                  ))}
                  {s.bullets && (s.ordered
                    ? <ol className="list-decimal pl-5 space-y-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{s.bullets.map((b, k) => <li key={k}>{b}</li>)}</ol>
                    : <ul className="list-disc pl-5 space-y-2 text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{s.bullets.map((b, k) => <li key={k}>{b}</li>)}</ul>
                  )}
                  {s.table && (
                    <div tabIndex={0} role="region" aria-label={s.heading || "Article table"} className="overflow-x-auto my-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
                      <table className="w-full min-w-[600px] text-sm border-collapse">
                        <thead className="bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)]">
                          <tr>{s.table.headers.map((h, k) => <th scope="col" key={k} className="text-left px-4 py-3 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {s.table.rows.map((row, r) => (
                            <tr key={r} className="border-t border-[var(--color-border)] dark:border-[var(--color-dark-border)]">
                              {row.map((cell, c) => c === 0
                                ? <th scope="row" key={c} className="text-left px-4 py-3 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)]">{cell}</th>
                                : <td key={c} className="px-4 py-3 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">{cell}</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}

              {!!post.faqs?.length && (
                <section>
                  <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">Frequently asked questions</h2>
                  <div className="space-y-3">
                    {post.faqs.map(([q, a]) => (
                      <details
                        key={q}
                        className="group rounded-[var(--radius-lg)] bg-[var(--color-surface)] dark:bg-[var(--color-dark-surface)] border border-[var(--color-border)] dark:border-[var(--color-dark-border)] open:border-[var(--color-primary)] transition-colors"
                      >
                        <summary className="flex items-center justify-between gap-4 px-5 py-4 font-semibold text-[var(--color-text)] dark:text-[var(--color-dark-text)] cursor-pointer list-none hover:text-[var(--color-primary)] transition-colors">
                          <h3 className="text-base">{q}</h3>
                          <span aria-hidden="true" className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--color-surface-2)] dark:bg-[var(--color-dark-surface-2)] group-open:bg-[var(--color-primary)] group-open:text-white flex items-center justify-center text-sm transition-colors">+</span>
                        </summary>
                        <p className="px-5 pb-5 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">{a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              )}
            </article>
          </div>

          <section className="mt-10">
            <Card variant="elevated" padding="md" className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--color-primary)] text-white grid place-items-center text-lg font-bold" aria-hidden="true">
                {author.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] m-0">
                  {author.name} <span className="font-normal text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">— {author.title}</span>
                </p>
                <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed mt-1 mb-0">{author.bio}</p>
              </div>
            </Card>
          </section>

          {related.length > 0 && (
            <section className="mt-10">
              <h2 className="text-2xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">Keep reading</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {related.map((r) => (
                  <a key={r.slug} href={`/blog/${r.slug}`} className="group block h-full">
                    <Card variant="elevated" padding="md" className="h-full transition-colors hover:border-[var(--color-primary)]">
                      <b className="block text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2 group-hover:text-[var(--color-primary)] transition-colors">{r.h1}</b>
                      <span className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] leading-relaxed">{r.description}</span>
                    </Card>
                  </a>
                ))}
              </div>
            </section>
          )}
        </Container>
      </Section>

      <Section asContainer={false} size="sm">
        <Container size="small">
          <Card variant="gradient" padding="lg" className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Choose your next resume step</h2>
            <p className="text-white/90 mb-6 max-w-2xl mx-auto leading-relaxed">
              Fix an old resume, build manually from structured details, or AI-tailor a version to one exact job.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button as="a" href="/checker" variant="outlineInverse" size="lg">Check your resume</Button>
              <Button as="a" href="/resume-fixer" variant="primaryInverse" size="lg">Fix old resume</Button>
              <Button as="a" href="/resume-maker" variant="outlineInverse" size="lg">Make manually</Button>
              <Button as="a" href="/build" variant="outlineInverse" size="lg">AI-tailor</Button>
            </div>
          </Card>
        </Container>
      </Section>
    </MarketingShell>
  );
}
