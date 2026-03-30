import { RegisterForm } from '@/components/auth/RegisterForm';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { Dumbbell, Activity, Waves, Bike, Target, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-red-500/15 dark:bg-red-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-400/10 dark:bg-red-900/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-red-400/10 dark:bg-red-800/8 rounded-full blur-[90px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      {/* Floating sport icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
        <div className="absolute top-[12%] right-[10%] w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/10 flex items-center justify-center rotate-[10deg]">
          <Activity className="h-5 w-5 text-orange-400/50" />
        </div>
        <div className="absolute top-[35%] left-[7%] w-12 h-12 rounded-2xl bg-blue-500/10 dark:bg-blue-500/5 border border-blue-500/10 flex items-center justify-center rotate-[-12deg]">
          <Waves className="h-5 w-5 text-blue-400/50" />
        </div>
        <div className="absolute bottom-[15%] right-[9%] w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center rotate-[-6deg]">
          <Bike className="h-5 w-5 text-emerald-400/50" />
        </div>
        <div className="absolute bottom-[25%] left-[12%] w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/5 border border-purple-500/10 flex items-center justify-center rotate-[12deg]">
          <Dumbbell className="h-5 w-5 text-purple-400/50" />
        </div>
        <div className="absolute top-[65%] right-[18%] w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/10 flex items-center justify-center rotate-[-10deg]">
          <Target className="h-5 w-5 text-amber-400/50" />
        </div>
        <div className="absolute top-[18%] left-[15%] w-12 h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/5 border border-rose-500/10 flex items-center justify-center rotate-[6deg]">
          <Sparkles className="h-5 w-5 text-rose-400/50" />
        </div>
      </div>

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <RegisterForm />
    </div>
  );
}
