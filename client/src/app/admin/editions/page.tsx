'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { adminApi, can, type AdminEditionRow } from '@/lib/adminApi';
import { ApiError } from '@/lib/api';
import { useAdmin } from '@/components/admin/AdminShell';
import AnimatedSelect from '@/components/AnimatedSelect';

const VOLUMES = [1, 2, 3, 4] as const;
const MONTHS = [
  ['january', 'January'], ['february', 'February'], ['march', 'March'], ['april', 'April'],
  ['may', 'May'], ['june', 'June'], ['july', 'July'], ['august', 'August'],
  ['september', 'September'], ['october', 'October'], ['november', 'November'], ['december', 'December'],
] as const;
const monthTitle = (month?: string) => MONTHS.find(([value]) => value === month)?.[1] ?? 'Special issue';
const STATUS_LABEL = { current: 'On homepage', upcoming: 'Coming soon', archive: 'Archive' } as const;
const yearOf = (e: AdminEditionRow) => {
  const parsed = Number(e.month.match(/20\d{2}/)?.[0]);
  return e.year ?? (Number.isFinite(parsed) ? parsed : 0);
};

// The little 3D book on each volume card: the cover picture, or a coloured cover with the volume number
function VolumeBook({ number, issue }: { number: number; issue?: AdminEditionRow }) {
  return (
    <div className={`volume-book tone-${number}${issue ? '' : ' ghost'}`} aria-hidden="true">
      <div className="volume-book-inner">
        <span className="volume-book-spine" />
        <div className="volume-book-face">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {issue?.cover ? <img src={issue.cover} alt="" /> : <><small>NEXTGEN</small><b>{number}</b><span>{issue ? monthTitle(issue.issueMonth).slice(0, 3).toUpperCase() : 'EMPTY'}</span></>}
        </div>
      </div>
    </div>
  );
}

