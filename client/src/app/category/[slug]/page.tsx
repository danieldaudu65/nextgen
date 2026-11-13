import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategories, getCategory, getPublishedArticles } from '@/lib/api';
import { CATEGORIES, categoryBySlug, categoryHref, inCategory } from '@/lib/categories';
import EditionGrid from '@/components/EditionGrid';
import CategoryIcon from '@/components/CategoryIcon';

type Props = { params: Promise<{ slug: string }> };

// Admin can add categories at any time, so these pages are built on request (always fresh)
export const dynamic = 'force-dynamic';

// The category + its stories from the API (GET /categories/:slug); if the server can't be
// reached, fall back to the built-in list and filter the published stories here.
async function load(slug: string) {
  const fromApi = await getCategory(slug);
  const live = await getCategories();
  if (fromApi) return { ...fromApi, all: live ?? [fromApi.category] };
  if (live) return null; // the server answered: this category was removed or hidden in Admin
  const category = categoryBySlug(slug);
  if (!category) return null;
  const articles = (await getPublishedArticles()).filter((a) => inCategory(category, a.section, a.sectionLabel));
  return { category, articles, all: CATEGORIES };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = (await getCategory(slug))?.category ?? categoryBySlug(slug);
  return c ? { title: `${c.name} · Punch NextGen`, description: c.desc } : { title: 'Category · Punch NextGen' };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();
  const { category, articles, all } = data;
  const cards = articles.map((a) => ({
    key: a.slug, label: a.sectionLabel, pages: '', title: a.title, blurb: a.dek,
    image: a.image, imagePosition: a.imagePosition, imageFit: a.imageFit, href: `/articles/${a.slug}`,
  }));

  return (
    <>
      <header className="cat-hero" style={{ '--cat-accent': category.accent } as CSSProperties}>
        <div className="wrap">
          <span className="tagbar">Category</span>
          <h1 className="display"><span className="cat-hero-icon"><CategoryIcon name={category.icon} size={34} /></span>{category.name}</h1>
          <p>{category.desc}</p>
          <div className="cat-pills" role="navigation" aria-label="Other categories">
            {all.map((c) => (
              <Link key={c.slug} href={categoryHref(c)} aria-current={c.slug === category.slug ? 'page' : undefined}>{c.name}</Link>
            ))}
          </div>
        </div>
      </header>
      <EditionGrid
        sections={cards}
        text={{
          kicker: category.name, title: 'Latest stories', sub: `${articles.length} ${articles.length === 1 ? 'story' : 'stories'} so far.`,
          emptyTitle: 'No stories here yet', emptyText: 'Our editors are working on it. Check back soon.',
        }}
      />
    </>
  );
}
