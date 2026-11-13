import { API_URL, ApiError } from './api';
import type { SchoolPlan } from './types';

// School dashboard API (its own login cookie: "school_token")

export interface SchoolInfo {
  id: string; name: string; city?: string; state?: string; verified: boolean; points: number; studentCount: number;
  plan: { id: string | null; seats: number; until: string | null; active: boolean };
  codes: { issued: number; used: number; unused: number; left: number };
  account?: { name: string; email: string };
  profile?: SchoolProfile;
}
export interface SchoolProfile { logo: string | null; motto: string; about: string; website: string; founded: number | null; schoolType: string | null; showOnShowcase: boolean }
export interface SchoolOverview {
  school: SchoolInfo; nationalRank: number; activeThisWeek: number;
  chart: { day: string; reading: number; games: number }[];
  topStudents: { id: string; name: string; handle: string; className?: string; points: number; streak: number; color?: string }[];
  classes: { className: string; students: number; points: number; average: number }[];
  topStories: { slug: string; title?: string; reads: number }[];
  quiz: { answered: number; correct: number };
}
export interface SchoolStudent { id: string; name: string; handle: string; className?: string; points: number; streak: number; lastActiveDay?: string; color?: string; code: string | null; deviceLocked: boolean; joinedAt: string }
export interface SchoolCode { id: string; code: string; status: 'unused' | 'used' | 'revoked'; label?: string; className?: string; student?: { name: string; handle: string } | null; usedAt?: string; createdAt?: string }
export interface SchoolPayment { reference: string; plan: string; seats: number; days: number; amount: number; status: 'pending' | 'paid' | 'failed'; provider: string; paidAt?: string; createdAt: string }

async function call<T>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) throw new ApiError(res.status, data.message ?? 'Request failed', data.code);
  return data as T;
}

export const schoolApi = {
  register: (body: { schoolName: string; city: string; state: string; name: string; email: string; phone: string; password: string }) =>
    call<{ school: SchoolInfo; message: string }>('/school_auth/register', 'POST', body),
  login: (email: string, password: string) => call<{ school: SchoolInfo }>('/school_auth/login', 'POST', { email, password }),
  logout: () => call<{ success: boolean }>('/school_auth/logout', 'POST', {}),
  me: () => call<{ school: SchoolInfo }>('/school_auth/me').then((d) => d.school),

  overview: () => call<SchoolOverview>('/school_dashboard/overview'),
  students: (q = '', className = '') => call<{ students: SchoolStudent[] }>(`/school_dashboard/students?q=${encodeURIComponent(q)}&className=${encodeURIComponent(className)}`).then((d) => d.students),
  unlock: (id: string) => call<{ message: string }>(`/school_dashboard/students/${id}/unlock`, 'POST', {}),
  remove: (id: string) => call<{ message: string }>(`/school_dashboard/students/${id}/remove`, 'POST', {}),
  codes: (status = '') => call<{ codes: SchoolCode[]; joinBase: string }>(`/school_dashboard/codes${status ? `?status=${status}` : ''}`),
  makeCodes: (body: { count?: number; className?: string; labels?: string }) => call<{ codes: SchoolCode[]; message: string }>('/school_dashboard/codes', 'POST', body),
  revoke: (id: string) => call<{ message: string }>(`/school_dashboard/codes/${id}/revoke`, 'POST', {}),
  plans: () => call<{ plans: SchoolPlan[]; demo: boolean }>('/school_dashboard/plans'),
  pay: (planId: string) => call<{ url: string; demo: boolean }>('/school_dashboard/pay', 'POST', { planId }),
  payments: () => call<{ payments: SchoolPayment[] }>('/school_dashboard/payments').then((d) => d.payments),
  saveProfile: (p: Partial<SchoolProfile> & { city?: string; state?: string }) => call<{ school: SchoolInfo; message: string }>('/school_dashboard/profile', 'PUT', p),
  uploadLogo: async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    const res = await fetch(`${API_URL}/school_dashboard/logo`, { method: 'POST', credentials: 'include', body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new ApiError(res.status, data.message ?? 'Upload failed');
    return data.url as string;
  },
};
