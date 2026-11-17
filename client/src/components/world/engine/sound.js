/*
 * NextGen World: sound. Music, the sea, birds or crickets, and every effect,
 * all made in the browser (no audio files). Starts on the first tap (browser rule).
 * Plain JavaScript on purpose (types are in sound.d.ts).
 */
let night = false;
export const SND = (() => {
  let ctx = null, master, musicG, sfxG, ambG, wet, on = true, mode = 'world', step = 0, nextT = 0, noiseBuf = null, waveG = null;
  try { on = localStorage.getItem('ng-world-sound') !== 'off'; } catch (e) { /* storage blocked */ }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function start(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = on ? .9 : 0; master.connect(ctx.destination);
    const comp = ctx.createDynamicsCompressor(); comp.connect(master);
    const delay = ctx.createDelay(); delay.delayTime.value = .27; const fb = ctx.createGain(); fb.gain.value = .3;
    wet = ctx.createGain(); wet.gain.value = .22; delay.connect(fb).connect(delay); delay.connect(wet).connect(comp);
    musicG = ctx.createGain(); musicG.gain.value = .2; musicG.connect(comp); musicG.connect(delay);
    sfxG = ctx.createGain(); sfxG.gain.value = .55; sfxG.connect(comp);
    ambG = ctx.createGain(); ambG.gain.value = .16; ambG.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    sea(); nextT = ctx.currentTime + .1; setInterval(schedule, 25); critters();
  }
  // one note
  function tone(f, dur, o = {}){
    if (!ctx) return; const t = (o.t ?? ctx.currentTime) + (o.at || 0);
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.slide || dur));
    const v = o.vol ?? .3, a = o.attack ?? .005;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.dest || sfxG); osc.start(t); osc.stop(t + dur + .05);
  }
  // a burst of filtered noise (shakers, claps, whooshes, waves)
  function noise(dur, o = {}){
    if (!ctx) return; const t = (o.t ?? ctx.currentTime) + (o.at || 0);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = o.filter || 'highpass'; f.frequency.setValueAtTime(o.freq || 6000, t); if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur); f.Q.value = o.q || .7;
    const g = ctx.createGain(); const v = o.vol ?? .2;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack ?? .003)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.dest || sfxG); src.start(t, Math.random()); src.stop(t + dur + .05);
  }
  // the sea: looping noise, low-passed, rising and falling like waves
  function sea(){
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    waveG = ctx.createGain(); waveG.gain.value = .5;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .11; lg.gain.value = .38; lfo.connect(lg).connect(waveG.gain); lfo.start();
    src.connect(f).connect(waveG).connect(ambG); src.start();
  }
  // birds by day, crickets by night (only while you are in the world)
  function critters(){
    const go = () => {
      if (on && mode === 'world'){
        if (!night){ const b = 2200 + Math.random() * 1600; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) tone(b + Math.random() * 400, .09, { to: b * 1.35, at: k * .12, vol: .05, dest: ambG }); }
        else for (let k = 0; k < 6; k++) tone(4300, .03, { type: 'square', at: k * .055, vol: .012, dest: ambG });
      }
      setTimeout(go, night ? 900 + Math.random() * 900 : 2500 + Math.random() * 4500);
    };
    setTimeout(go, 1500);
  }
  // ---------- music: a soft afro / amapiano-style loop that changes with where you are ----------
  const SONGS = {
    world:  { bpm: 98,  prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], kick: [0, 10], log: [0, 3, 6, 11], clap: [], mel: [0, -1, 2, -1, 1, -1, 2, 0, -1, 2, -1, 1, 0, -1, -1, 2], vol: 1 },
    game:   { bpm: 112, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], kick: [0, 6, 10], log: [0, 3, 6, 10, 13], clap: [4, 12], mel: [0, 2, 1, 2, 0, 2, 1, 0, 2, -1, 1, 2, 0, 1, 2, 1], vol: .75 },
    boss:   { bpm: 132, prog: [[52, 55, 59], [52, 55, 59], [48, 52, 55], [50, 54, 57]], kick: [0, 4, 8, 12], log: [0, 2, 4, 6, 8, 10, 12, 14], clap: [4, 12], mel: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 2, 1, 0, 1], vol: .8, minor: true },
    result: { bpm: 90,  prog: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], kick: [], log: [0], clap: [], mel: [0, -1, -1, -1, 1, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1], vol: .6 },
  };
  function schedule(){
    if (!ctx || !on) { if (ctx) nextT = ctx.currentTime + .05; return; }
    const S = SONGS[mode]; const st = 60 / S.bpm / 4;
    while (nextT < ctx.currentTime + .12){
      const s = step % 16, bar = Math.floor(step / 16) % 4, ch = S.prog[bar], t = nextT, d = musicG;
      if (S.kick.includes(s)) tone(130, .28, { to: 42, slide: .12, vol: .5 * S.vol, t, dest: d });
      if (S.log.includes(s)) tone(mtof(ch[0] - 24), .38, { to: mtof(ch[0] - 26), slide: .3, vol: .32 * S.vol, t, dest: d, attack: .002 });
      if (s % 2 === 1 || mode === 'boss') noise(.05, { freq: 7000, vol: (s % 4 === 3 ? .07 : .035) * S.vol, t, dest: d });
      if (S.clap.includes(s)) noise(.14, { filter: 'bandpass', freq: 1600, q: 1.2, vol: .16 * S.vol, t, dest: d });
      const m = S.mel[s]; if (m >= 0){ const n = ch[m] + 12 + (mode === 'boss' && s > 11 ? 12 : 0);
        tone(mtof(n), .22, { vol: .13 * S.vol, t, dest: d }); tone(mtof(n) * 4, .06, { vol: .025 * S.vol, t, dest: d }); }
      if (s === 0) ch.forEach(n => tone(mtof(n), st * 15, { type: 'triangle', vol: .045 * S.vol, attack: .25, t, dest: d }));
      nextT += st; step++;
    }
  }
  const api = {
    start,
    get on(){ return on; },
    setNight(n){ night = !!n; },
    stop(){ if (ctx && ctx.state === 'running') ctx.suspend(); },
    toggle(){ on = !on; try { localStorage.setItem('ng-world-sound', on ? 'on' : 'off'); } catch (e) { /* storage blocked */ } if (master) master.gain.setTargetAtTime(on ? .9 : 0, ctx.currentTime, .05); return on; },
    mode(m){ if (!SONGS[m] || m === mode) return; mode = m; step = 0; if (ctx){ ambG.gain.setTargetAtTime(m === 'world' ? .16 : .03, ctx.currentTime, .3); } },
    tap(){ tone(880, .07, { type: 'triangle', vol: .18 }); },
    whoosh(){ noise(.6, { filter: 'bandpass', freq: 400, to: 2600, q: .8, vol: .12, attack: .2 }); },
    open(){ tone(660, .1, { vol: .16 }); tone(990, .16, { at: .08, vol: .16 }); },
    lock(){ tone(160, .18, { type: 'square', vol: .08, to: 110 }); noise(.08, { filter: 'lowpass', freq: 600, vol: .15 }); },
    right(){ [72, 76, 79].forEach((n, k) => tone(mtof(n), .16, { type: 'triangle', at: k * .06, vol: .22 })); },
    wrong(){ tone(220, .28, { type: 'sawtooth', to: 130, vol: .07 }); },
    coin(){ tone(988, .08, { type: 'square', vol: .07 }); tone(1319, .3, { type: 'square', at: .07, vol: .07 }); },
    buy(){ noise(.04, { freq: 3000, vol: .2 }); tone(1568, .12, { type: 'triangle', at: .03, vol: .16 }); },
    swipe(){ noise(.25, { filter: 'bandpass', freq: 900, to: 3800, q: 1, vol: .14, attack: .03 }); },
    letter(k){ tone(mtof(72 + (k % 8) * 2), .08, { type: 'triangle', vol: .14 }); },
    found(){ [72, 76, 79, 84].forEach((n, k) => tone(mtof(n), .2, { type: 'triangle', at: k * .07, vol: .2 })); },
    hit(){ noise(.25, { filter: 'lowpass', freq: 1800, to: 200, vol: .35 }); tone(90, .3, { to: 40, vol: .5 }); },
    tick(){ tone(1800, .03, { type: 'square', vol: .05 }); },
    vote(){ api.tap(); noise(1.4, { filter: 'bandpass', freq: 1200, q: .6, vol: .1, attack: .35 }); },
    star(k){ tone(mtof(79 + k * 4), .5, { type: 'triangle', vol: .22 }); tone(mtof(91 + k * 4), .3, { vol: .06 }); },
    points(){ for (let k = 0; k < 6; k++) tone(1200 + k * 160, .07, { type: 'square', at: k * .05, vol: .05 }); },
    levelUp(){ [60, 64, 67, 72, 76, 79, 84].forEach((n, k) => tone(mtof(n), k === 6 ? .8 : .14, { type: 'square', at: k * .08, vol: .07 })); },
    unlock(){ [84, 88, 91, 96].forEach((n, k) => tone(mtof(n), .4, { at: k * .09, vol: .1 })); noise(.9, { freq: 5000, to: 12000, vol: .05, attack: .2 }); },
    hop(){ tone(300, .18, { to: 620, slide: .1, vol: .14 }); },
    win(){ [67, 72, 76, 79].forEach((n, k) => tone(mtof(n), .3, { type: 'triangle', at: k * .1, vol: .2 })); },
    lose(){ [67, 63, 60].forEach((n, k) => tone(mtof(n), .3, { type: 'triangle', at: k * .15, vol: .16 })); },
  };
  return api;
})();
