// Types for sound.js
type Mode = 'world' | 'game' | 'boss' | 'result';
export const SND: {
  start(): void; stop(): void; readonly on: boolean; toggle(): boolean; mode(m: Mode): void; setNight(n: boolean): void;
  tap(): void; whoosh(): void; open(): void; lock(): void; right(): void; wrong(): void; coin(): void; buy(): void; swipe(): void;
  letter(k: number): void; found(): void; hit(): void; tick(): void; vote(): void; star(k: number): void; points(): void;
  levelUp(): void; unlock(): void; hop(): void; win(): void; lose(): void;
};
