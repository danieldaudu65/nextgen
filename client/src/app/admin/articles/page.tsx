'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { adminApi, can, type AdminArticleRow, type AdminEditionRow } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminShell';
import HeroLineup, { type HeroData } from '@/components/admin/HeroLineup';
import BigNewsLineup from '@/components/admin/BigNewsLineup';
import StatusBadge from '@/components/admin/StatusBadge';
import AnimatedSelect from '@/components/AnimatedSelect';
import AdminIcon from '@/components/admin/AdminIcon';

const TABS = [
  { key: '', label: 'All' },
  { key: 'review', label: 'Waiting for review' },
  { key: 'draft', label: 'Drafts' },
  { key: 'published', label: 'Published' },
];

const when = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

// useSearchParams needs a Suspense wrapper in Next.js 15
export default function AdminArticlesPage() {
  return <Suspense fallback={<div className="admin-page"><div className="admin-skeleton" /></div>}><AdminArticles /></Suspense>;
}

function AdminArticles() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const [edition, setEdition] = useState(params.get('edition') ?? '');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<AdminArticleRow[] | null>(null);
  const [editions, setEditions] = useState<AdminEditionRow[]>([]);
  const { admin, toast } = useAdmin();
  const editor = can(admin, 'editor');
  const [hero, setHero] = useState<HeroData | null>(null);
  const [tick, setTick] = useState(0);
  const loadHero = () => adminApi.homepageHero().then(setHero).catch(() => setHero(null));
  useEffect(() => { loadHero(); }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { adminApi.editions().then(setEditions).catch(() => {}); }, []);
  useEffect(() => { setEdition(params.get('edition') ?? ''); }, [params]);

  useEffect(() => {
    const t = setTimeout(() => {
      adminApi.articles({ status, edition, q }).then(setRows).catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [status, edition, q, tick]);

  // ★ on a row: put the story in (or take it out of) the homepage hero
  const toggleHome = async (a: AdminArticleRow) => {
    try {
      const r = await adminApi.setHomepage(a.id, !a.homepageFeatured);
      toast(r.message, Boolean(r.homepageFeatured && (!a.image || a.status !== 'published')));
      setTick((t) => t + 1);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not update', true); }
  };

  const volumeName = (slug: string) => {
    const e = editions.find((x) => x.slug === slug);
    if (!e) return slug;
    return e.volumeNumber ? `${e.year ? `${e.year} · ` : ''}Vol ${e.volumeNumber}` : e.month;
  };

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <span className="admin-eyebrow">Newsroom</span>
          <h1 className="display">Stories</h1>
          <p className="muted">{rows ? `${rows.length} stor${rows.length === 1 ? 'y' : 'ies'}${status ? ` · ${TABS.find((t) => t.key === status)?.label.toLowerCase()}` : ''}` : 'Loading…'}</p>
        </div>
        <Link className="btn dark" href="/admin/articles/new"><AdminIcon name="plus" size={18} />New story</Link>
      </header>

      <HeroLineup data={hero} editor={editor} onChange={() => setTick((t) => t + 1)} toast={toast} />
      <BigNewsLineup editor={editor} toast={toast} refresh={tick} />
      <BigNewsLineup kind="fresh" editor={editor} toast={toast} refresh={tick} />

      <div className="admin-toolbar">
        <div className="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} role="tab" aria-selected={status === t.key} className={status === t.key ? 'on' : ''} onClick={() => {
              const query = new URLSearchParams();
              if (t.key) query.set('status', t.key);
              if (edition) query.set('edition', edition);
              router.replace(`/admin/articles${query.size ? `?${query}` : ''}`);
            }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="admin-filters">
          <label className="admin-search"><AdminIcon name="search" size={18} /><input placeholder="Search title or link…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search stories" /></label>
          <div className="admin-filter-select">
            <AnimatedSelect label="Filter stories by year and volume" value={edition} onChange={setEdition} options={[{ value: '', label: 'All editions' }, ...editions.map((e) => ({ value: e.slug, label: `${e.year ? `${e.year} · ` : ''}Volume ${e.volumeNumber ?? 'Special'} · ${e.month}${e.title ? ` · ${e.title}` : ''}` }))]} />
          </div>
        </div>
      </div>

      {rows?.some((a) => a.createdBy === 'Seed data') && <p className="admin-note">Legacy sample stories are kept here for editing, but they are not public. An editor can revise and save one to adopt it into the live newsroom.</p>}

      <div className="admin-card flush">
        {!rows ? <div className="admin-rows-loading"><i /><i /><i /></div> : rows.length === 0 ? (
          <div className="admin-empty">
            <b>No stories here yet</b>
            <p className="muted">{q || edition || status ? 'Try another filter, or start a new story.' : 'Write the first story for this newsroom.'}</p>
            <Link className="btn sm dark" href="/admin/articles/new">+ New story</Link>
          </div>
        ) : (
          <table className="admin-table story-table">
            <thead><tr><th>Story</th><th>Section</th><th>Volume</th><th>Status</th><th>By</th><th>Updated</th>{editor && <th><span className="sr-only">Homepage</span></th>}</tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} onClick={() => router.push(`/admin/articles/${a.id}`)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && router.push(`/admin/articles/${a.id}`)}>
                  <td>
                    <div className="story-cell">
                      <span className="story-thumb">
                        {a.image
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={a.image} alt="" style={a.imagePosition ? { objectPosition: a.imagePosition } : undefined} />
                          : <AdminIcon name="image" size={20} />}
                      </span>
                      <div>
                        <b>{a.title}</b>
                        <small>/articles/{a.slug}{a.homepageFeatured ? <span className="hero-flag"> · ★ Homepage</span> : null}{!a.image ? <span className="no-image"> · needs a picture</span> : null}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="section-chip">{a.sectionLabel}</span></td>
                  <td>{volumeName(a.edition)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>{a.createdBy}</td>
                  <td>{when(a.updatedAt)}</td>
                  {editor && <td className="home-cell">
                    <button className={`home-star${a.homepageFeatured ? ' on' : ''}`} aria-pressed={Boolean(a.homepageFeatured)}
                      aria-label={a.homepageFeatured ? `Remove “${a.title}” from the homepage` : `Show “${a.title}” on the homepage`}
                      title={a.homepageFeatured ? 'In the homepage hero (tap to remove)' : 'Show in the homepage hero'}
                      onClick={(e) => { e.stopPropagation(); toggleHome(a); }} onKeyDown={(e) => e.stopPropagation()}>
                      <AdminIcon name="star" size={18} />
                    </button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
