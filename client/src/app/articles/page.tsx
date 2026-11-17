import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllArticles, getCategories } from '@/lib/api';
import { CATEGORIES, categoryHref } from '@/lib/categories';
import EditionGrid from '@/components/EditionGrid';

// /articles: every published story, newest first ("More stories" on the homepage leads here),
// with the categories on top to jump to one kind of story.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'All stories · Punch NextGen',
  description: 'Every NextGen story, newest first: the big news, money, tech, pop culture, stars and more.',
};

export default async function AllStoriesPage() {
  const [articles, categories] = await Promise.all([getAllArticles(), getCategories()]);
  const cards = articles.map((a) => ({
    key: a.slug, label: a.sectionLabel, pages: '', title: a.title, blurb: a.dek,
    image: a.image, imagePosition: a.imagePosition, imageFit: a.imageFit, href: `/articles/${a.slug}`,
  }));
  return (
    <>
      <header className="cat-hero">
        <div className="wrap">
          <span className="tagbar">From the NextGen team</span>
          <h1 className="display">All stories</h1>
          <p>Every story from the newsroom, newest first. Pick a category to see one kind of story.</p>
          <div className="cat-pills" role="navigation" aria-label="Categories">
            {(categories ?? CATEGORIES).map((c) => <Link key={c.slug} href={categoryHref(c)}>{c.name}</Link>)}
          </div>
        </div>
      </header>
      <EditionGrid
        sections={cards}
        text={{
          kicker: `${cards.length} ${cards.length === 1 ? 'story' : 'stories'}`, title: 'Latest first', sub: '',
          emptyTitle: 'No published stories yet', emptyText: 'Our editors will share the first story here when it is ready.',
        }}
      />
    </>
  );
}
