import type { CSSProperties } from 'react';

// A story's colour (set from the printed page, see Admin → story → Story colour).
// The story page uses it for callout boxes, bullets, highlights and heading icons.

/** Black or white text, whichever reads better on this colour */
export function textOn(hex: string): '#0A0A0A' | '#FFFFFF' {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (lum + 0.05) / 0.05 > 1.05 / (lum + 0.05) ? '#0A0A0A' : '#FFFFFF';
}

/** CSS variables for a story wrapper; nothing when the story has no colour (the normal yellow look) */
export function accentVars(hex?: string | null): CSSProperties | undefined {
  if (!hex || !/^#[0-9A-F]{6}$/i.test(hex)) return undefined;
  return { '--story-accent': hex, '--story-on-accent': textOn(hex) } as CSSProperties;
}
