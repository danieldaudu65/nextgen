// Reads a picture's colours in the browser (on a tiny 64px copy) so the homepage hero can blend
// into each picture instead of using one fixed colour.
//   edge   → average colour of the picture's left side (what the black fades into)
//   glow   → its strongest bright colour (big soft glow)
//   glow2  → its second colour (smaller glow)
// Needs the picture to allow cross-origin reading (Cloudinary and our own /uploads do); otherwise null.
export interface Palette { edge: string; glow: string; glow2: string }

const cache = new Map<string, Palette | null>();

const rgb = (r: number, g: number, b: number) => `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;

function hsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

// Brighten a dull colour a little so the glow reads on black (keeps its hue)
function lift(r: number, g: number, b: number, minL = 0.5) {
  const { l } = hsl(r, g, b);
  if (l >= minL || l === 0) return [r, g, b];
  const k = minL / l;
  return [Math.min(255, r * k), Math.min(255, g * k), Math.min(255, b * k)];
}

export function readPalette(src: string): Promise<Palette | null> {
  if (cache.has(src)) return Promise.resolve(cache.get(src) ?? null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const W = 64, H = Math.max(8, Math.round((64 * img.naturalHeight) / Math.max(1, img.naturalWidth)));
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('no canvas');
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;

        // left side (first 12% of the width)
        let er = 0, eg = 0, eb = 0, en = 0;
        // hue buckets for the bright colours
        const bins = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const i = (y * W + x) * 4;
            const r = px[i], g = px[i + 1], b = px[i + 2], a = px[i + 3];
            if (a < 128) continue;
            if (x < W * 0.12) { er += r; eg += g; eb += b; en++; }
            const { h, s, l } = hsl(r, g, b);
            if (s < 0.3 || l < 0.18 || l > 0.85) continue;
            const w = s * (1 - Math.abs(l - 0.5));
            const bin = bins[Math.floor(h / 30) % 12];
            bin.w += w; bin.r += r * w; bin.g += g * w; bin.b += b * w;
          }
        }
        const ranked = bins.filter((b) => b.w > 0).sort((a, b) => b.w - a.w);
        const pick = (b?: { w: number; r: number; g: number; b: number }) => (b ? lift(b.r / b.w, b.g / b.w, b.b / b.w) : null);
        const g1 = pick(ranked[0]) ?? [255, 165, 43];
        // second colour: a different hue if the picture has one, else a warmer version of the first
        const g2 = pick(ranked.find((b, i) => i > 0 && b.w > ranked[0].w * 0.15)) ?? [Math.min(255, g1[0] * 1.1), g1[1] * 0.7, g1[2] * 0.5];
        const edge = en ? rgb(er / en, eg / en, eb / en) : 'rgb(7, 7, 10)';
        const out = { edge, glow: rgb(g1[0], g1[1], g1[2]), glow2: rgb(g2[0], g2[1], g2[2]) };
        cache.set(src, out);
        resolve(out);
      } catch {
        cache.set(src, null); // picture can't be read (no cross-origin permission): keep the default colours
        resolve(null);
      }
    };
    img.onerror = () => { cache.set(src, null); resolve(null); };
    img.src = src;
  });
}
