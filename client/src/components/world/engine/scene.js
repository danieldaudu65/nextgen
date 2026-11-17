/*
 * ============================================================
 * NextGen World: the 3D island (three.js)
 * ============================================================
 * One island per edition. A yellow road climbs the mountain and
 * each stop is a level. The Boss waits at the top. Older editions
 * are islands across the sea; the next one hides in clouds.
 *
 * Plain JavaScript on purpose (types are in scene.d.ts).
 * React never touches the 3D objects: it calls the methods that
 * createWorld() returns, and hears back through the callbacks.
 * ============================================================
 */
import * as THREE from 'three';

const YEL = '#FFD400', INK = '#0A0A0A';
const C = (hex) => new THREE.Color(hex);

// ---------- the ground ----------
const noise = (x, z) => Math.sin(x * .15) * Math.cos(z * .13) * 1.2 + Math.sin(x * .37 + z * .21) * .6 + Math.sin(z * .5 - x * .3) * .3 + Math.sin(x * .9 + z * .7) * .12;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function height(x, z){
  const r = Math.hypot(x, z);
  const land = 1 - smooth(44, 60, r);
  const hill = 18 * Math.exp(-(r * r) / (2 * 15 * 15)) + 4 * Math.exp(-((x + 22) ** 2 + (z - 18) ** 2) / 120);
  return land * (2.4 + noise(x, z) * .9 + hill) + (1 - land) * -4;
}

