import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'The Daily Athlete - Train Smarter. Every Day.',
  description: 'Your personal training companion. Track workouts, build discipline, and crush your goals.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Daily Athlete',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  verification: {
    google: ['bBqx5L03X5a-nFB0y7-EXrcKf_znxlbfzlR5JunMQjg', 'BNFyHY449rHfrrlUMoZ5_jvjdQ9n33pX_ZgrTdk5hIc'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ServiceWorkerRegister />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
