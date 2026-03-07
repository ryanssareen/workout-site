'use client';

import { useRouter, usePathname } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { useStravaSyncStore } from '@/lib/stores/stravaSyncStore';
import { Dumbbell, LogOut, LayoutDashboard, Calendar as CalendarIcon, ListChecks, BarChart3, UserCircle, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const syncStatus = useStravaSyncStore((s) => s.status);

  const handleLogout = async () => { await signOut(); router.push('/login'); };

  const navItems = useMemo(() => [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/workouts', label: 'Workouts', icon: ListChecks },
    { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
  ], []);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-card/95 backdrop-blur-lg shadow-sm pt-[env(safe-area-inset-top)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 rounded-xl bg-black flex items-center justify-center shadow-lg shadow-black/30">
              <Dumbbell className="h-4 w-4 text-white drop-shadow" />
            </div>
            <span className="font-bold text-lg hidden sm:inline">The Daily Athlete</span>
          </Link>

          <div className="hidden lg:flex items-center gap-1 bg-muted/60 rounded-xl p-1 border border-border/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}>
                  <Button variant="ghost" size="sm" className={cn('gap-2 h-9 rounded-lg transition-all text-sm', isActive ? 'bg-primary/15 text-primary border border-primary/40 shadow-sm' : 'text-foreground hover:bg-muted/80')}>
                    <Icon className="h-4 w-4" /><span className="text-sm">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-primary/5 border border-border/60">
                <div className="text-right">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role === 'student' ? 'athlete' : user.role || 'Athlete'}</p>
                </div>
                <Link href="/profile"><Button variant="ghost" size="icon" className="h-8 w-8"><UserCircle className="h-4 w-4" /></Button></Link>
                <Link href="/settings"><Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button></Link>
              </div>
            )}
            {syncStatus === 'syncing' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FC4C02]/10 border border-[#FC4C02]/20 text-[#FC4C02]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span className="text-xs font-medium hidden sm:inline">Syncing Strava...</span>
              </div>
            )}
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden md:flex h-9"><LogOut className="h-4 w-4 mr-2" />Logout</Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
