import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import './admin.css';

export const metadata: Metadata = {
  title: 'Newsroom · Punch NextGen',
  robots: { index: false, follow: false }, // keep the admin out of Google
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
