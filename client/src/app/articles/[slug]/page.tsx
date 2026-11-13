import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getArticle } from '@/lib/api';
import ArticleView from '@/components/article/ArticleView';

// Every story gets its own page: /articles/whats-an-election, /articles/the-10k-money-mystery, ...
// The story comes from the API (GET /articles/:slug), so new stories need no new code.

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getArticle(slug);
  if (!data) return { title: 'Story not found · Punch NextGen' };
  const { article } = data;
  // Share preview: the story's own picture, or the NextGen share image if it has none
  const image = article.image
    ? { url: article.image, alt: article.title }
    : { url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'Punch NextGen' };
  return {
    title: `${article.title} · Punch NextGen`,
    description: article.dek,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: 'article',
      siteName: 'Punch NextGen',
      title: article.title,
      description: article.dek,
      url: `/articles/${article.slug}`,
      images: [image],
      ...(article.publishedAt ? { publishedTime: article.publishedAt } : {}),
    },
    twitter: { card: 'summary_large_image', title: article.title, description: article.dek, images: [image.url] },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const data = await getArticle(slug);
  if (!data) notFound();
  return <ArticleView data={data} />;
}
