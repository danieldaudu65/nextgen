// Arcade sounds, made in the browser (no audio files). Quiet chiptune blips.
let ctx: AudioContext | null = null;
let muted = false;

export function setArcadeMuted(m: boolean) { muted = m; }

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; at?: number; to?: number } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + (opts.at ?? 0);
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  gain.gain.setValueAtTime(opts.vol ?? 0.035, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  move: () => tone(620, 0.05, { vol: 0.025 }),
  coin: () => { tone(988, 0.08); tone(1319, 0.3, { at: 0.08 }); },
  launch: () => tone(180, 0.5, { type: 'sawtooth', to: 1400, vol: 0.03 }),
  count: () => tone(440, 0.12, { vol: 0.03 }),
  go: () => { tone(880, 0.12); tone(1175, 0.3, { at: 0.1 }); },
  nope: () => tone(150, 0.22, { type: 'sawtooth', vol: 0.03 }),
  back: () => tone(700, 0.15, { to: 240, vol: 0.025 }),
  levelUp: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i === 4 ? 0.45 : 0.14, { at: i * 0.09, vol: 0.04 })),
};
