// Make big photos small before uploading: phone photos are often 5–15 MB, but the site never shows
// them bigger than ~2400px. Pictures already small (or GIFs, which may be animated) are sent as they are.
const MAX_SIDE = 2400;
const SMALL_ENOUGH = 1.5 * 1024 * 1024;

export async function shrinkImage(file: File): Promise<File> {
  if (typeof window === 'undefined' || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH) { bitmap.close?.(); return file; }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    // PNG may have see-through parts (logos): keep them with WEBP; photos become JPEG
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[a-z0-9]+$/i, '') + (type === 'image/jpeg' ? '.jpg' : '.webp');
    return new File([blob], name, { type, lastModified: Date.now() });
  } catch {
    return file; // older browser: send the original, the server still checks the size
  }
}
