// PDFs for "Snap the pages" in the story editor (pdf.js, all in the browser).
// Each PDF page becomes a page picture (for the thumbnail and for cutting out pictures), and:
//  - a PDF made from the design file (Canva, InDesign, Illustrator…) has real text: it is copied out exactly,
//    with the positions of its pictures and its main colour, so no AI has to read it.
//  - a PDF that is only a photo or scan of the print (no text inside) goes to the photo reader like a photo.

import { loadPage, type PagePhoto } from './pagePhotos';

type PdfJs = typeof import('pdfjs-dist');
let lib: Promise<PdfJs> | null = null;
function pdfjs(): Promise<PdfJs> {
  if (!lib) {
    lib = import('pdfjs-dist').then((m) => {
      try {
        m.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
      } catch {
        m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      }
      return m;
    });
  }
  return lib;
}

const RENDER_SIDE = 2200; // px, the longest side of each page picture
const MIN_TEXT = 60;      // characters on a page before it counts as a "real text" page

type Box = [number, number, number, number];
export type PdfPicture = { box: Box; role: 'cover' | 'inline'; caption: string };

type TextItem = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };

/** The page's words in reading order, with blank lines between paragraphs and "## " on big headings */
function pageText(items: TextItem[]): string {
  type Line = { text: string; size: number };
  const lines: Line[] = [];
  const breaks = new Set<number>(); // a blank line before this line
  let cur = '', size = 0, lastY: number | null = null, lastSize = 0;
  const flush = () => { const t = cur.replace(/\s+/g, ' ').trim(); if (t) lines.push({ text: t, size }); cur = ''; size = 0; };
  for (const it of items) {
    const s = Math.hypot(it.transform[0], it.transform[1]) || it.height || 10;
    const y = it.transform[5];
    if (lastY !== null && it.str.trim()) {
      const gap = lastY - y; // PDF y grows upwards
      if (Math.abs(gap) > Math.max(s, lastSize) * 0.55) {
        flush();
        // a big step down, a jump back up (next column or box) or a change of text size → new paragraph
        if (gap > Math.max(s, lastSize) * 1.75 || gap < -s || Math.abs(s - lastSize) > lastSize * 0.25) breaks.add(lines.length);
      }
    }
    if (it.str) { cur += (cur && !cur.endsWith(' ') && !it.str.startsWith(' ') ? ' ' : '') + it.str; size = Math.max(size, s); }
    if (it.str.trim()) { lastY = y; lastSize = s; }
    if (it.hasEOL) flush();
  }
  flush();
  if (!lines.length) return '';
  const sizes = lines.map((l) => l.size).sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)];
  const out: string[] = [];
  let para = '';
  const endPara = () => { if (para) out.push(para); para = ''; };
  lines.forEach((l, i) => {
    const heading = l.size >= body * 1.35 && l.text.length <= 90;
    const bullet = /^([•●▪◦\-–]|\d+[.)])\s*/.test(l.text);
    if (breaks.has(i) || heading || bullet) endPara();
    if (heading) { out.push(`## ${l.text}`); return; }
    if (bullet) { out.push(l.text.replace(/^[•●▪◦\-–]\s*/, '- ')); return; }
    // join the lines of one paragraph; "infor-" + "mation" → "information"
    para = para ? (para.endsWith('-') && /^[a-z]/.test(l.text) ? para.slice(0, -1) + l.text : `${para} ${l.text}`) : l.text;
  });
  endPara();
  return out.join('\n\n');
}

