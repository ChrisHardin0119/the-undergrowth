import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'THE UNDERGROWTH — A Roguelike Dungeon Crawler',
  description: 'Descend into bioluminescent caves. Fight, loot, survive. A browser-based roguelike.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
