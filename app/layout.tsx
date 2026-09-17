import type { Metadata } from 'next';
import './globals.css';
import './live-arena.css';

export const metadata: Metadata = {
  title: 'Will You Be My Hero? — Arena',
  description:
    'Illustrated paper cutouts. Automatic backyard sports. Pick your cards and settle it on the court.',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/assets/arena-interface.css" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
