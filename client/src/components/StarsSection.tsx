/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import type { ArticleCard } from '@/lib/types';
import ShareButton from './ShareButton';

const EMAIL = 'contact@punchnextgen.com';

const StarIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
  </svg>
);

const when = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : '');

// "NextGen Stars" on the homepage (before the leaderboard), like punchnextgen.com.
// Only ONE star shows here: the newest story in the NextGen Stars category is "This week's NextGen Star"
// (the rest are on /category/stars). The call-out at the bottom invites people to nominate someone.
export default function StarsSection({ stories }: { stories: ArticleCard[] }) {
  const [star] = stories;
  return (
    <section className="sec stars-sec" id="stars" aria-labelledby="stars-heading">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">Young. Nigerian. Unstoppable.</span>
            <h2 className="display" id="stars-heading"><span className="stars-ico"><StarIcon size={34} /></span>NextGen Stars</h2>
            <p className="stars-sub">Real stories. Real young Nigerians. Doing extraordinary things.</p>
          </div>
          <Link className="stars-all" href="/category/stars">All Stars →</Link>
        </div>

        {star ? (
          <article className="stars-feature">
            <div className="stars-photo">
              {star.image ? <img src={star.image} alt="" loading="lazy" /> : <span className="stars-photo-empty"><StarIcon size={96} /></span>}
              <span className="stars-badge"><StarIcon size={12} />{star.sectionLabel}</span>
              {star.publishedAt && <span className="stars-date">{when(star.publishedAt)}</span>}
            </div>
            <div className="stars-body">
              <span className="stars-kicker">This week&apos;s NextGen Star</span>
              <h3><Link href={`/articles/${star.slug}`}>{star.title}</Link></h3>
              {star.dek && (
                <blockquote className="stars-quote">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z" /></svg>
                  <p>“{star.dek}”</p>
                  <cite>— {star.author || 'The NextGen Team'}{star.readMins ? ` · ${star.readMins} min read` : ''}</cite>
                </blockquote>
              )}
              <div className="stars-actions">
                <Link className="btn white stars-more" href="/category/stars">More Stars</Link>
                <Link className="btn" href={`/articles/${star.slug}`}>Read Their Story →</Link>
              </div>
              <ShareButton path={`/articles/${star.slug}`} title={star.title}>Inspired? Share their story with someone who needs it.</ShareButton>
            </div>
          </article>
        ) : (
          <div className="stars-empty"><StarIcon size={40} /><p>The first NextGen Star story is coming soon.</p></div>
        )}

        <div className="stars-cta">
          <p>Know a young Nigerian doing something amazing? <b>Tell us their story.</b></p>
          <Link className="btn" href="/nominate"><StarIcon size={16} />Nominate a NextGen Star</Link>
          <small>or email <a href={`mailto:${EMAIL}?subject=${encodeURIComponent('#NextGenStars nomination')}`}>{EMAIL}</a> with #NextGenStars</small>
        </div>
      </div>
    </section>
  );
}
