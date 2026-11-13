'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi, can, type AdminUser } from '@/lib/adminApi';
import { ThemeToggle } from '../ThemeToggle';
import AdminIcon, { type AdminIconName } from './AdminIcon';
import { Logo } from '../Logo';

type Ctx = { admin: AdminUser | null; setAdmin: (a: AdminUser | null) => void; toast: (msg: string, bad?: boolean) => void };
const AdminCtx = createContext<Ctx | null>(null);

export const useAdmin = () => {
  const c = useContext(AdminCtx);
  if (!c) throw new Error('useAdmin must be used inside <AdminShell>');
  return c;
};

const NAV: { href: string; label: string; icon: AdminIconName; min: 'writer' | 'superadmin' }[] = [
  { href: '/admin', label: 'Dashboard', icon: 'dashboard', min: 'writer' },
  { href: '/admin/articles', label: 'Stories', icon: 'stories', min: 'writer' },
  { href: '/admin/editions', label: 'Editions', icon: 'editions', min: 'writer' },
  { href: '/admin/categories', label: 'Categories', icon: 'grid', min: 'writer' },
  { href: '/admin/schools', label: 'Schools', icon: 'schools', min: 'writer' },
  { href: '/admin/nominations', label: 'Nominations', icon: 'star', min: 'writer' },
  { href: '/admin/team', label: 'Team', icon: 'team', min: 'superadmin' },
  { href: '/admin/settings', label: 'Settings', icon: 'settings', min: 'writer' },
];

const ROLE_LABEL = { writer: 'Writer', editor: 'Editor', superadmin: 'Superadmin' } as const;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

// Wraps every /admin page: checks the login, shows the sidebar, gives pages a toast()
export default function AdminShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [menu, setMenu] = useState(false); // phone menu
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isLogin = path === '/admin/login';

  useEffect(() => {
    adminApi.me()
      .then(setAdmin)
      .catch(() => { setAdmin(null); if (!isLogin) router.replace('/admin/login'); })
      .finally(() => setChecked(true));
  }, [isLogin, router]);

  // close the phone menu when the page changes
  useEffect(() => { setMenu(false); }, [path]);

  const toast = useCallback((text: string, bad?: boolean) => {
    setMsg({ text, bad });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2600);
  }, []);

  const logout = async () => {
    await adminApi.logout().catch(() => {});
    setAdmin(null);
    router.replace('/admin/login');
  };

  const ctx = { admin, setAdmin, toast };
  const toastEl = (
    <div className={`admin-toast${msg ? ' show' : ''}${msg?.bad ? ' bad' : ''}`} role="status" aria-live="polite">
      {msg && <><span className="admin-toast-ico"><AdminIcon name={msg.bad ? 'warn' : 'check'} size={16} /></span>{msg.text}</>}
    </div>
  );

  if (isLogin) return <AdminCtx.Provider value={ctx}>{children}{toastEl}</AdminCtx.Provider>;
  if (!checked || !admin) return <div className="admin-loading"><span className="admin-spinner" />Checking your login…</div>;

  return (
    <AdminCtx.Provider value={ctx}>
      <div className={`admin${menu ? ' menu-open' : ''}`}>
        {/* Phone top bar */}
        <header className="admin-topbar">
          <Logo onDark href="/admin" size="sm" />
          <span className="admin-tag">NEWSROOM</span>
          <button className="admin-icon-btn" onClick={() => setMenu(!menu)} aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu}>
            <AdminIcon name={menu ? 'close' : 'menu'} />
          </button>
        </header>
        <div className="admin-scrim" onClick={() => setMenu(false)} aria-hidden="true" />

        <aside className="admin-side">
          <div className="admin-brand">
            <Logo onDark href="/admin" />
            <span className="admin-tag">NEWSROOM</span>
          </div>

          <Link href="/admin/articles/new" className="admin-new"><AdminIcon name="plus" size={18} />New story</Link>

          <div className="admin-nav" role="navigation" aria-label="Admin">
            {NAV.filter((n) => can(admin, n.min)).map((n) => {
              const on = n.href === '/admin' ? path === '/admin' : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                  <span className="admin-nav-ico"><AdminIcon name={n.icon} size={18} /></span>{n.label}
                </Link>
              );
            })}
          </div>

          <div className="admin-me">
            <div className="admin-me-card">
              <span className={`admin-avatar role-${admin.role}`}>{initials(admin.name)}</span>
              <div><b>{admin.name}</b><span className={`role role-${admin.role}`}>{ROLE_LABEL[admin.role]}</span></div>
            </div>
            <div className="admin-me-row">
              <ThemeToggle />
              <a className="admin-icon-btn" href="/" target="_blank" rel="noreferrer" title="View the site" aria-label="View the site"><AdminIcon name="external" size={18} /></a>
              <button className="admin-icon-btn" onClick={logout} title="Log out" aria-label="Log out"><AdminIcon name="logout" size={18} /></button>
            </div>
          </div>
        </aside>
        <main className="admin-main">{children}</main>
      </div>
      {toastEl}
    </AdminCtx.Provider>
  );
}
