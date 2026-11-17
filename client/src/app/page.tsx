import { getCategories, getCategory, getCurrentEdition, getDebate, getEditions, getHomepageHero, getLeaderboard, getAllArticles, getPublishedArticles, getSiteSettings } from '@/lib/api';
import { orderBigNews } from '@/lib/bigNews';
// import { getLeadArticle } from '@/lib/api'; // for the "Read it your way" preview (switched off below)
import Hero from '@/components/Hero';
import EditionGrid from '@/components/EditionGrid';
// import Reader from '@/components/Reader'; // "Read it your way" preview, switched off: stories already do this
import Arcade from '@/components/Arcade';
import VocabFlips from '@/components/VocabFlips';
import LeaderboardSection from '@/components/LeaderboardSection';
import Shelf from '@/components/Shelf';
import StarsSection from '@/components/StarsSection';
import CategoryScene from '@/components/CategoryScene';
import BigNewsSection from '@/components/BigNewsSection';
import { CATEGORIES, inCategory } from '@/lib/categories';

// The homepage stays calm: 5 sections, 3 games, 4 words. Everything else gets its own page.
// These words come first on the homepage ropes; the rest of the edition's words follow (up to 12)
const HOME_VOCAB = ['Electorate', 'Manifesto', 'Épée', 'PVC'];

export default async function HomePage() {
  const [edition, editions, debate, leaderboard, hero, publishedArticles, categories, starsCat, bigNewsCat, site, allArticles] = await Promise.all([
    getCurrentEdition(),
    getEditions(),
    getDebate(),
    getLeaderboard(),
    getHomepageHero(),
    getPublishedArticles(),
    // getLeadArticle(),
    getCategories(),
    getCategory('stars'),
    getCategory('big-news'),
    getSiteSettings(),
    getAllArticles(),
  ]);

  // NextGen Stars: only stories in the NextGen Stars category, newest first
  const starsDef = (categories ?? CATEGORIES).find((c) => c.slug === 'stars');
  const stars = (starsCat?.articles ?? (starsDef ? publishedArticles.filter((a) => inCategory(starsDef, a.section, a.sectionLabel)) : []))
    .slice().sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));

  // The Big News: only stories in the Big News category, in the spots chosen in Admin → Stories (else newest first)
  const newest = <T extends { publishedAt?: string | null }>(list: T[]) => list.slice().sort((a, b) => String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')));
  const bigDef = (categories ?? CATEGORIES).find((c) => c.slug === 'big-news');
  const bigNews = orderBigNews(newest(bigNewsCat?.articles ?? (bigDef ? publishedArticles.filter((a) => inCategory(bigDef, a.section, a.sectionLabel)) : [])), site?.home?.bigNews);

  // Fresh stories: every published story, the 3 cards in the spots chosen in Admin → Stories (else newest first)
  const fresh = orderBigNews(newest(allArticles.length ? allArticles : publishedArticles), site?.home?.fresh);
  const storyCards = fresh.map((article) => ({
    key: article.slug, label: article.sectionLabel, pages: '', title: article.title, blurb: article.dek,
    image: article.image, imagePosition: article.imagePosition, imageFit: article.imageFit, href: `/articles/${article.slug}`,
  }));

  return (
    <>
      <Hero edition={edition} stories={hero.articles} seconds={hero.seconds} total={hero.total} />
      <BigNewsSection stories={bigNews} />
      {/* The categories as a scroll story: the girl, 9 category bubbles, the break, then the 9 cards.
          (The old 3-story scene is in MoneyScene.tsx and the plain grid in CategoryStrip.tsx, both unused now.) */}
      <CategoryScene categories={categories ?? undefined} />
      <EditionGrid sections={storyCards} limit={3} more={{ href: '/articles', label: 'More stories →' }} />
      {/* "Read it your way" story preview: switched off, the full story pages already have Explain like I'm 10, tap-a-word and streaks.
          To bring it back: uncomment getLeadArticle + Reader above, add `lead` back to the list, and this line:
      {lead && <Reader article={lead.article} vocab={lead.vocab} />} */}
      {edition && debate && <Arcade edition={edition} debate={debate} />}
      {edition && <VocabFlips words={[...(edition.vocab ?? [])].sort((a, b) => (HOME_VOCAB.includes(b.word) ? 1 : 0) - (HOME_VOCAB.includes(a.word) ? 1 : 0)).slice(0, 12)} />}
      {(starsCat || starsDef) && <StarsSection stories={stars} />}
      {/* Always shown to visitors (unless switched off in Admin → Settings); empty boards if the API is down */}
      {leaderboard?.showOnHome !== false && <LeaderboardSection data={leaderboard ?? { period: 'all', readers: [], players: [], schools: [] }} />}
      {editions.length > 0 && <Shelf editions={editions} />}
    </>
  );
}
