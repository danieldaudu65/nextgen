/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';

// The Punch NextGen logo (files in public/brand/).
// - nextgen-logo-ink.png: dark version, for light backgrounds
// - nextgen-logo.png:     yellow version (the original), for dark backgrounds
// The right one shows automatically for light/dark mode. Pass onDark when the logo
// always sits on a dark background (footer, admin sidebar, login art).
export function Logo({ onDark = false, href = '/', size = 'md' }: { onDark?: boolean; href?: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <Link className={`logo logo-${size}${onDark ? ' logo-on-dark' : ''}`} href={href} aria-label="Punch NextGen home">
      <img className="logo-img logo-ink" src="/brand/nextgen-logo-ink.png" alt="Punch NextGen" width={860} height={431} />
      <img className="logo-img logo-yellow" src="/brand/nextgen-logo.png" alt="" aria-hidden="true" width={860} height={431} />
    </Link>
  );
}

export default Logo;