/** Where the pictures sit on the page (from the PDF's drawing steps), as fractions of the page */
async function pagePictures(page: import('pdfjs-dist').PDFPageProxy, m: PdfJs): Promise<Box[]> {
  const ops = await page.getOperatorList();
  const vp = page.getViewport({ scale: 1 });
  const { OPS } = m;
  // matrix × matrix (our own: pdf.js changes its helpers between versions)
  const mul = (a: number[], b: number[]) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  let ctm: number[] = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const boxes: Box[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as number[]);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm); if (Array.isArray(args?.[0])) ctm = mul(ctm, args[0] as number[]); }
    else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageXObjectRepeat) {
      // an image is drawn into the unit square, moved into place by the current transform
      const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => [x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]]);
      const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
      // PDF points → page points (top-left origin) with the viewport's own matrix
      const vt = vp.transform;
      const toView = (x: number, y: number) => [x * vt[0] + y * vt[2] + vt[4], x * vt[1] + y * vt[3] + vt[5]];
      const [x1, y1] = toView(Math.min(...xs), Math.min(...ys));
      const [x2, y2] = toView(Math.max(...xs), Math.max(...ys));
      const left = Math.max(0, Math.min(x1, x2) / vp.width), top = Math.max(0, Math.min(y1, y2) / vp.height);
      const w = Math.min(1 - left, Math.abs(x2 - x1) / vp.width), h = Math.min(1 - top, Math.abs(y2 - y1) / vp.height);
      boxes.push([left, top, w, h]);
    }
  }
  return boxes;
}

/** The page's main bold colour (most common strongly coloured pixels), as #RRGGBB */
function mainColour(canvas: HTMLCanvasElement): string | null {
  const small = document.createElement('canvas');
  const k = 96 / Math.max(canvas.width, canvas.height);
  small.width = Math.max(1, Math.round(canvas.width * k)); small.height = Math.max(1, Math.round(canvas.height * k));
  const ctx = small.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  const { data } = ctx.getImageData(0, 0, small.width, small.height);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 60 || max - min < 70) continue; // skip dark, grey, white and paper colours
    const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
    const o = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    o.n++; o.r += r; o.g += g; o.b += b;
    buckets.set(key, o);
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const o of buckets.values()) if (!best || o.n > best.n) best = o;
  if (!best || best.n < 6) return null;
  const hex = (v: number) => Math.round(v / best!.n).toString(16).padStart(2, '0');
  return `#${hex(best.r)}${hex(best.g)}${hex(best.b)}`.toUpperCase();
}

/**
 * Turn a PDF into page pictures for "Snap the pages" (at most `max` pages).
 * Pages with real text carry it (and their pictures and colour), so they need no AI reading.
 */
export async function pdfToPages(file: File, max: number): Promise<{ pages: PagePhoto[]; total: number }> {
  const m = await pdfjs();
  // pdf.js 6: the loading task (not the document) is what gets closed at the end
  const task = m.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const total = doc.numPages;
  const pages: PagePhoto[] = [];
  const base = file.name.replace(/\.pdf$/i, '');
  try {
    for (let n = 1; n <= Math.min(doc.numPages, max); n++) {
      const page = await doc.getPage(n);
      const one = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, RENDER_SIDE / Math.max(one.width, one.height)) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;

      // (the list also holds marked-content markers with no text or position: skip those)
      const text = pageText(((await page.getTextContent()).items as Partial<TextItem>[]).filter((it): it is TextItem => typeof it.str === 'string' && Array.isArray(it.transform)));
      const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error('Could not read the PDF page'))), 'image/jpeg', 0.9));
      const photo = await loadPage(new File([blob], `${base}-page-${n}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));

      if (text.replace(/\s/g, '').length >= MIN_TEXT) {
        // a page from the design file: exact text, its own pictures (not background art filling the page) and colour
        const boxes = (await pagePictures(page, m))
          .filter(([, , w, h]) => w >= 0.08 && h >= 0.06 && w * h < 0.85)
          .sort((a, b) => b[2] * b[3] - a[2] * a[3])
          .slice(0, 8);
        photo.pdf = {
          text,
          accent: mainColour(canvas),
          pictures: boxes.map((box, k) => ({ box: box.map((v) => Math.round(v * 1000) / 1000) as Box, role: k === 0 ? 'cover' : 'inline', caption: '' })),
        };
      } else {
        photo.pdf = { scan: true };
      }
      photo.label = doc.numPages > 1 ? `${base} · page ${n}` : base;
      pages.push(photo);
      (page as unknown as { cleanup?: () => void }).cleanup?.();
    }
  } finally {
    await task.destroy();
  }
  return { pages, total };
}