export function createWorld(canvas, opts = {}){
  const teaser = !!opts.teaser;
  const LV = opts.levels || [];
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const disposers = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); disposers.push(() => el.removeEventListener(ev, fn, o)); };

  // ---------- renderer, scene, camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(teaser ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);

  const skyU = { top: { value: C('#3f8fe0') }, mid: { value: C('#bfe3ff') }, bot: { value: C('#fff4d6') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bot, smoothstep(0.0, -0.2, h)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}',
  }));
  scene.add(sky);
  scene.fog = new THREE.Fog(C('#cfe8ff'), 160, 620);
  const hemi = new THREE.HemisphereLight(C('#dff1ff'), C('#6b8f4e'), 2.3);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(C('#fff2d6'), 4.6);
  sun.position.set(70, 110, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.set(teaser ? 1024 : 2048, teaser ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -75, right: 75, top: 75, bottom: -75, near: 10, far: 320 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 12), new THREE.MeshBasicMaterial({ color: '#fff3b0', fog: false }));
  sunBall.position.set(330, 300, 260); scene.add(sunBall);

  const STD = (hex, o = {}) => new THREE.MeshStandardMaterial({ color: C(hex), roughness: .7, ...o });
  const glossy = (hex) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: .22, metalness: .1, clearcoat: 1, clearcoatRoughness: .08 });
  function add(parent, mesh, x, y, z){ mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
  function canvasTex(draw, w = 256, h = 256){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d')); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }

  function island(size, seg, pal){
    const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, cols = [];
    const sand = C(pal.sand), grass = C(pal.grass), grass2 = C(pal.grass2), rock = C(pal.rock), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++){
      const x = p.getX(i), z = p.getZ(i), y = height(x, z); p.setY(i, y);
      const t = (Math.sin(x * .8) * Math.cos(z * .7) + 1) / 2;
      if (y < 1.3) tmp.copy(sand); else if (y > 15.5) tmp.copy(rock).lerp(grass2, .25); else tmp.copy(grass).lerp(grass2, t * .8 + smooth(6, 15, y) * .3);
      if (y > 1.3 && y < 2.0) tmp.lerp(sand, .5);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
    m.receiveShadow = true; m.castShadow = true; return m;
  }
  scene.add(island(130, teaser ? 110 : 150, { sand: '#ecd9a6', grass: '#5fa84b', grass2: '#3d7f3a', rock: '#8f877a' }));

  const seaG = new THREE.PlaneGeometry(1400, 1400, teaser ? 60 : 90, teaser ? 60 : 90); seaG.rotateX(-Math.PI / 2);
  const seaBase = Float32Array.from(seaG.attributes.position.array);
  const sea = new THREE.Mesh(seaG, new THREE.MeshStandardMaterial({ color: C('#2F7DE1'), roughness: .25, metalness: .15, transparent: true, opacity: .92 }));
  sea.position.y = .2; sea.receiveShadow = true; scene.add(sea);
  const foam = new THREE.Mesh(new THREE.RingGeometry(55, 62, 96), new THREE.MeshBasicMaterial({ color: '#e9f6ff', transparent: true, opacity: .35 }));
  foam.rotation.x = -Math.PI / 2; foam.position.y = .35; scene.add(foam);

  // ---------- the road ----------
  const ROAD = [];
  const roadAt = (t) => { const a = .6 + t * Math.PI * 2 * 1.38, r = 46 * Math.pow(1 - t, .85) + 1.5; return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r); };
  for (let i = 0; i <= 500; i++){ const v = roadAt(i / 500); v.y = height(v.x, v.z); ROAD.push(v); }
  function ribbon(width, lift, color, rough, from = 0, to = ROAD.length - 1){
    const pos = [], idx = [];
    for (let i = from; i <= to; i++){
      const a = ROAD[Math.max(0, i - 1)], b = ROAD[Math.min(ROAD.length - 1, i + 1)];
      const tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      for (const s of [-1, 1]){ const x = ROAD[i].x + nx * width / 2 * s, z = ROAD[i].z + nz * width / 2 * s; pos.push(x, height(x, z) + lift, z); }
      if (i > from){ const k = (i - from) * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: C(color), roughness: rough, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }));
    m.receiveShadow = true; scene.add(m); return m;
  }
  ribbon(3.3, .28, INK, .8);
  ribbon(2.5, .34, YEL, .55);
  { const g = new THREE.BoxGeometry(.18, .05, .9), mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .6 });
    for (let i = 4; i < ROAD.length - 4; i += 7){ const a = ROAD[i], b = ROAD[i + 1]; const d = new THREE.Mesh(g, mat); d.position.set(a.x, a.y + .4, a.z); d.lookAt(b.x, b.y + .4, b.z); scene.add(d); } }

  // ---------- levels ----------
  const T = [.03, .18, .34, .5, .65, .81, .985];
  const LEVELS = T.map((t, i) => {
    const k = Math.round(t * 500), p = ROAD[k].clone(), q = ROAD[Math.min(500, k + 3)];
    return { i, k, key: LV[i]?.key, color: LV[i]?.color || YEL, pos: p, dir: new THREE.Vector3(q.x - p.x, 0, q.z - p.z).normalize(), out: new THREE.Vector3(p.x, 0, p.z).normalize(), state: 'locked', stars: 0, clicks: [], group: null, land: null };
  });
  const clickables = [];
  const labelTex = (text, o = {}) => canvasTex((x) => { x.font = `900 ${o.size || 130}px Inter, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 18; x.strokeStyle = INK; x.strokeText(text, 128, 132); x.fillStyle = o.fill || '#fff'; x.fillText(text, 128, 132); });
  const label = (text, o) => new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, o), transparent: true, depthWrite: false }));
  function starsSprite(n){
    const tex = canvasTex((x) => {
      const star = (cx, cy, r, lit) => { x.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = lit ? YEL : 'rgba(255,255,255,.35)'; x.fill(); x.lineWidth = 6; x.strokeStyle = INK; x.stroke(); };
      star(58, 56, 30, n > 0); star(128, 44, 38, n > 1); star(198, 56, 30, n > 2);
    }, 256, 96);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(3.6, 1.35, 1); return sp;
  }
  function buildLevel(L, pop){
    if (L.group){ scene.remove(L.group); const gone = new Set(L.clicks); for (let k = clickables.length - 1; k >= 0; k--) if (gone.has(clickables[k])) clickables.splice(k, 1); }
    L.clicks = [];
    const reg = (m) => { m.userData.level = L.i; clickables.push(m); L.clicks.push(m); };
    const g = new THREE.Group(); g.position.copy(L.pos); g.position.y += .3;
    const boss = L.i === 6, R = boss ? 2.3 : 1.7, locked = L.state === 'locked';
    const base = new THREE.Mesh(new THREE.CylinderGeometry(R + .45, R + .6, .7, 40), STD(INK, { roughness: .5 })); base.position.y = .35;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + .22, .22, 12, 48), STD(YEL, { roughness: .3, metalness: .5 })); rim.rotation.x = Math.PI / 2; rim.position.y = .78;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .5, 40), locked ? STD('#6B6862', { roughness: .6 }) : glossy(L.color)); top.position.y = .85;
    [base, rim, top].forEach((m) => { m.castShadow = true; m.receiveShadow = true; reg(m); g.add(m); });
    const num = label(locked ? '🔒' : boss ? '♛' : String(L.i + 1), { size: locked ? 100 : 140, fill: locked ? '#CBC8BF' : '#fff' });
    num.scale.set(3.2, 3.2, 1); num.position.y = 3.4; reg(num); g.add(num);
    if (L.stars > 0){ const st = starsSprite(L.stars); st.position.y = 5.5; g.add(st); }
    if (pop) g.userData.pop = performance.now();
    scene.add(g); L.group = g;
  }

  // ---------- a landmark beside each level ----------
  function stripes(a, b){ return canvasTex((x) => { for (let i = 0; i < 8; i++){ x.fillStyle = i % 2 ? b : a; x.fillRect(i * 8, 0, 8, 8); } }, 64, 8); }
  function windows(cols, rows, lit){ return canvasTex((x) => { x.fillStyle = '#2A2926'; x.fillRect(0, 0, 128, 256); for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++){ x.fillStyle = rnd() < lit ? '#FFD400' : '#4A4843'; x.fillRect(10 + c * (108 / cols), 10 + r * (236 / rows), 108 / cols - 10, 236 / rows - 10); } }, 128, 256); }
  const glowMats = [];
  const spinners = [];
  function landmark(L){
    const side = L.i % 2 ? -1 : 1;
    const perp = new THREE.Vector3(-L.dir.z, 0, L.dir.x).multiplyScalar(side);
    if (perp.dot(L.out) < 0 && L.i !== 6) perp.multiplyScalar(-1);
    const at = L.pos.clone().add(perp.multiplyScalar(L.i === 6 ? 0 : 6.5));
    const g = new THREE.Group(); g.position.set(at.x, height(at.x, at.z) - .1, at.z);
    g.lookAt(L.pos.x, g.position.y, L.pos.z);
    const k = L.key;
    if (k === 'money'){
      [-2.4, 0, 2.4].forEach((x, i) => {
        add(g, new THREE.Mesh(new THREE.BoxGeometry(2, 1.4, 1.6), STD('#F7F7F5')), x, .7, 0);
        add(g, new THREE.Mesh(new THREE.BoxGeometry(2.3, .12, 2), new THREE.MeshStandardMaterial({ map: stripes(['#E3473B', '#2F7DE1', '#2FA36B'][i], '#ffffff'), roughness: .8 })), x, 1.75, .25).rotation.x = -.18;
        add(g, new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), STD('#fcb92e')), x - .4, 1.55, .9);
        add(g, new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 8), STD('#FFD400')), x + .3, 1.55, .9);
      });
      const coin = add(g, new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .25, 32), STD(YEL, { metalness: .8, roughness: .25 })), 0, 4.2, 0); coin.rotation.x = Math.PI / 2; spinners.push([coin, 'z', 2]);
    } else if (k === 'quiz'){
      const m = new THREE.MeshStandardMaterial({ map: windows(3, 8, .55), emissive: C('#FFD400'), emissiveMap: windows(3, 8, .55), emissiveIntensity: .15, roughness: .6 }); glowMats.push(m);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(3.4, 11, 3.4), m), 0, 5.5, 0);
      add(g, new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.6, 4), STD(YEL, { roughness: .4 })), 0, 12.3, 0).rotation.y = Math.PI / 4;
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 2.4, 8), STD(INK)), 0, 14.6, 0);
      const bolt = add(g, new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFD400' })), 0, 15.9, 0); bolt.userData.blink = 1;
    } else if (k === 'debate'){
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, .35, 40), STD('#CBC8BF', { roughness: .9 })), 0, .2, 0);
      [[-2.6, '#2E7D7A'], [2.6, '#E0457B']].forEach(([x, c]) => {
        add(g, new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 5, 8), STD('#4A4843')), x, 2.6, 0);
        add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 8, 1), new THREE.MeshStandardMaterial({ color: C(c), side: THREE.DoubleSide, roughness: .7 })), x + .95, 4.5, 0).userData.flag = 1;
      });
      for (let n = 0; n < 14; n++){ const a = n / 14 * Math.PI * 2; const c = n % 2 ? '#2E7D7A' : '#E0457B';
        add(g, new THREE.Mesh(new THREE.CapsuleGeometry(.22, .5, 4, 8), STD(c)), Math.cos(a) * 3, .9, Math.sin(a) * 3);
        add(g, new THREE.Mesh(new THREE.SphereGeometry(.2, 10, 8), STD('#8a5a38')), Math.cos(a) * 3, 1.55, Math.sin(a) * 3); }
      add(g, new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), STD('#F7F7F5')), 0, 1, 0);
      add(g, new THREE.Mesh(new THREE.BoxGeometry(.7, .05, .14), STD(INK)), 0, 1.62, 0);
    } else if (k === 'sort'){
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(3, 3.2, 2, 32), STD('#F7F7F5')), 0, 1, 0);
      add(g, new THREE.Mesh(new THREE.SphereGeometry(3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glossy('#2FA36B')), 0, 2, 0);
      add(g, new THREE.Mesh(new THREE.TorusGeometry(3.05, .12, 8, 48), new THREE.MeshBasicMaterial({ color: '#FFD400' })), 0, 2, 0).rotation.x = Math.PI / 2;
      const dish = add(g, new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 3), STD('#CBC8BF', { side: THREE.DoubleSide })), 2.2, 5.4, 0); dish.rotation.z = -.9; spinners.push([dish, 'y', 1.2]);
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 1.6, 8), STD('#4A4843')), 1.8, 4.6, 0);
    } else if (k === 'promise'){
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, .1, 36), STD('#2F7DE1', { roughness: .2, metalness: .2 })), 0, .25, 0);
      add(g, new THREE.Mesh(new THREE.TorusGeometry(3.6, .45, 10, 32, Math.PI), STD('#8a5a38')), 0, .2, 0);
      for (let n = 0; n <= 10; n++){ const a = Math.PI * n / 10; add(g, new THREE.Mesh(new THREE.BoxGeometry(.5, .14, 2), STD('#c98b52')), Math.cos(a) * 3.6, .2 + Math.sin(a) * 3.6 + .5, 0).rotation.z = a - Math.PI / 2; }
    } else if (k === 'wordsearch'){
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, .5, 32), STD('#4b8f3a')), 0, .25, 0);
      const pal = ['#E0457B', '#FFD400', '#6B4FD8', '#2F7DE1', '#fcb92e', '#F7F7F5'];
      for (let n = 0; n < 26; n++){ const a = n * 2.4, r = 1 + (n % 5) * .55;
        add(g, new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .9, 6), STD('#2f6b2c')), Math.cos(a) * r, .9, Math.sin(a) * r);
        add(g, new THREE.Mesh(new THREE.SphereGeometry(.32, 10, 8), STD(pal[n % pal.length], { roughness: .5 })), Math.cos(a) * r, 1.45, Math.sin(a) * r); }
      const glass = add(g, new THREE.Mesh(new THREE.TorusGeometry(.9, .18, 10, 32), STD(INK)), 0, 3.4, 0); spinners.push([glass, 'y', 1.2]);
      add(g, new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 1.4, 8), STD(INK)), .9, 2.5, 0).rotation.z = .7;
    } else if (k === 'boss'){
      g.position.set(L.pos.x, height(L.pos.x, L.pos.z) - .2, L.pos.z);
      for (let n = 0; n < 4; n++){ const a = n * Math.PI / 2 + Math.PI / 4;
        add(g, new THREE.Mesh(new THREE.CylinderGeometry(1, 1.15, 7, 16), STD('#2A2926')), Math.cos(a) * 5.6, 3.5, Math.sin(a) * 5.6);
        add(g, new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.6, 16), STD('#E3473B', { roughness: .5 })), Math.cos(a) * 5.6, 8.3, Math.sin(a) * 5.6); }
      const crown = new THREE.Group(); crown.position.y = 12;
      const gold = STD(YEL, { metalness: .85, roughness: .2, emissive: C('#3a2a00') });
      add(crown, new THREE.Mesh(new THREE.TorusGeometry(2, .38, 12, 40), gold), 0, 0, 0).rotation.x = Math.PI / 2;
      for (let n = 0; n < 5; n++){ const a = n / 5 * Math.PI * 2; add(crown, new THREE.Mesh(new THREE.ConeGeometry(.45, 1.6, 12), gold), Math.cos(a) * 2, .9, Math.sin(a) * 2);
        add(crown, new THREE.Mesh(new THREE.SphereGeometry(.26, 12, 8), STD('#E3473B', { roughness: .2 })), Math.cos(a) * 2, 1.8, Math.sin(a) * 2); }
      crown.userData.crown = 1; g.add(crown);
    }
    g.traverse((o) => { if (o.isMesh){ o.userData.level = L.i; clickables.push(o); } });
    scene.add(g); L.land = g;
  }
  LEVELS.forEach(landmark);

  // ---------- trees, rocks, a little town, a bus ----------
  const nearRoad = (x, z, d) => { for (let i = 0; i < ROAD.length; i += 3){ const p = ROAD[i]; if ((p.x - x) ** 2 + (p.z - z) ** 2 < d * d) return true; } return false; };
  const nearLevel = (x, z, d) => LEVELS.some((L) => { const q = L.land.position; return (L.pos.x - x) ** 2 + (L.pos.z - z) ** 2 < d * d || (q.x - x) ** 2 + (q.z - z) ** 2 < d * d; });
  const trunkM = STD('#7a4f30'), leafA = STD('#4f9a3f', { roughness: .85 }), leafB = STD('#2f7a36', { roughness: .85 }), palmM = STD('#3da85a', { roughness: .7, side: THREE.DoubleSide }), rockM = STD('#9b9284', { roughness: 1, flatShading: true });
  const G = { trunk: new THREE.CylinderGeometry(.35, .6, 3, 8), ball: new THREE.IcosahedronGeometry(1.5, 1), rock: new THREE.DodecahedronGeometry(1, 0), leaf: new THREE.ConeGeometry(.5, 3.2, 4) };
  function baobab(x, z, s){ const g = new THREE.Group();
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(.7, 1.1, 4, 10), trunkM), 0, 2, 0);
    [[-1.2, 4.6, 0], [1.1, 4.8, .3], [0, 5.3, -.8], [0, 5, .9]].forEach(([a, b, c]) => add(g, new THREE.Mesh(G.ball, leafA), a, b, c).scale.set(1, .55, 1));
    g.position.set(x, height(x, z), z); g.scale.setScalar(s); g.rotation.y = rnd() * 6; scene.add(g); }
  function tree(x, z, s){ const g = new THREE.Group();
    add(g, new THREE.Mesh(G.trunk, trunkM), 0, 1.5, 0); add(g, new THREE.Mesh(G.ball, rnd() > .5 ? leafA : leafB), 0, 3.8, 0);
    g.position.set(x, height(x, z), z); g.scale.setScalar(s); scene.add(g); }
  function palm(x, z, s){ const g = new THREE.Group(); const lean = (rnd() - .5) * .5;
    for (let k = 0; k < 6; k++) add(g, new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, 1.1, 7), trunkM), lean * k * .5, .55 + k, 0);
    for (let k = 0; k < 7; k++){ const l = add(g, new THREE.Mesh(G.leaf, palmM), lean * 3, 6.3, 0); l.rotation.set(Math.PI / 2.4, k / 7 * Math.PI * 2, 0, 'YXZ'); l.translateY(1.4); l.scale.z = .25; }
    g.position.set(x, height(x, z), z); g.scale.setScalar(s); scene.add(g); }
  const TREES = teaser ? 170 : 260;
  for (let n = 0; n < TREES; n++){
    const a = rnd() * Math.PI * 2, r = 6 + Math.sqrt(rnd()) * 50, x = Math.cos(a) * r, z = Math.sin(a) * r, y = height(x, z);
    if (y < 1.2 || nearRoad(x, z, 3.6) || nearLevel(x, z, 7.5)) continue;
    if (y < 2.4){ if (rnd() > .3) palm(x, z, .7 + rnd() * .4); continue; }
    if (y > 14 && rnd() > .4){ const m = add(scene, new THREE.Mesh(G.rock, rockM), x, y + .3, z); m.scale.set(1 + rnd() * 1.5, .6 + rnd(), 1 + rnd()); m.rotation.y = rnd() * 6; continue; }
    const p = rnd(); if (p < .12) baobab(x, z, .8 + rnd() * .5); else if (p < .85) tree(x, z, .6 + rnd() * .6); else add(scene, new THREE.Mesh(G.rock, rockM), x, y + .3, z).scale.setScalar(.6 + rnd());
  }
  for (let n = 0; n < 16; n++){
    const a = -2.2 + n * .09 + rnd() * .04, r = 34 + rnd() * 8, x = Math.cos(a) * r, z = Math.sin(a) * r, y = height(x, z);
    if (y < 1.4 || nearRoad(x, z, 4) || nearLevel(x, z, 7)) continue;
    const h = 2 + rnd() * 3.5, w = 2.2 + rnd();
    const m = new THREE.MeshStandardMaterial({ map: windows(2, 3, .5), emissive: C('#FFD400'), emissiveMap: windows(2, 3, .5), emissiveIntensity: .1, roughness: .7 }); glowMats.push(m);
    add(scene, new THREE.Mesh(new THREE.BoxGeometry(w, h, w), m), x, y + h / 2, z).rotation.y = -a;
    add(scene, new THREE.Mesh(new THREE.ConeGeometry(w * .8, 1.4, 4), STD(['#E3473B', '#2A2926', '#fcb92e'][n % 3])), x, y + h + .7, z).rotation.y = -a + Math.PI / 4;
  }
  const bus = new THREE.Group();
  add(bus, new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 3), STD(YEL, { roughness: .35 })), 0, .9, 0);
  add(bus, new THREE.Mesh(new THREE.BoxGeometry(1.45, .45, 2.4), STD('#1A1A18', { roughness: .2, metalness: .3 })), 0, 1.15, .1);
  add(bus, new THREE.Mesh(new THREE.BoxGeometry(1.46, .12, 3.02), STD(INK)), 0, .55, 0);
  [[-.7, -1], [.7, -1], [-.7, 1], [.7, 1]].forEach(([x, z]) => { add(bus, new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .2, 12), STD(INK)), x, .3, z).rotation.z = Math.PI / 2; });
  scene.add(bus);

  // ---------- clouds ----------
  const cloudM = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: .95 });
  const clouds = [];
  function cloud(x, y, z, s){ const g = new THREE.Group(); for (let k = 0; k < 6; k++){ const m = new THREE.Mesh(G.ball, cloudM); m.position.set((k - 2.5) * 1.7 + rnd(), rnd() * 1.2, rnd() * 2); m.scale.setScalar(1 + rnd() * 1.1); g.add(m); } g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); clouds.push(g); return g; }
  for (let n = 0; n < 12; n++){ const a = rnd() * Math.PI * 2, r = 70 + rnd() * 120; cloud(Math.cos(a) * r, 34 + rnd() * 26, Math.sin(a) * r, 1.4 + rnd() * 1.6); }

  // ---------- other editions across the sea ----------
  const flags = [];
  const NEXT = { clouds: [], flag: null, tag: null, info: null };
  const SPOTS = [[-170, 90, .42], [-120, -170, .38], [190, -150, .45]];
  const PALS = [{ sand: '#e6d3a0', grass: '#2E7D7A', grass2: '#1E5B5B', rock: '#7f8a83' }, { sand: '#efd59a', grass: '#d8a24a', grass2: '#C2410C', rock: '#9a7c5a' }];
  (opts.islands || []).slice(0, 3).forEach((I, n) => {
    const [x, z, s] = SPOTS[n];
    const pal = I.locked ? { sand: '#d9d6cf', grass: '#A8A49B', grass2: '#6B6862', rock: '#4A4843' } : PALS[n % 2];
    const m = island(130, 70, pal); m.scale.setScalar(s); m.position.set(x, 0, z); scene.add(m);
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const info = { ...I, x, z }; m.userData.island = info; clickables.push(m);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(.9 * s, .9 * s, 66 * s, 8), STD('#4A4843')), 0, height(0, 0) * s + 33 * s, 0);
    const flag = add(g, new THREE.Mesh(new THREE.PlaneGeometry(24 * s, 15 * s), STD(I.locked ? '#6B6862' : YEL, { side: THREE.DoubleSide })), 12 * s, height(0, 0) * s + 57 * s, 0); flags.push(flag);
    const tag = label(I.locked ? '🔒' : '★', { size: 120, fill: I.locked ? '#CBC8BF' : YEL }); tag.scale.set(14, 14, 1); tag.position.y = height(0, 0) * s + 34; tag.userData.island = info; clickables.push(tag); g.add(tag);
    if (I.locked){ Object.assign(NEXT, { flag, tag, info }); for (let k = 0; k < 14; k++){ const a = k / 14 * Math.PI * 2; NEXT.clouds.push(cloud(x + Math.cos(a) * 34, 6 + rnd() * 14, z + Math.sin(a) * 34, 2.4 + rnd())); } }
  });

  // ---------- stars at night ----------
  const starG = new THREE.BufferGeometry(); const sp = [];
  for (let n = 0; n < 900; n++){ const a = rnd() * Math.PI * 2, b = rnd() * Math.PI * .45 + .05; sp.push(Math.cos(a) * Math.cos(b) * 800, Math.sin(b) * 800, Math.sin(a) * Math.cos(b) * 800); }
  starG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starG, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false }));
  scene.add(stars);

  // ---------- the player's pin and the ring on the current level ----------
  const pin = new THREE.Group();
  { const cone = new THREE.Mesh(new THREE.ConeGeometry(.75, 1.9, 24), glossy(YEL)); cone.rotation.x = Math.PI; cone.position.y = .95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.05, 28, 16), glossy(YEL)); head.position.y = 2.2;
    const face = new THREE.Mesh(new THREE.SphereGeometry(.55, 20, 12), STD(INK, { roughness: .4 })); face.position.set(0, 2.25, .62); face.scale.z = .4;
    [cone, head, face].forEach((m) => { m.castShadow = true; pin.add(m); }); scene.add(pin); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, .16, 10, 48), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .8 }));
  ring.rotation.x = Math.PI / 2; scene.add(ring);
  let pinAnim = null, walked = null, current = 0;
  const lvlAt = (i) => LEVELS[Math.max(0, Math.min(6, i))];
  function placePin(){
    const L = lvlAt(current);
    pin.position.set(L.pos.x, L.pos.y + 6.9, L.pos.z);
    ring.position.set(L.pos.x, L.pos.y + 1.2, L.pos.z); ring.visible = current <= 6; ring.material.color.copy(C(L.color));
  }

  // ---------- camera: drag to orbit, wheel / pinch to zoom ----------
  const cam = { yaw: 2.2, pitch: .62, dist: 260, target: new THREE.Vector3(0, 6, 0) };
  const goal = { yaw: 2.2, pitch: .62, dist: teaser ? 92 : 88, target: new THREE.Vector3(0, teaser ? 7 : 6, 0) };
  let lastInput = performance.now(), auto = true;
  const clampDist = (d) => Math.min(240, Math.max(14, d));
  const yawTo = (p) => Math.atan2(p.x, p.z);
  function flyTo(pos, dist, pitch, yaw){ goal.target.copy(pos); goal.dist = dist; if (pitch !== undefined) goal.pitch = pitch; if (yaw !== undefined) goal.yaw = yaw; auto = false; lastInput = performance.now(); }
  const ptrs = new Map(); let moved = 0, pinchD = 0;
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  function tap(x, y){
    const r = canvas.getBoundingClientRect();
    mouse.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects(clickables, false)[0]; if (!hit) return;
    const u = hit.object.userData;
    if (typeof u.level === 'number') opts.onLevel?.(u.level);
    else if (u.island) opts.onIsland?.(u.island);
  }
  // homepage preview: only a real tap counts (not a scroll or a drag), and React asks before entering
  let tdown = null;
  if (teaser){
    on(canvas, 'pointerdown', (e) => { tdown = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    on(canvas, 'pointerup', (e) => {
      const d = tdown; tdown = null;
      if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8 && performance.now() - d.t < 600) opts.onEnter?.();
    });
    on(canvas, 'pointercancel', () => { tdown = null; });
  }
  if (!teaser) on(canvas, 'pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) moved = 0;
    if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); }
    canvas.style.cursor = 'grabbing'; lastInput = performance.now(); auto = false; opts.onInput?.();
  });
  if (!teaser) on(canvas, 'pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2){ const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinchD) goal.dist = clampDist(goal.dist * pinchD / d); pinchD = d; moved = 99; return; }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y; moved += Math.abs(dx) + Math.abs(dy);
    goal.yaw -= dx * .006; goal.pitch = Math.min(1.35, Math.max(.18, goal.pitch + dy * .004)); lastInput = performance.now();
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinchD = 0; if (!ptrs.size){ canvas.style.cursor = ''; if (moved < 7 && e.type === 'pointerup') tap(e.clientX, e.clientY); } };
  if (!teaser){ on(canvas, 'pointerup', up); on(canvas, 'pointercancel', up); }
  if (!teaser) on(canvas, 'wheel', (e) => { e.preventDefault(); goal.dist = clampDist(goal.dist * Math.exp(e.deltaY * .0012)); lastInput = performance.now(); auto = false; opts.onInput?.(); }, { passive: false });

  // ---------- size ----------
  function resize(){ const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(canvas); resize();

  // ---------- day / night ----------
  function setNight(n){
    skyU.top.value.set(n ? '#05070f' : '#3f8fe0'); skyU.mid.value.set(n ? '#1A1A18' : '#bfe3ff'); skyU.bot.value.set(n ? '#2A2926' : '#fff4d6');
    scene.fog.color.set(n ? '#14141a' : '#cfe8ff');
    hemi.intensity = n ? .9 : 2.3; sun.intensity = n ? 1.1 : 4.6; sun.color.set(n ? '#9fb4ff' : '#fff2d6');
    sunBall.material.color.set(n ? '#e8ecff' : '#fff3b0'); sunBall.scale.setScalar(n ? .6 : 1);
    stars.material.opacity = n ? .9 : 0; glowMats.forEach((m) => { m.emissiveIntensity = n ? 1.6 : .1; });
    sea.material.color.set(n ? '#163a6e' : '#2F7DE1');
  }

  // ---------- animate ----------
  const clock = new THREE.Clock(); const tmp = new THREE.Vector3();
  let busT = 0, raf = 0, paused = false;
  function frame(){
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
    if (paused) return;
    if (teaser) goal.yaw += dt * .09;
    else if (auto || performance.now() - lastInput > 9000) goal.yaw += dt * .06;
    const k = 1 - Math.pow(.0025, dt);
    cam.yaw += (goal.yaw - cam.yaw) * k; cam.pitch += (goal.pitch - cam.pitch) * k; cam.dist += (goal.dist - cam.dist) * k; cam.target.lerp(goal.target, k);
    camera.position.set(cam.target.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, cam.target.y + Math.sin(cam.pitch) * cam.dist, cam.target.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    const floor = height(camera.position.x, camera.position.z) + 3; if (camera.position.y < floor) camera.position.y = floor;
    camera.lookAt(cam.target);

    const pa = seaG.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3){ const x = seaBase[i], z = seaBase[i + 2]; pa[i + 1] = Math.sin(x * .05 + t * 1.2) * .35 + Math.cos(z * .06 + t) * .3; }
    seaG.attributes.position.needsUpdate = true; if (!teaser) seaG.computeVertexNormals();
    foam.material.opacity = .25 + Math.sin(t * 1.5) * .1;

    const now = performance.now();
    if (pinAnim){
      const e = Math.min(1, (now - pinAnim.t0) / pinAnim.dur), ee = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
      const p = ROAD[Math.round(pinAnim.a + (pinAnim.b - pinAnim.a) * ee)];
      pin.position.set(p.x, p.y + 6.9 + Math.abs(Math.sin(e * Math.PI * 5)) * 2.2, p.z); pin.rotation.y = t * 6;
      goal.target.set(p.x, p.y + 2, p.z);
      if (e >= 1){ const done = pinAnim.done; pinAnim = null; placePin(); done?.(); }
    } else { pin.position.y += (lvlAt(current).pos.y + 6.9 + Math.sin(t * 3) * .6 - pin.position.y) * .2; pin.rotation.y = t * 1.2; }
    { const s = 1 + ((t * .8) % 1) * .8; ring.scale.set(s, s, s); ring.material.opacity = .8 * (1 - ((t * .8) % 1)); }
    LEVELS.forEach((L) => {
      const u = L.group?.userData; if (!u) return;
      if (u.pop){ const e = Math.min(1, (now - u.pop) / 700); L.group.scale.setScalar(e < 1 ? 1 + Math.sin(e * Math.PI) * .6 : 1); if (e >= 1) u.pop = 0; }
      if (u.shake){ const e = (now - u.shake) / 300; L.group.position.x = L.pos.x + (e < 1 ? Math.sin(e * 30) * .4 : 0); if (e >= 1) u.shake = 0; }
    });
    spinners.forEach(([o, axis, speed]) => { o.rotation[axis] = t * speed; });
    scene.traverse((o) => {
      const u = o.userData;
      if (u.crown){ o.rotation.y = t * .8; o.position.y = 12 + Math.sin(t * 2) * .5; }
      if (u.blink) o.visible = Math.sin(t * 6) > -.3;
      if (u.flag){ const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++){ const x = p.getX(i); p.setZ(i, Math.sin(x * 3 + t * 6) * .15 * (x + 1)); } p.needsUpdate = true; }
    });
    clouds.forEach((c, i) => { c.position.x += Math.sin(i) * dt * .8; });
    busT = (busT + dt * .012) % 1; const bi = Math.floor(busT * 300) + 5, bp = ROAD[bi], bq = ROAD[bi + 1];
    bus.position.set(bp.x, bp.y + .35, bp.z); bus.lookAt(bq.x, bq.y + .35, bq.z);

    // the HTML "▶ Play" tag over the current level
    const co = opts.callout;
    if (co){
      const L = lvlAt(current); tmp.set(L.pos.x, L.pos.y + 9.5, L.pos.z).project(camera);
      const vis = !opts.hideCallout?.() && current <= 6 && !pinAnim && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1 && cam.dist < 140;
      co.style.opacity = vis ? '1' : '0'; co.style.pointerEvents = vis ? 'auto' : 'none';
      co.style.transform = `translate(${(tmp.x * .5 + .5) * canvas.clientWidth}px, ${(-tmp.y * .5 + .5) * canvas.clientHeight}px) translate(-50%,-100%)`;
    }
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  // ---------- what React can call ----------
  return {
    /** stars = 7 numbers (0-3), in level order. hopFrom = the level the pin walks from. */
    setProgress(starsList, { hopFrom, onHopped } = {}){
      current = starsList.findIndex((s) => !s); if (current < 0) current = 7;
      LEVELS.forEach((L) => { L.stars = starsList[L.i] || 0; L.state = L.i < current ? 'done' : L.i === current ? 'now' : 'locked'; });
      LEVELS.forEach((L) => buildLevel(L, typeof hopFrom === 'number' && L.i === current && current !== hopFrom));
      if (walked) scene.remove(walked);
      walked = current > 0 ? ribbon(.9, .42, '#FFFFFF', .5, 0, lvlAt(current).k) : null;
      if (typeof hopFrom === 'number' && current <= 6 && current !== hopFrom){
        const N = lvlAt(current);
        pinAnim = { a: lvlAt(hopFrom).k, b: N.k, t0: performance.now(), dur: 1800, done: onHopped }; ring.visible = false;
        flyTo(new THREE.Vector3(N.pos.x, N.pos.y + 2, N.pos.z), 30, .55, yawTo(N.pos));
      } else placePin();
    },
    focusLevel(i, close = true){ const L = lvlAt(i); flyTo(new THREE.Vector3(L.pos.x, L.pos.y + 2, L.pos.z), close ? 17 : 26, close ? .48 : .55, yawTo(L.pos)); },
    focusCurrent(){ const L = lvlAt(current); flyTo(new THREE.Vector3(L.pos.x, L.pos.y + 2, L.pos.z), 26, .55, yawTo(L.pos)); },
    zoomOut(){ goal.dist = 40; goal.pitch = .6; },
    overview(){ flyTo(new THREE.Vector3(0, 0, -20), 330, 1.0); },
    shake(i){ const L = lvlAt(i); if (L.group) L.group.userData.shake = performance.now(); },
    unlockNext(){
      if (!NEXT.info) return;
      NEXT.info.locked = false;
      NEXT.flag.material.color.set(YEL); NEXT.tag.material.map = labelTex('★', { size: 120, fill: YEL }); NEXT.tag.material.needsUpdate = true;
      NEXT.clouds.forEach((c, k) => setTimeout(() => { c.visible = false; }, 400 + k * 120));
      flyTo(new THREE.Vector3(NEXT.info.x, 8, NEXT.info.z), 110, .55);
    },
    setNight,
    pause(p){ paused = !!p; },
    dispose(){
      cancelAnimationFrame(raf); ro.disconnect(); disposers.forEach((d) => d());
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => { x.map?.dispose(); x.emissiveMap?.dispose(); x.dispose(); }); });
      renderer.dispose(); renderer.forceContextLoss?.();
    },
  };
}
