'use client';

/* eslint-disable @next/next/no-img-element */
import { accentVars } from '@/lib/storyAccent';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { ArticlePage } from '@/lib/types';
import { Icon } from '../Icon';
import ReadingMission from '../ReadingMission';
import ArticleBody from './ArticleBody';
import SmartImage, { FramedImage } from '../SmartImage';
import { PhotoCollage } from './LayoutBlocks';
import ReadGate from './ReadGate';

const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ArticleView({ data }: { data: ArticlePage }) {
  const { article, edition, vocab, related } = data;
  const [eli10, setEli10] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [depth, setDepth] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  const blocks = eli10 && article.eli10.length ? article.eli10 : article.body;

  return (
    <>
      <div className="read-progress" aria-hidden="true"><i style={{ width: `${Math.round(depth * 100)}%` }} /></div>
      {/* Reading time → points → the story question (see ReadGate.tsx) */}
      <ReadGate bodyRef={bodyRef} article={article} onDepth={setDepth} />

      <article className="story" style={accentVars(article.accent)}>
        <header className="story-head wrap">
          <div className="crumbs" role="navigation" aria-label="Breadcrumb">
            <Link href="/">Home</Link><span>/</span>
            {edition && <><Link href="/#edition">{edition.month} edition</Link><span>/</span></>}
            <span>{article.sectionLabel}</span>
          </div>
          <span className="chip">{article.sectionLabel}</span>
          <h1 className="display">{article.title}</h1>
          {article.dek && <p className="dek">{article.dek}</p>}
          <div className="story-meta">
            <span>By {article.author ?? 'NextGen Team'}</span><span>·</span>
            <span>{dateFmt(article.publishedAt)}</span><span>·</span>
            <span>{article.readMins} min read</span><span>·</span>
            <span className="pts-pill">+{article.points} pts</span>
            {article.pages && <><span>·</span><span>In print: {article.pages}</span></>}
          </div>
        </header>

        {article.image && (
          <div className="wrap">
            <div className="story-hero">
              <SmartImage src={article.image} position={article.imagePosition} fit={article.imageFit} tolerance={0.4} />
            </div>
          </div>
        )}

        <div className="wrap story-grid">
          <div className="story-main" ref={bodyRef}>
            <div className="toggle">
              <button className={`switch${eli10 ? ' on' : ''}`} onClick={() => { setEli10(!eli10); setOpen(null); }} aria-pressed={eli10} aria-label="Explain like I'm 10" />
              Explain like I&apos;m 10
            </div>
            <ArticleBody blocks={blocks} vocab={vocab} open={open} setOpen={setOpen} />

            {/* Gallery: 2 pictures overlap like the magazine; otherwise each picture shows whole with its caption */}
            {!eli10 && article.gallery?.length === 2 ? (
              <PhotoCollage images={article.gallery.map((g) => g.image)} caption={article.gallery.map((g) => g.caption).filter(Boolean).join(' · ') || undefined} />
            ) : !eli10 && article.gallery?.length ? <div className="story-gallery">{article.gallery.map((item, i) => <figure key={`${item.image}-${i}`}>
              <FramedImage src={item.image} alt={item.caption || ''} />
              {item.caption && <figcaption>{item.caption}</figcaption>}
            </figure>)}</div> : null}

            {article.game && (
              <Link className="story-game" href={article.game.href}>
                <Icon name="puzzle" />
                <div><small>FROM THIS STORY</small><b>{article.game.label}</b></div>
                <span>→</span>
              </Link>
            )}
            <ReadingMission />
          </div>

          <aside className="story-side">
            <div className="side-card">
              <h4>Words in this story</h4>
              <p>Tap the underlined words while you read.</p>
              <ul>
                {vocab
                  .filter((v) => [article.body, article.eli10].flat().some((b) => b.toLowerCase().includes(`[[${v.word.toLowerCase()}]]`) || v.aliases?.some((a) => b.toLowerCase().includes(`[[${a}]]`))))
                  .map((v) => <li key={v.word}><b>{v.word}</b>{v.nextgen}</li>)}
              </ul>
            </div>
            {article.tags?.length ? (
              <div className="tags">{article.tags.map((t) => <span key={t}>#{t}</span>)}</div>
            ) : null}
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section className="sec related">
          <div className="wrap">
            <div className="sec-head">
              <div><span className="tagbar">KEEP READING</span><h2 className="display">More from this volume.</h2></div>
            </div>
            <div className="related-grid">
              {related.map((r) => (
                <Link key={r.slug} className="card" href={`/articles/${r.slug}`}>
                  <div className="top"><span className="chip">{r.sectionLabel}</span><span className="pg">{r.readMins} min</span></div>
                  <h3>{r.title}</h3>
                  {r.dek && <p>{r.dek}</p>}
                  {r.image && <div className="art"><SmartImage src={r.image} position={r.imagePosition} fit={r.imageFit} /></div>}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
