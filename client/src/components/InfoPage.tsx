import Link from 'next/link';
import type { ReactNode } from 'react';

// Simple text page (Privacy Policy, Terms of Use…) in the site's style
export default function InfoPage({ kicker, title, updated, children }: { kicker: string; title: string; updated?: string; children: ReactNode }) {
  return (
    <section className="sec info-page">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">{kicker}</span>
            <h1 className="display page-title">{title}</h1>
            {updated && <p className="info-updated">Last updated {updated}</p>}
          </div>
        </div>
        <div className="info-body">{children}</div>
        <p className="info-back"><Link href="/">← Back to the homepage</Link></p>
      </div>
    </section>
  );
}
