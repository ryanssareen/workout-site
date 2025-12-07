'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { Navbar } from '@/components/dashboard/Navbar';
import { Loader2 } from 'lucide-react';

/**
 * Dashboard layout component
 * 
 * Authentication guard:
 * - Redirects unauthenticated users to /login
 * - Shows loading state during auth check
 * - Wraps all dashboard routes with consistent UI
 * 
 * Layout structure:
 * - Navbar: Fixed top navigation with user info + logout
 * - Main content: Scrollable area with container constraints
 * - Responsive padding and spacing
 * 
 * Auth state management:
 * - Reads from Zustand auth store
 * - Observes loading and user states
 * - Prevents flash of protected content
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null; // Redirecting
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  );
}
