import "@/app/reading-surfaces.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "../json-ld";
import { KEY_LOCALES, getLocale, LOCALE_LANGUAGE_ALTERNATES } from "@/lib/locales";
import { breadcrumbLd } from "@/lib/seo";
import { env } from "@/lib/env";
import { Container, Section, Button, MarketingShell, Breadcrumb } from "@/components/ui/primitives";

type Params = { params: Promise<{ locale: string }> };

// Locale pages are an intentionally closed set. Without this guard, the
// top-level dynamic segment can stream the not-found UI with a misleading 200.
export const dynamicParams = false;

export function generateStaticParams() {
  return KEY_LOCALES.map((locale) => ({ locale: locale.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const data = getLocale(locale);
  if (!data) notFound();
  return {
    title: data.seoTitle,
    description: data.description,
    alternates: {
      canonical: `/${data.slug}`,
      languages: {
        ...LOCALE_LANGUAGE_ALTERNATES,
        "x-default": "/",
      },
    },
    openGraph: {
      type: "website",
      images: ["/opengraph-image"],
      title: data.seoTitle,
      description: data.description,
      url: `/${data.slug}`,
    },
  };
}

export default async function LocaleLandingPage({ params }: Params) {
  const { locale } = await params;
  const data = getLocale(locale);
  if (!data) notFound();

  const direction = data.lang.startsWith("ar-") ? "rtl" : undefined;

  return (
    <MarketingShell className="content reading-shell">
      <Container>
        <JsonLd
          data={breadcrumbLd([
            { name: "Home", item: `${env.siteUrl}/` },
            { name: data.nativeName, item: `${env.siteUrl}/${data.slug}` },
          ])}
        />

        <section className="reading-masthead">
          <div>
            <Breadcrumb items={[{ label: "Home", href: "/" }, { label: data.nativeName }]} />
            <div lang={data.lang} dir={direction} className="reading-locale-copy reading-measure">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4 tracking-tight">
                {data.h1}
              </h1>
              <p className="text-lg md:text-xl text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)] max-w-2xl leading-relaxed mb-8">
                {data.summary}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button as="a" href="/build" size="lg">{data.buildCta}</Button>
                <Button as="a" href="/checker" variant="outline" size="lg">{data.checkerCta}</Button>
                <Button as="a" href="/resume-translator" variant="outline" size="lg">{data.translatorCta}</Button>
              </div>
            </div>
          </div>
        </section>

        <Section asContainer={false}>
          <div lang={data.lang} dir={direction} className="grid md:grid-cols-2 gap-6">
            <section className="reading-index-section">
              <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">{data.helpHeading}</h2>
              <ul className="space-y-3 text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                {data.helpBullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-2 shrink-0" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </section>
            <section className="reading-index-section">
              <h2 className="text-xl font-bold text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-4">{data.startHeading}</h2>
              <p className="text-[var(--color-text)] dark:text-[var(--color-dark-text)] mb-2">{data.startText}</p>
              <p className="text-[var(--color-text-muted)] dark:text-[var(--color-dark-text-muted)]">
                <a href="/checker" className="reading-text-link">{data.startTextLinks.checker}</a>,{" "}
                <a href="/resume-builder" className="reading-text-link">{data.startTextLinks.builder}</a>,{" "}
                <a href="/resume-templates" className="reading-text-link">{data.startTextLinks.templates}</a>,{" "}
                <a href="/resume-examples" className="reading-text-link">{data.startTextLinks.examples}</a>,{" "}
                <a href="/cover-letter-generator" className="reading-text-link">{data.startTextLinks.coverLetter}</a>.
              </p>
            </section>
          </div>
        </Section>
      </Container>
    </MarketingShell>
  );
}
