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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Daily Athlete',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  verification: {
    google: ['bBqx5L03X5a-nFB0y7-EXrcKf_znxlbfzlR5JunMQjg', 'BNFyHY449rHfrrlUMoZ5_jvjdQ9n33pX_ZgrTdk5hIc'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className={inter.className}>
        <ServiceWorkerRegister />
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
