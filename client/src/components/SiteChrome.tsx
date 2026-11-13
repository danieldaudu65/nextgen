'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PointsProvider } from './PointsProvider';
import Nav from './Nav';
import Footer from './Footer';

// Public pages get the menu, footer and student session.
// /admin and /school pages skip them (they have their own shells: app/admin/layout.tsx, app/school/layout.tsx).
export default function SiteChrome({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/';
  // /school = the school dashboard (its own shell). /schools (Showcase, Guide) are public pages.
  const dashboard = path === '/school' || path.startsWith('/school/');
  if (path.startsWith('/admin') || dashboard) return <>{children}</>;
  return (
    <PointsProvider>
      <Nav />
      <main>{children}</main>
      <Footer />
    </PointsProvider>
  );
}
