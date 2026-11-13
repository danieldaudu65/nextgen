'use client';

import { useState } from 'react';
import type { VocabWord } from '@/lib/types';

export default function VocabFlips({ words }: { words: VocabWord[] }) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const toggle = (w: string) =>
    setFlipped((s) => {
      const n = new Set(s);
      if (n.has(w)) n.delete(w); else n.add(w);
      return n;
    });

  return (
    <section className="sec" id="vocab">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <span className="tagbar">VOCAB VAULT</span>
            <h2 className="display">Unlock the words.</h2>
          </div>
          <p className="sub">Tap a card to flip it.</p>
        </div>
        <div className="flips">
          {words.map((v) => (
            <div
              key={v.word}
              className={`flip${flipped.has(v.word) ? ' on' : ''}`}
              onClick={() => toggle(v.word)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggle(v.word)}
              aria-label={`${v.word}: tap to see the meaning`}
            >
              <div className="flip-in">
                <div className="f">
                  <small>{v.category.toUpperCase()}</small>
                  <span className="w">{v.word}</span>
                  <small>Tap to flip ↻</small>
                </div>
                <div className="b">
                  <b>{v.word.toUpperCase()}</b>
                  {v.definition}
                  <em>{v.nextgen}</em>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
