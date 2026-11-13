import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './school.css';

export const metadata: Metadata = { title: 'School dashboard', robots: { index: false } };

export default function SchoolLayout({ children }: { children: ReactNode }) {
  return <div className="school">{children}</div>;
}
