'use client';

import { useRouter, usePathname } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { Dumbbell, LogOut, LayoutDashboard, Calendar as CalendarIcon, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/workouts', label: 'Workouts', icon: ListChecks },
    { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl hidden sm:inline">Workout Tracker</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    className={cn(
                      "gap-2",
                      isActive && "shadow-sm"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden md:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* User Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-sm font-medium">{user?.displayName}</span>
              <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
            </div>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
