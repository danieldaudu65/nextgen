'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, can, type DashboardStats } from '@/lib/adminApi';
import { useAdmin } from '@/components/admin/AdminShell';
import AdminIcon from '@/components/admin/AdminIcon';
import { Icon } from '@/components/Icon';
import DashCharts from '@/components/admin/DashCharts';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function AdminDashboard() {
  const { admin } = useAdmin();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [failed, setFailed] = useState(false);
  // Cards (the newsroom view) or Charts (bar charts of reader activity); remembered per browser
  const [view, setView] = useState<'cards' | 'charts'>('cards');

  useEffect(() => { adminApi.dashboard().then(setStats).catch(() => setFailed(true)); }, []);
  useEffect(() => { try { if (localStorage.getItem('ng_dash_view') === 'charts') setView('charts'); } catch { /* private mode */ } }, []);
  const pick = (v: 'cards' | 'charts') => { setView(v); try { localStorage.setItem('ng_dash_view', v); } catch { /* private mode */ } };

  if (failed) return <div className="admin-page"><div className="admin-card admin-empty"><b>Couldn&apos;t load the dashboard</b><p className="muted">Check that the server is running, then refresh.</p></div></div>;
  if (!stats) return <div className="admin-page"><div className="admin-skeleton" /><div className="admin-skeleton short" /></div>;

  const editor = can(admin, 'editor');
  const { draft, review, published } = stats.articles;
  const total = draft + review + published;
  const pipeline = [
    { key: 'draft', label: 'Drafts', hint: 'Being written', value: draft },
    { key: 'review', label: 'In review', hint: editor ? 'Waiting for you' : 'With the editors', value: review },
    { key: 'published', label: 'Published', hint: 'Live on the site', value: published },
  ];
  const maxReads = Math.max(1, ...stats.topStories.map((s) => s.reads));

  return (
    <div className="admin-page">
      {/* Welcome banner */}
      <section className="dash-hero">
        <div className="dash-hero-copy">
          <span className="dash-kicker">{greeting()}, {admin?.name.split(' ')[0]}</span>
          <h1 className="display">Your newsroom</h1>
          <p>
            {stats.currentEdition
              ? <>On the homepage now: <b>{stats.currentEdition.month}</b>{stats.currentEdition.title ? ` · ${stats.currentEdition.title}` : ''}</>
              : 'No volume is on the homepage yet. Set one in Editions.'}
          </p>
          <div className="dash-hero-actions">
            <Link className="btn" href="/admin/articles/new"><AdminIcon name="plus" size={18} />New story</Link>
            {review > 0 && editor
              ? <Link className="btn white" href="/admin/articles?status=review">Review {review} stor{review === 1 ? 'y' : 'ies'}</Link>
              : <Link className="btn white" href="/admin/editions">Manage editions</Link>}
          </div>
        </div>
        {/* stacked 3D cards */}
        <div className="dash-stack" aria-hidden="true">
          <div className="dash-sheet s3"><Icon name="trophy" size={40} /></div>
          <div className="dash-sheet s2"><Icon name="bulb" size={40} /></div>
          <div className="dash-sheet s1">
            <span className="chip">NEXTGEN</span>
            <b>{published}</b>
            <small>stories live</small>
            <Icon name="mega" size={46} />
          </div>
        </div>
      </section>

      <div className="dash-switch" role="tablist" aria-label="Dashboard view">
        <button role="tab" aria-selected={view === 'cards'} className={view === 'cards' ? 'on' : ''} onClick={() => pick('cards')}><AdminIcon name="dashboard" size={17} />Cards</button>
        <button role="tab" aria-selected={view === 'charts'} className={view === 'charts' ? 'on' : ''} onClick={() => pick('charts')}><AdminIcon name="chart" size={17} />Charts</button>
      </div>

      {view === 'charts' ? <DashCharts /> : <>
      {/* Draft → review → published */}
      <section className="dash-pipeline" aria-label="Story pipeline">
        {pipeline.map((p, i) => (
          <Link key={p.key} href={`/admin/articles?status=${p.key}`} className={`pipe pipe-${p.key}${p.key === 'review' && review > 0 && editor ? ' hot' : ''}`}>
            <span className="pipe-step">{i + 1}</span>
            <div>
              <b>{p.value.toLocaleString('en-NG')}</b>
              <span>{p.label}</span>
              <small>{p.hint}</small>
            </div>
            <i className="pipe-bar"><i style={{ width: `${total ? Math.max(6, (p.value / total) * 100) : 0}%` }} /></i>
          </Link>
        ))}
      </section>

      <div className="dash-grid">
        <section className="admin-card dash-top">
          <div className="card-head"><h2>Most-read this week</h2><span className="muted">{stats.readsThisWeek.toLocaleString('en-NG')} reads</span></div>
          {stats.topStories.length ? (
            <ol className="dash-rank">
              {stats.topStories.map((s, i) => (
                <li key={s.slug}>
                  <span className="rank-no">{i + 1}</span>
                  <div>
                    <span className="rank-title">{s.title ?? s.slug}</span>
                    <i className="rank-bar"><i style={{ width: `${(s.reads / maxReads) * 100}%` }} /></i>
                  </div>
                  <b>{s.reads}</b>
                </li>
              ))}
            </ol>
          ) : <p className="admin-empty-line">No completed reads yet this week.</p>}
        </section>

        <div className="dash-side">
          <div className="stat">
            <span className="stat-ico"><Icon name="book" size={34} /></span>
            <div><b>{stats.students.toLocaleString('en-NG')}</b><span>Students</span></div>
            <small className="up">+{stats.newStudentsThisWeek} this week</small>
          </div>
          <Link className="stat" href="/admin/schools">
            <span className="stat-ico"><Icon name="star" size={34} /></span>
            <div><b>{stats.schools.toLocaleString('en-NG')}</b><span>Schools</span></div>
            <small className={stats.unverifiedSchools ? 'warn' : 'up'}>{stats.unverifiedSchools ? `${stats.unverifiedSchools} to verify` : 'All verified'}</small>
          </Link>
          <div className="stat">
            <span className="stat-ico"><Icon name="flame" size={34} /></span>
            <div><b>{stats.readsThisWeek.toLocaleString('en-NG')}</b><span>Stories read this week</span></div>
          </div>
        </div>
      </div>
      </>}
    </div>
  );
}
