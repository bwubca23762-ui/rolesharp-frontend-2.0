import type { BlogPost } from "@/lib/blog";

const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_FMT = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" });

export default function BlogPosts({ posts }: { posts: BlogPost[] }) {
  const groups: Array<{ label: string; posts: BlogPost[] }> = [];
  for (const post of posts) {
    const label = MONTH_FMT.format(new Date(post.datePublished));
    const group = groups[groups.length - 1];
    if (group && group.label === label) group.posts.push(post);
    else groups.push({ label, posts: [post] });
  }
  if (groups.length === 0) return <p className="text-[var(--muted-fg)]">No articles are available right now.</p>;
  return (
    <div className="reading-measure">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label} className="mb-10">
          <h2 className="mb-3 text-lg font-bold text-[var(--fg)]">
            {group.label}
          </h2>
          <ul className="reading-rows">
            {group.posts.map((p) => (
              <li key={p.slug}>
                <a href={`/blog/${p.slug}`} className="reading-row group">
                  <div>
                    <h3 className="m-0 text-lg font-bold! text-[var(--color-text)] transition-colors group-hover:text-[var(--color-primary)] dark:text-[var(--color-dark-text)] dark:group-hover:text-[var(--color-primary)]">
                      {p.h1}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                      {p.description}
                    </p>
                    <p className="reading-row-caption mb-0">
                      {p.category} · {p.readMins} min read ·{" "}
                      <time dateTime={p.datePublished}>
                        {DAY_FMT.format(new Date(p.datePublished))}
                      </time>
                    </p>
                  </div>
                  <span aria-hidden="true" className="reading-row-arrow">→</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
