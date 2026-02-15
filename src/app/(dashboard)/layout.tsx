'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Navbar } from '@/components/dashboard/Navbar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const isReports = pathname === '/reports';

  return (
    <div className="min-h-screen relative overflow-hidden bg-background text-foreground">
      <div className="absolute inset-0 bg-energy -z-10 pointer-events-none" aria-hidden />
      <Navbar />
      <main className={`relative container mx-auto px-3 sm:px-4 py-4 sm:py-8 ${isReports ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        <div className={`panel-glow rounded-2xl sm:rounded-3xl ${isReports ? 'p-3 sm:p-4 md:p-6' : 'p-4 sm:p-6 md:p-8'}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
