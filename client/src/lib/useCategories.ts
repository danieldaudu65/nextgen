'use client';

import { useEffect, useState } from 'react';
import { getCategories } from './api';
import { CATEGORIES, type Category } from './categories';

// Categories from Admin → Categories, shared by every component on the page (one request).
// Shows the built-in list until the server answers, and keeps it if the server can't be reached.
let cached: Category[] | null = null;
let pending: Promise<Category[] | null> | null = null;

export function useCategories(): Category[] {
  const [list, setList] = useState<Category[]>(cached ?? CATEGORIES);
  useEffect(() => {
    if (cached) return;
    pending ??= getCategories();
    let alive = true;
    pending.then((c) => { if (c) { cached = c; if (alive) setList(c); } }).finally(() => { pending = null; });
    return () => { alive = false; };
  }, []);
  return list;
}
