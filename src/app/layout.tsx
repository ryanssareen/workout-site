import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'The Daily Athlete - Train Smarter. Every Day.',
  description: 'Your personal training companion. Track workouts, build discipline, and crush your goals.',
  verification: {
    google: ['bBqx5L03X5a-nFB0y7-EXrcKf_znxlbfzlR5JunMQjg', 'BNFyHY449rHfrrlUMoZ5_jvjdQ9n33pX_ZgrTdk5hIc'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
