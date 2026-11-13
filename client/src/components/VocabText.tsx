'use client';

import { Fragment, useMemo } from 'react';
import type { VocabWord } from '@/lib/types';

function inline(text: string, keyPrefix: string) {
  return text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|~~[^~]+~~|==[^=]+==|\*[^*]+\*)/g).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = link[2].trim();
      if (/^(https?:\/\/|\/|#)/i.test(href)) return <a key={key} href={href} target={/^https?:\/\//i.test(href) ? '_blank' : undefined} rel={/^https?:\/\//i.test(href) ? 'noreferrer' : undefined}>{link[1]}</a>;
      return <Fragment key={key}>{part}</Fragment>;
    }
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <s key={key}>{part.slice(2, -2)}</s>;
    if (part.startsWith('==') && part.endsWith('==')) return <mark key={key}>{part.slice(2, -2)}</mark>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={key}>{part.slice(1, -1)}</em>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Turns "...a [[manifesto]]..." into text + tappable Vocab Vault words.
// `open` / `setOpen` let the parent keep only one tooltip open at a time.
export default function VocabText({ text, vocab, open, setOpen }: {
  text: string; vocab: VocabWord[]; open: string | null; setOpen: (w: string | null) => void;
}) {
  const lookup = useMemo(() => {
    const map = new Map<string, VocabWord>();
    vocab.forEach((v) => {
      map.set(norm(v.word), v);
      v.aliases?.forEach((a) => map.set(norm(a), v));
    });
    return map;
  }, [vocab]);

  return (
    <>
      {/* [[word]] = vocab word; **[[word]]** = bold vocab word */}
      {text.split(/(\*\*\[\[.+?\]\]\*\*|\[\[.+?\]\])/).map((token, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{inline(token, String(i))}</Fragment>;
        const bold = token.startsWith('**');
        const part = token.replace(/^\*\*/, '').replace(/\*\*$/, '').slice(2, -2);
        const v = lookup.get(norm(part)) ?? lookup.get(norm(part).replace(/s$/, ''));
        if (!v) return bold ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>;
        const id = `${text.length}-${i}-${part}`;
        const word = (
          <span
            key={i}
            className={`vocab${open === id ? ' show' : ''}`}
            tabIndex={0}
            role="button"
            aria-expanded={open === id}
            onClick={() => setOpen(open === id ? null : id)}
            onKeyDown={(e) => e.key === 'Enter' && setOpen(open === id ? null : id)}
          >
            {part}
            <span className="tip"><b>{v.word.toUpperCase()}</b>{v.definition} {v.nextgen}</span>
          </span>
        );
        return bold ? <strong key={i}>{word}</strong> : word;
      })}
    </>
  );
}
