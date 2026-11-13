'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { adminApi, type HeroRow, type HeroState } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import AdminIcon from './AdminIcon';

const STATE: Record<HeroState, string> = {
  live: 'On the homepage',
  waiting: 'Waiting for a free spot',
  'no-picture': 'Needs a picture',
  'not-published': 'Shows once published',
};

export interface HeroData { max: number; seconds: number; live: number; articles: HeroRow[] }

// Stories → top card: which stories rotate in the homepage hero right now, in order.
export default function HeroLineup({ data, editor, onChange, toast }: {
  data: HeroData | null;
  editor: boolean;
  onChange: () => void;
  toast: (msg: string, bad?: boolean) => void;
}) {
  if (!data) return null;
  const remove = async (id: string) => {
    try { toast((await adminApi.setHomepage(id, false)).message); onChange(); } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not update', true); }
  };
  let slot = 0;
  return (
    <section className="admin-card hero-lineup">
      <div className="card-head">
        <div>
          <h2>Homepage hero</h2>
          <p className="muted">
            <b>{data.live} of {data.max}</b> spots showing · each story stays {data.seconds}s ·{' '}
            <Link href="/admin/settings#homepage">change in Settings</Link>
          </p>
        </div>
        <span className="hl-meter" aria-hidden="true">{Array.from({ length: data.max }).map((_, i) => <i key={i} className={i < data.live ? 'on' : ''} />)}</span>
      </div>
      {data.articles.length === 0 ? (
        <p className="muted hl-empty">No stories yet. Tap the <AdminIcon name="star" size={14} /> on a published story with a picture, or switch on <b>Show in the homepage hero</b> in the story editor.</p>
      ) : (
        <ol className="hl-list">
          {data.articles.map((a) => {
            const n = a.state === 'live' ? ++slot : null;
            return (
              <li key={a.id} className={`hl-${a.state}`}>
                <span className="hl-no">{n ? String(n).padStart(2, '0') : '–'}</span>
                <span className="hl-thumb">{a.image ? <img src={a.image} alt="" /> : <AdminIcon name="image" size={18} />}</span>
                <span className="hl-main"><Link href={`/admin/articles/${a.id}`}><b>{a.title}</b></Link><small>{a.sectionLabel} · {STATE[a.state]}</small></span>
                {editor && <button className="btn sm white" onClick={() => remove(a.id)}>Remove</button>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
