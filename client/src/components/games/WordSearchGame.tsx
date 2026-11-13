'use client';

import { useState } from 'react';
import type { WordSearch } from '@/lib/types';
import { usePoints } from '../PointsProvider';

const key = (r: number, c: number) => `${r},${c}`;
const sorted = (s: string) => [...s].sort().join('');

export default function WordSearchGame({ data, edition }: { data: WordSearch; edition: string }) {
  const { completeGame } = usePoints();
  const [hits, setHits] = useState<string[]>([]);       // currently selected cells, in order
  const [foundCells, setFoundCells] = useState<Set<string>>(new Set());
  const [found, setFound] = useState<Set<string>>(new Set());

  const letterAt = (k: string) => {
    const [r, c] = k.split(',').map(Number);
    return data.grid[r][c];
  };

  const tap = (k: string) => {
    if (foundCells.has(k)) return;
    const next = hits.includes(k) ? hits.filter((x) => x !== k) : [...hits, k];
    const word = next.map(letterAt).join('');
    const match = data.words.find((w) => !found.has(w) && w.length === next.length && sorted(w) === sorted(word));
    if (match) {
      const fc = new Set(foundCells); next.forEach((x) => fc.add(x));
      const f = new Set(found); f.add(match);
      setFoundCells(fc); setFound(f); setHits([]);
      if (f.size === data.words.length) completeGame('wordsearch', edition, 30, 'Democracy Detective');
    } else {
      setHits(next.length > 9 ? [] : next);
    }
  };

  return (
    <div className="game">
      <div className="gh"><h3>Democracy Word Search</h3><span className="reward">+30 pts</span></div>
      <div className="hint">Tap the letters of each word, in order.</div>
      <div className="ws">
        {data.grid.map((row, r) =>
          [...row].map((ch, c) => {
            const k = key(r, c);
            const cls = foundCells.has(k) ? 'found' : hits.includes(k) ? 'hit' : '';
            return <span key={k} className={cls} onClick={() => tap(k)}>{ch}</span>;
          }),
        )}
      </div>
      <div className="wordlist">
        {data.words.map((w) => <span key={w} className={found.has(w) ? 'got' : ''}>{w}</span>)}
      </div>
    </div>
  );
}
