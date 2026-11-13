'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

// Runs in <head> before paint so there is no light/dark flash.
export const themeInitScript = `(function(){try{var s=localStorage.getItem('ng-theme');var m=s||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=m;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as Theme) || 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('ng-theme', next);
    } catch {}
    setTheme(next);
  };

  return (
    <button className="theme" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <i>{theme === 'dark' ? '🌙' : '☀️'}</i>
    </button>
  );
}
