import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'IM Status Hub — Momen singkat, tersimpan rapi.',
    template: '%s · IM Status Hub',
  },
  description:
    'Workspace pribadi untuk menerima Status WhatsApp yang tersedia, menyimpan media berizin, dan mengelola library Anda.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#163d35' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <a className="skip-link" href="#main">
          Lewati ke konten
        </a>
        {children}
      </body>
    </html>
  );
}
