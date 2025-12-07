'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { Dumbbell, LogOut } from 'lucide-react';

export function Navbar() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Dumbbell className="h-6 w-6" /><span className="font-bold text-xl">Workout Tracker</span></div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.displayName} ({user?.role})</span>
          <ThemeToggle />
          <Button variant="outline" size="sm" onClick={handleLogout}><LogOut className="h-4 w-4 mr-2" />Logout</Button>
        </div>
      </div>
    </nav>
  );
}
