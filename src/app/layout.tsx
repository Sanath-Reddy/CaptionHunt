import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'CaptionHunt', template: '%s | CaptionHunt' },
  description: 'Search YouTube video transcripts with AI-powered hybrid search. Find any moment across multiple channels by topic, keyword, or meaning.',
  keywords: ['youtube', 'transcript search', 'caption search', 'video search', 'AI search'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
