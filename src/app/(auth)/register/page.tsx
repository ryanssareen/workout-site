import { RegisterForm } from '@/components/auth/RegisterForm';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { Dumbbell } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-red-500/15 dark:bg-red-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-400/10 dark:bg-red-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-red-400/10 dark:bg-red-800/8 rounded-full blur-[90px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
            <Dumbbell className="h-4 w-4 text-background" />
          </div>
          <span className="font-bold text-lg">The Daily Athlete</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* Centered form */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <RegisterForm />

        {/* Social proof */}
        <div className="mt-10 flex flex-col items-center gap-4 max-w-md">
          <div className="flex -space-x-2">
            {['bg-red-400', 'bg-blue-400', 'bg-emerald-400', 'bg-purple-400', 'bg-orange-400'].map((color, i) => (
              <div key={i} className={`w-8 h-8 rounded-full ${color} border-2 border-background flex items-center justify-center text-[10px] font-bold text-white`}>
                {['R', 'K', 'M', 'J', 'S'][i]}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Join <span className="font-semibold text-foreground">500+</span> athletes already tracking their training
          </p>
          <div className="flex items-center gap-6 text-xs text-muted-foreground/60">
            <span>🏊 Swimming</span>
            <span>🏃 Running</span>
            <span>🚴 Cycling</span>
            <span>🏋️ Lifting</span>
          </div>
        </div>
      </div>
    </div>
  );
}
