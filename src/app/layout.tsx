import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
export const metadata: Metadata = {
  title: {
    default: 'IZAK AI Reviews — Smarter Reviews. Stronger Reputation.',
    template: '%s | IZAK AI Reviews',
  },
  description:
    'Share your genuine experience with an authorized business using an AI-assisted review draft.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
