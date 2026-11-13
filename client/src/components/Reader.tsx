'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ArticlePreview, VocabWord } from '@/lib/types';
import { Icon } from './Icon';
import VocabText from './VocabText';
import ReadingMission from './ReadingMission';

// Homepage preview of the lead story. The full story (and reading tracking) lives at /articles/[slug].
export default function Reader({ article, vocab }: { article: ArticlePreview; vocab: VocabWord[] }) {
  const [eli10, setEli10] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="sec reader" id="read">
      <div className="wrap reader-grid">
        <div className="article">
          <div className="art-body">
            <div className="art-meta">
              <span className="chip">{article.section}</span>
              <span>{article.readMins} min read</span><span>·</span><span>+{article.points} pts</span>
            </div>
            <h3>{article.title}</h3>
            <div className="toggle">
              <button className={`switch${eli10 ? ' on' : ''}`} onClick={() => { setEli10(!eli10); setOpen(null); }} aria-pressed={eli10} aria-label="Explain like I'm 10" />
              Explain like I&apos;m 10
            </div>
            <div className="art-text">
              <VocabText text={eli10 ? article.eli10 : article.body} vocab={vocab} open={open} setOpen={setOpen} />
            </div>
            <Link className="btn dark" href={`/articles/${article.slug}`} style={{ marginTop: 22 }}>Read the full story →</Link>
            <ReadingMission />
          </div>
        </div>
        <div>
          <span className="tagbar">READ IT YOUR WAY</span>
          <h2 className="display" style={{ fontSize: 'clamp(38px,4.4vw,56px)', margin: '16px 0 44px' }}>The paper, but interactive.</h2>
          <div className="feat">
            <div><Icon name="book" /><div><h4>Tap any tricky word</h4><p>Vocab Vault words are underlined in every story. Tap one for the meaning in plain English.</p></div></div>
            <div><Icon name="bulb" /><div><h4>Explain like I&apos;m 10</h4><p>One switch turns any story into the simple version.</p></div></div>
            <div><Icon name="flame" /><div><h4>Streaks &amp; missions</h4><p>Read 3 stories a day, keep your streak, push your school up the leaderboard.</p></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
