import type { MetadataRoute } from 'next';

// "Add to home screen" details for phones (served at /manifest.webmanifest)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Punch NextGen',
    short_name: 'NextGen',
    description: "News & interactive learning for Nigeria's next generation.",
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#0A0A0A',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
