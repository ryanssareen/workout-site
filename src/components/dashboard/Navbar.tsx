'use client';

import { useRouter, usePathname } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/lib/stores/authStore';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './ThemeToggle';
import { Dumbbell, LogOut, LayoutDashboard, Calendar as CalendarIcon, ListChecks, Settings, Menu, X, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  const navItems = useMemo(() => [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/workouts', label: 'Workouts', icon: ListChecks },
    { href: '/calendar', label: 'Calendar', icon: CalendarIcon },
    { href: '/reports', label: 'Reports', icon: BarChart3 },
  ], []);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-xl shadow-[0_10px_50px_-30px_rgba(239,68,68,0.65)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <Dumbbell className="h-4 w-4 text-primary-foreground drop-shadow" />
            </div>
            <span className="font-bold text-lg hidden sm:inline">CoachTrack</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1 bg-muted/60 rounded-xl p-1 border border-border/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'gap-2 h-9 rounded-lg transition-all text-sm',
                      isActive
                        ? 'bg-primary/15 text-primary border border-primary/40 shadow-[0_10px_30px_-20px_rgba(239,68,68,0.8)]'
                        : 'text-foreground hover:bg-muted/80'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-3">
            {/* User Info - Desktop */}
            {user && (
              <div className="hidden md:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-primary/5 border border-border/60">
                <div className="text-right">
                  <p className="text-sm font-medium leading-none">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user.role === 'student' ? 'athlete' : user.role}</p>
                </div>
                <Link href="/settings">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}

            <ThemeToggle />
            
            {/* Logout - Desktop */}
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden md:flex h-9">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>

            {/* Mobile Menu Toggle */}
            <Button variant="ghost" size="sm" className="lg:hidden h-9 w-9 p-0" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileOpen && (
          <div className="lg:hidden pb-4 border-t mt-2 pt-4 animate-in slide-in-from-top-2 duration-200 border-border/60">
            <div className="grid grid-cols-4 gap-2 mb-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                    <div className={cn(
                      'flex flex-col items-center gap-1 p-3 rounded-xl transition-all border border-transparent',
                      isActive ? 'bg-primary/15 text-primary border-primary/40' : 'hover:bg-muted'
                    )}>
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-3 border-t">
              {user && (
                <>
                  <div className="flex items-center gap-2">
                    <Link href="/settings">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </Link>
                    <div>
                      <p className="text-sm font-medium">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{user.role === 'student' ? 'athlete' : user.role}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
