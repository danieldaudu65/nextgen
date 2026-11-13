'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { schoolApi, type SchoolInfo } from '@/lib/schoolApi';
import { ApiError } from '@/lib/api';
import SchoolOverview from '@/components/school/SchoolOverview';
import SchoolStudents from '@/components/school/SchoolStudents';
import SchoolCodes from '@/components/school/SchoolCodes';
import SchoolPlan from '@/components/school/SchoolPlan';
import SchoolProfile from '@/components/school/SchoolProfile';

const TABS = [
  { key: 'overview', label: 'Overview', icon: '◎' },
  { key: 'students', label: 'Students', icon: '☺' },
  { key: 'codes', label: 'Codes', icon: '⌗' },
  { key: 'plan', label: 'Plan', icon: '★' },
  { key: 'profile', label: 'Profile', icon: '✎' },
] as const;
type Tab = (typeof TABS)[number]['key'];

// The school dashboard: overview, students, codes, plan
export default function SchoolDashboard() {
  const router = useRouter();
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);

  const refresh = useCallback(() => schoolApi.me().then(setSchool).catch((e) => { if (e instanceof ApiError && e.status === 401) router.push('/school/login'); }), [router]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { const h = location.hash.replace('#', '') as Tab; if (TABS.some((t) => t.key === h)) setTab(h); }, []);

  const say = useCallback((text: string, bad = false) => { setToast({ text, bad }); setTimeout(() => setToast(null), 2600); }, []);
  const go = (t: Tab) => { setTab(t); history.replaceState(null, '', `#${t}`); };
  const logout = async () => { await schoolApi.logout().catch(() => null); router.push('/school/login'); };

  if (!school) return <div className="sch-loading"><div className="spinner" /></div>;

  return (
    <div className="sch-app">
      <header className="sch-top">
        <Logo />
        <div className="sch-name"><b>{school.name}</b><small>{school.city ?? ''}{school.verified ? ' · ✓ Verified' : ''}</small></div>
        <div className="sch-top-r">
          <ThemeToggle />
          <button className="sch-ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <nav className="sch-tabs-main" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'on' : ''} onClick={() => go(t.key)}>
            {tab === t.key && <motion.span layoutId="sch-tab" className="pill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span><i aria-hidden="true">{t.icon}</i>{t.label}</span>
          </button>
        ))}
      </nav>

      {!school.plan.active && tab !== 'plan' && (
        <motion.div className="sch-banner" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <span>🎟️ Pick a plan to create codes and give your students full access.</span>
          <button className="sch-btn sm" onClick={() => go('plan')}>See plans</button>
        </motion.div>
      )}

      <main className="sch-main">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 18, rotateX: 6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}>
            {tab === 'overview' && <SchoolOverview school={school} go={go} />}
            {tab === 'students' && <SchoolStudents say={say} onChange={refresh} />}
            {tab === 'codes' && <SchoolCodes school={school} say={say} onChange={refresh} go={go} />}
            {tab === 'plan' && <SchoolPlan school={school} say={say} />}
            {tab === 'profile' && <SchoolProfile school={school} say={say} onSaved={refresh} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className={`sch-toast${toast ? ' show' : ''}${toast?.bad ? ' bad' : ''}`} role="status">{toast?.text}</div>
    </div>
  );
}
