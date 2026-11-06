import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { listPosts } from "@/lib/blog";
import JsonLd from "../json-ld";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Container, Section, MarketingShell, PageHeader, Breadcrumb } from "@/components/ui/primitives";
import BlogPosts from "./BlogPosts";

// AI-generated posts land in the DB between deploys — re-render hourly so
// they show up without a rebuild. (Post pages already have ISR + dynamicParams.)
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Resume, ATS & Job Search Guides",
  description: "Practical guides on fixing old resumes, building ATS-friendly resumes manually, tailoring to job descriptions, and choosing AI resume tools.",
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: "RoleSharp Blog — Resume Fixer, Builder, ATS & Job-Search Guides",
    description: "Practical guides on fixing resumes, passing ATS filters, tailoring to job descriptions, and applying with more signal.",
    url: "/blog",
    images: ["/opengraph-image"],
  },
};

export default async function BlogIndex() {
  const posts = await listPosts();
  const site = env.siteUrl;
  // Blog node links publisher to the sitewide #org entity (app/layout.tsx) and
  // lists every post as a BlogPosting @id ref, so crawlers see the full archive
  // from the index page even before crawling each post.
  const blogLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${site}/blog#blog`,
    name: "The RoleSharp Blog",
    url: `${site}/blog`,
    description: metadata.description,
    inLanguage: "en-US",
    publisher: { "@id": `${site}/#org` },
    blogPost: posts.map((p) => ({ "@type": "BlogPosting", "@id": `${site}/blog/${p.slug}` })),
  };
  return (
    <MarketingShell className="reading-shell">
      <JsonLd data={blogLd} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", item: "/" },
          { name: "Blog", item: "/blog" },
        ])}
      />
      <section className="reading-masthead">
        <Container className="relative z-10 py-16 md:py-24">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Blog" }]} />
          <PageHeader
            title="The RoleSharp Blog"
            description="Practical guides to editing a resume, tailoring it to a job posting, and preparing for the next stage of your search."
            className="mb-0"
          />
        </Container>
      </section>

      <Section asContainer={false} size="sm">
        <Container>
          <div className="reading-article-grid grid items-start gap-8">
            <BlogPosts posts={posts} />
            <nav aria-label="Resume tools" className="reading-toc">
              <h2 className="text-base font-bold">Resume tools</h2>
              <ul className="text-sm">
                <li><a href="/resume-fixer">Fix an existing resume</a></li>
                <li><a href="/resume-builder">Build a resume</a></li>
                <li><a href="/checker">Check ATS score</a></li>
              </ul>
            </nav>
          </div>
        </Container>
      </Section>
    </MarketingShell>
  );
}
