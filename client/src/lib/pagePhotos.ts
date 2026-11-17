// Photos of printed pages for "Snap the pages" in the story editor.
// preparePage: a copy small enough to send to the AI (it reads text fine at ~1800px), as base64.
// cropPicture: cut a printed picture out of the ORIGINAL photo (full quality) using the box the AI found.

const SEND_SIDE = 1800;

async function bitmapOf(file: Blob): Promise<ImageBitmap> {
  // imageOrientation keeps phone photos the right way up
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { return createImageBitmap(file); }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read the photo'))), type, q));

const toBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]+,/, ''));
  r.onerror = () => reject(new Error('Could not read the photo'));
  r.readAsDataURL(blob);
});

export type PagePhoto = {
  id: string; file: File; preview: string; width: number; height: number;
  label?: string;
  // from a PDF: real text (with its pictures and colour) from the design file, or scan = only a picture of the print
  pdf?: { text?: string; accent?: string | null; pictures?: { box: [number, number, number, number]; role: 'cover' | 'inline'; caption: string }[]; scan?: boolean };
};

/** What one page sends to the server: a picture to read, or the exact text from a PDF */
export type PageForServer = { data: string; type: string } | { text: string; accent?: string | null; pictures?: NonNullable<PagePhoto['pdf']>['pictures'] };

/** Check a picked file and make a preview */
export async function loadPage(file: File): Promise<PagePhoto> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: use a JPG, PNG or WEBP photo`);
  const bmp = await bitmapOf(file);
  const out = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, preview: URL.createObjectURL(file), width: bmp.width, height: bmp.height };
  bmp.close?.();
  return out;
}

/** The copy that goes to the server: the exact text of a PDF page, or a JPEG (longest side 1800px) for the AI to read */
export async function pageForAI(page: PagePhoto): Promise<PageForServer> {
  if (page.pdf?.text) return { text: page.pdf.text, accent: page.pdf.accent, pictures: page.pdf.pictures };
  const bmp = await bitmapOf(page.file);
  const scale = Math.min(1, SEND_SIDE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // see-through PNGs become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  return { data: await toBase64(await toBlob(canvas, 'image/jpeg', 0.85)), type: 'image/jpeg' };
}

/** Cut one picture out of a page. box = [left, top, width, height] as fractions of the photo. */
export async function cropPicture(page: PagePhoto, box: [number, number, number, number], name = 'picture'): Promise<File> {
  const bmp = await bitmapOf(page.file);
  const [x, y, w, h] = box;
  // a little extra room so edges are not cut too tight
  const pad = 0.01;
  const sx = Math.max(0, (x - pad) * bmp.width), sy = Math.max(0, (y - pad) * bmp.height);
  const sw = Math.min(bmp.width - sx, (w + pad * 2) * bmp.width), sh = Math.min(bmp.height - sy, (h + pad * 2) * bmp.height);
  const scale = Math.min(1, 2000 / Math.max(sw, sh));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  canvas.getContext('2d')!.drawImage(bmp, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bmp.close?.();
  const blob = await toBlob(canvas, 'image/jpeg', 0.9);
  const safe = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'picture';
  return new File([blob], `${safe}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

export { textOn } from './storyAccent';

/** The site colours a story can use (same as the category colours) */
export const STORY_COLOURS: { hex: string; name: string }[] = [
  { hex: '#FFD400', name: 'Yellow' }, { hex: '#16A34A', name: 'Green' }, { hex: '#2563EB', name: 'Blue' },
  { hex: '#DB2777', name: 'Pink' }, { hex: '#FF8A00', name: 'Orange' }, { hex: '#7C3AED', name: 'Purple' },
  { hex: '#E11D2A', name: 'Red' }, { hex: '#0EA5E9', name: 'Sky' }, { hex: '#C2410C', name: 'Rust' },
];