export default function AdminEditions() {
  const { admin, toast } = useAdmin();
  const [rows, setRows] = useState<AdminEditionRow[] | null>(null);
  const [form, setForm] = useState({ year: String(new Date().getFullYear()), volumeNumber: '1', issueMonth: '', title: '' });
  const formRef = useRef<HTMLFormElement>(null);
  const load = () => adminApi.editions().then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const years = useMemo(() => {
    const grouped: Record<number, AdminEditionRow[]> = {};
    (rows ?? []).forEach((e) => {
      const y = yearOf(e);
      if (!y) return;
      (grouped[y] ??= []).push(e);
    });
    return Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a));
  }, [rows]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const year = Number(form.year);
    const volumeNumber = Number(form.volumeNumber);
    const issueMonth = form.issueMonth;
    const month = MONTHS.find(([value]) => value === issueMonth)?.[1];
    if (!VOLUMES.includes(volumeNumber as typeof VOLUMES[number]) || !month || (form.year && (!Number.isInteger(year) || year < 2000 || year > 2200))) return toast('Choose a release month and a valid year if known', true);
    const slug = `${form.year ? `${year}-` : ''}${issueMonth}-vol-${volumeNumber}${form.year ? '' : `-${Date.now()}`}`;
    const monthLabel = `${month}${form.year ? ` ${year}` : ''}`;
    try {
      await adminApi.createEdition({
        slug, title: form.title.trim(), month: monthLabel,
        ...(form.year ? { year } : {}), volumeNumber: volumeNumber as 1 | 2 | 3 | 4, issueMonth: issueMonth as NonNullable<AdminEditionRow['issueMonth']>, volume: `Volume ${volumeNumber}`, status: 'upcoming',
      });
      toast(`${monthLabel} · Volume ${volumeNumber} created`);
      setForm((f) => ({ ...f, title: '', issueMonth: '' }));
      load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create volume', true);
    }
  };

  const chooseSlot = (year: number, volumeNumber: number) => {
    setForm((f) => ({ ...f, year: String(year), volumeNumber: String(volumeNumber), issueMonth: '' }));
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="admin-page">
      <header className="admin-head"><div><span className="admin-eyebrow">Publishing</span><h1 className="display">Year editions</h1><p className="muted">Create up to four volumes per year and choose a release month for each one.</p></div>{can(admin, 'editor') && <button className="btn dark" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>+ New volume</button>}</header>

      {!rows ? <p className="muted">Loading editions…</p> : rows.length === 0 ? <div className="admin-card"><h2>No editions yet</h2><p className="muted">Create a volume to start an edition.</p></div> : years.map(([yearText, issues]) => {
        const year = Number(yearText);
        const quarterly = VOLUMES.map((number) => ({ number, issue: issues.find((e) => e.volumeNumber === number) }));
        const legacy = issues.filter((e) => !e.volumeNumber || !VOLUMES.includes(e.volumeNumber as typeof VOLUMES[number]));
        return <section className="year-edition" key={year}>
          <header><div><span className="tagbar">YEAR EDITION</span><h2 className="display">{year}</h2></div><span>{issues.length} volume{issues.length === 1 ? '' : 's'}</span></header>
          <div className="volume-grid">
            {quarterly.map(({ number, issue }) => <article className={`volume-card${issue ? '' : ' empty'}${issue?.status === 'current' ? ' is-current' : ''}`} key={number}>
              <VolumeBook number={number} issue={issue} />
              <div className="volume-card-top"><span>VOLUME {number}</span><span>{issue ? monthTitle(issue.issueMonth).toUpperCase() : 'MONTH NOT SET'}</span></div>
              {issue ? <>
                <h3>{issue.title || `${monthTitle(issue.issueMonth)} volume`}</h3>
                <p>{issue.published} published · {issue.stories} stories</p>
                <span className={`status ed-${issue.status}`}>{STATUS_LABEL[issue.status]}</span>
                <div className="volume-actions"><Link className="btn sm white" href={`/admin/articles?edition=${issue.slug}`}>Stories</Link>{can(admin, 'editor') && <Link className="btn sm white" href={`/admin/editions/${issue.slug}`}>Manage volume</Link>}</div>
              </> : <>
                <h3>Not created yet</h3><p>Set up stories and categories for this volume.</p>
                {can(admin, 'editor') && <button className="btn sm" onClick={() => chooseSlot(year, number)}>+ Add Volume {number}</button>}
              </>}
            </article>)}
          </div>
          {legacy.length > 0 && <div className="legacy-issues"><b>Existing special issues</b>{legacy.map((issue) => <div key={issue.slug}>
            <span>{issue.month} · {issue.title || 'Untitled issue'} <small>{issue.volume || 'Legacy volume'}</small></span>
            <span className={`status ed-${issue.status}`}>{STATUS_LABEL[issue.status]}</span>
            <div><Link className="btn sm white" href={`/admin/articles?edition=${issue.slug}`}>Stories</Link>{can(admin, 'editor') && <> <Link className="btn sm white" href={`/admin/editions/${issue.slug}`}>Manage</Link></>}</div>
          </div>)}</div>}
        </section>;
      })}

      {rows?.some((e) => !yearOf(e)) && <section className="year-edition">
        <header><div><span className="tagbar">NO YEAR SET</span><h2 className="display">Other volumes</h2></div></header>
        <div className="volume-grid">{rows.filter((e) => !yearOf(e)).map((issue) => <article className="volume-card" key={issue.slug}>
          <div className="volume-card-top"><span>{issue.volume || `VOLUME ${issue.volumeNumber ?? '—'}`}</span><span>{issue.month}</span></div>
          <h3>{issue.title || 'Untitled issue'}</h3><p>{issue.published} published · {issue.stories} stories</p>
          <span className={`status ed-${issue.status}`}>{STATUS_LABEL[issue.status]}</span>
          <div className="volume-actions"><Link className="btn sm white" href={`/admin/articles?edition=${issue.slug}`}>Stories</Link>{can(admin, 'editor') && <Link className="btn sm white" href={`/admin/editions/${issue.slug}`}>Manage volume</Link>}</div>
        </article>)}</div>
      </section>}

      {can(admin, 'editor') && <form ref={formRef} className="admin-card form-grid volume-create" onSubmit={create}>
        <h2>Create a volume</h2>
        <label>Year edition (optional)<input type="number" min="2000" max="2200" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Leave blank if unknown" /></label>
        <label>Volume<AnimatedSelect label="Volume number" value={form.volumeNumber} onChange={(volumeNumber) => setForm({ ...form, volumeNumber })} options={VOLUMES.map((number) => ({ value: String(number), label: `Volume ${number}` }))} /></label>
        <label>Release month<AnimatedSelect label="Release month" value={form.issueMonth} onChange={(issueMonth) => setForm({ ...form, issueMonth })} options={MONTHS.map(([value, label]) => ({ value, label }))} placeholder="Choose any month" /></label>
        <label>Volume title (optional)<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Leave blank if untitled" /></label>
        <p className="muted span2">Choose the release month for this volume. Titles and years can be left blank until they’re known. Categories are set inside each volume.</p>
        <button className="btn dark" type="submit">Create volume</button>
      </form>}
    </div>
  );
}
