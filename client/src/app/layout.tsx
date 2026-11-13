import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Josefin_Sans } from 'next/font/google';
import './globals.css';
import { IconSprite } from '@/components/Icon';
import { themeInitScript } from '@/components/ThemeToggle';
import SiteChrome from '@/components/SiteChrome';

const josefinSans = Josefin_Sans({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--font-josefin', display: 'swap' });
// Body text font, same as punchnextgen.com (headings stay Josefin Sans)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

// Live site address, used to build full links for share previews (WhatsApp, X, Facebook…)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://punchnextgen.com';
const DESCRIPTION = "News & interactive learning for Nigeria's next generation. Read the edition, play the games, climb the leaderboard.";

// Favicon and app icons come from app/favicon.ico, app/icon.png and app/apple-icon.png
// (Next.js adds the tags automatically). The share image is public/brand/og-image.jpg.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Punch NextGen · Tap in. Level up.', template: '%s' },
  description: DESCRIPTION,
  applicationName: 'Punch NextGen',
  openGraph: {
    type: 'website',
    siteName: 'Punch NextGen',
    title: 'Punch NextGen · Tap in. Level up.',
    description: DESCRIPTION,
    url: '/',
    locale: 'en_NG',
    images: [{ url: '/brand/og-image.jpg', width: 1200, height: 630, alt: 'Punch NextGen: Tap in, level up' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Punch NextGen · Tap in. Level up.',
    description: DESCRIPTION,
    images: ['/brand/og-image.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#1A1A18' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${josefinSans.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <IconSprite />
        {/* Public pages get the menu + footer; /admin pages get the admin sidebar instead */}
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
