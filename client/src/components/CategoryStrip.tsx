import Link from 'next/link';
import type { CSSProperties } from 'react';
import { CATEGORIES, categoryHref, type Category } from '@/lib/categories';
import CategoryIcon from './CategoryIcon';

// "Explore · Everything That Matters to You": 3×3 grid of dark category cards on desktop,
// a swipeable row (one and a bit cards on screen) on tablets and phones. Same as punchnextgen.com.
// The list comes from Admin → Categories; the built-in list is only used if the server can't be reached.
export default function CategoryStrip({ categories = CATEGORIES }: { categories?: Category[] }) {
  if (!categories.length) return null;
  return (
    <section className="sec cat-sec" id="categories" aria-labelledby="cat-heading">
      <div className="wrap">
        <div className="sec-head">
           {/* <div>
            <span className="tagbar">Explore</span>
            <h2 className="display" id="cat-heading">Everything That Matters to You</h2>
          </div> */}
          <div>
            <span className="tagbar">Everything that matter to you</span>
            <h2 className="display" id="cat-heading">The Categories</h2>
          </div>
        </div>
        <div className="cat-strip" role="list">
          {categories.map((c) => (
            <Link key={c.slug} className="cat-card" href={categoryHref(c)} role="listitem" style={{ '--cat-accent': c.accent } as CSSProperties}>
              <span className="cat-card-icon"><CategoryIcon name={c.icon} /></span>
              {/* on hover: the small icon fades out and this big one slides in from the bottom-left corner */}
              <span className="cat-card-big" aria-hidden="true"><CategoryIcon name={c.icon} size={150} /></span>
              <span className="cat-card-name">{c.name}</span>
              <span className="cat-card-desc">{c.desc}</span>
              <span className="cat-card-go" aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
