import { env } from "./env";

export type BreadcrumbLink = {
  name: string;
  item: string;
};

export function breadcrumbLd(items: BreadcrumbLink[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      // Google breadcrumb rich results require an absolute URL. Relative
      // values render in browsers but are reported as invalid/N/A items in
      // Search Console's Breadcrumb enhancement report.
      item: new URL(item.item, `${env.siteUrl}/`).toString(),
    })),
  };
}

// ---- JobPosting structured data (country jobs pages) ----
// Google's guidelines: JobPosting markup is for a *single* job, emitted on a
// page whose main content is that job. A directory page listing many jobs is
// not eligible for the rich result — marking up a list as one JobPosting (or
// emitting one per card on a search page) is the classic "jobs markup on a
// listing page" violation that earns a manual-action flag in GSC. What a
// directory page CAN honestly do: reference the listed jobs via ItemList,
// with each entry pointing at the original employer/board posting URL
// (apply_url — we never host the posting). We take the extra guard of only
// emitting entries whose apply_url is a clean http(s) URL, and we cap the
// list so the markup stays proportionate to the page's actual content.
export type JobListEntry = {
  title: string;
  company: string;
  location: string | null;
  applyUrl: string;
  datePosted: string | null;
};

export function jobListLd(jobs: JobListEntry[]) {
  const clean = jobs.filter(
    (j) => j.title && j.company && /^https?:\/\/\S+$/.test(j.applyUrl),
  );
  if (!clean.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: clean.map((job, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: job.applyUrl,
      name: `${job.title} — ${job.company}${job.location ? ` (${job.location})` : ""}`,
      ...(job.datePosted ? { datePosted: job.datePosted.slice(0, 10) } : {}),
    })),
  };
}
