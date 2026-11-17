import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentEdition, getDebate, getEditions } from '@/lib/api';
import WorldPage from '@/components/world/WorldPage';
import './arcade.css';

// The games come from the current edition, so build this page on request (always fresh)
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'NextGen World · Tap in. Level up.',
  description: "Play this edition's 7 levels on a 3D island. Win stars and points, level up, and beat the Boss to open the next island.",
};

type Props = { searchParams: Promise<{ level?: string }> };

export default async function ArcadePage({ searchParams }: Props){
  const [{ level }, edition, debate, editions] = await Promise.all([searchParams, getCurrentEdition(), getDebate(), getEditions()]);

  if (!edition) {
    return (
      <section className="sec">
        <div className="wrap">
          <h1 className="page-title">The island is loading…</h1>
          <p style={{ margin: '12px 0 20px' }}>We couldn&apos;t load this edition&apos;s games. Try again in a minute.</p>
          <Link className="btn" href="/">Back home</Link>
        </div>
      </section>
    );
  }

  return <WorldPage edition={edition} debate={debate} editions={editions} startLevel={Number(level) || undefined} />;
}
