import { getCategories, getCurrentEdition, getDebate, getEditions, getHomepageHero, getLeadArticle, getLeaderboard, getPublishedArticles } from '@/lib/api';
import Hero from '@/components/Hero';
import EditionGrid from '@/components/EditionGrid';
import Reader from '@/components/Reader';
import Arcade from '@/components/Arcade';
import VocabFlips from '@/components/VocabFlips';
import LeaderboardSection from '@/components/LeaderboardSection';
import Shelf from '@/components/Shelf';
import CategoryStrip from '@/components/CategoryStrip';

// The homepage stays calm: 5 sections, 3 games, 4 words. Everything else gets its own page.
const HOME_VOCAB = ['Electorate', 'Manifesto', 'Épée', 'PVC'];

export default async function HomePage() {
  const [edition, editions, debate, leaderboard, hero, publishedArticles, lead, categories] = await Promise.all([
    getCurrentEdition(),
    getEditions(),
    getDebate(),
    getLeaderboard(),
    getHomepageHero(),
    getPublishedArticles(),
    getLeadArticle(),
    getCategories(),
  ]);

  const storyCards = publishedArticles.map((article) => ({
    key: article.slug, label: article.sectionLabel, pages: '', title: article.title, blurb: article.dek,
    image: article.image, imagePosition: article.imagePosition, imageFit: article.imageFit, href: `/articles/${article.slug}`,
  }));

  return (
    <>
      <Hero edition={edition} stories={hero.articles} seconds={hero.seconds} total={hero.total} />
      <CategoryStrip categories={categories ?? undefined} />
      <EditionGrid sections={storyCards} />
      {lead && <Reader article={lead.article} vocab={lead.vocab} />}
      {edition && debate && <Arcade edition={edition} debate={debate} />}
      {edition && <VocabFlips words={(edition.vocab ?? []).filter((v) => HOME_VOCAB.includes(v.word))} />}
      {/* Always shown to visitors (unless switched off in Admin → Settings); empty boards if the API is down */}
      {leaderboard?.showOnHome !== false && <LeaderboardSection data={leaderboard ?? { period: 'all', readers: [], players: [], schools: [] }} />}
      {editions.length > 0 && <Shelf editions={editions} />}
    </>
  );
}
