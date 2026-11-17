'use client';

import { useEffect } from 'react';

// Scroll reveal for the whole public site (like creataws.victoriaolamide.com):
//  - section headings, page headers and story blocks slide up and fade in as they come into view
//  - cards in a grid come in one by one, a moment after each other
// Nothing is hidden that is already on screen when the page opens (no flash), nothing runs for
// visitors who prefer reduced motion, and parts with their own animation are left alone
// (the hero, the categories scroll story, the Big News cards, the Vocab Vault ropes).
// It uses the browser's own animation API, so the cards keep their hover effects.

// one element slides up
const SINGLE = [
  '.sec-head', '.cat-hero .wrap > *', '.story-head > *', '.story-hero', '.story-body > *',
  '.empty-stories', '.stars-feature', '.info-page .wrap > *', 'footer .foot-col', '.arcade .more',
].join(',');
// the children of these come in one by one
const GROUPS = ['.bento', '.cat-strip', '.sc-grid', '.nm-how-grid', '.stars-row', '.arcade .games', '.shelf'].join(',');
// parts with their own animation
const SKIP = '.hero, .ms-sec, .cs-sec, .bn-sec, .vault, .vocab-sec, [data-no-reveal], .admin, .school';

const EASE = 'cubic-bezier(.2,.8,.2,1)';

export default function ScrollReveal({ path }: { path: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const play = (el: HTMLElement, delay: number, distance: number) => {
      el.classList.remove('rv-wait');
      try {
        el.animate(
          [{ opacity: 0, translate: `0 ${distance}px` }, { opacity: 1, translate: '0 0' }],
          { duration: distance > 30 ? 900 : 800, delay, easing: EASE, fill: 'backwards' },
        );
      } catch { /* very old browser: it simply shows */ }
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target as HTMLElement;
        io.unobserve(el);
        if (el.dataset.rv === 'group') {
          Array.from(el.children).forEach((child, i) => {
            if ((child as HTMLElement).classList.contains('rv-wait')) play(child as HTMLElement, Math.min(i, 8) * 80, 26);
          });
        } else play(el, 0, 34);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    const onScreen = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.92 && r.bottom > 0;
    };
    const scan = () => {
      const root = document.body;
      root.querySelectorAll<HTMLElement>(GROUPS).forEach((g) => {
        if (g.dataset.rv || g.closest(SKIP)) return;
        g.dataset.rv = 'group';
        if (onScreen(g)) return; // already visible when the page opens: leave it
        Array.from(g.children).forEach((c) => c.classList.add('rv-wait'));
        io.observe(g);
      });
      root.querySelectorAll<HTMLElement>(SINGLE).forEach((el) => {
        if (el.dataset.rv || el.closest(SKIP) || el.closest('[data-rv="group"]') && el.parentElement?.dataset.rv === 'group') return;
        el.dataset.rv = 'one';
        if (onScreen(el)) return;
        el.classList.add('rv-wait');
        io.observe(el);
      });
    };

    // content that arrives later (stories loading, a new page) is picked up too
    let timer = 0;
    const mo = new MutationObserver(() => { window.clearTimeout(timer); timer = window.setTimeout(scan, 120); });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();

    // safety: never leave something on screen hidden (for example if the page jumped to an anchor)
    const safety = window.setInterval(() => {
      document.querySelectorAll<HTMLElement>('.rv-wait').forEach((el) => {
        if (!onScreen(el)) { delete el.dataset.rvSeen; return; }
        // on screen for a whole check and still waiting: show it
        if (el.dataset.rvSeen) play(el, 0, 20); else el.dataset.rvSeen = '1';
      });
    }, 1500);

    return () => { io.disconnect(); mo.disconnect(); window.clearTimeout(timer); window.clearInterval(safety); };
  }, [path]);

  return null;
}
