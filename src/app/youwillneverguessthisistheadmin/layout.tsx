import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — The Daily Athlete',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="dark" style={{ colorScheme: 'dark' }}>{children}</div>;
}
