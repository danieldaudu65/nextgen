import type { IconName } from '@/lib/types';
import { ICON_SPRITE } from './iconSprite';

// Render once in the layout; every <Icon> points at a symbol in it.
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs dangerouslySetInnerHTML={{ __html: ICON_SPRITE }} />
    </svg>
  );
}

export function Icon({ name, className, size }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} aria-hidden="true">
      <use href={`#i-${name}`} />
    </svg>
  );
}
