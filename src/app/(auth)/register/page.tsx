import { RegisterForm } from '@/components/auth/RegisterForm';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import { Dumbbell, Activity, Waves, Bike, TrendingUp, Calendar, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — branded panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-red-600 via-red-700 to-red-900 items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-white/5 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-black/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] bg-orange-500/10 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
            <Dumbbell className="h-7 w-7 text-white" />
          </div>

          <h2 className="text-4xl font-black text-white leading-tight">
            Start your<br />
            training journey.
          </h2>

          <p className="text-lg text-white/70 leading-relaxed">
            Free during early access. Track every workout, sync your watch, and see real progress.
          </p>

          <div className="space-y-3 pt-4">
            {[
              { icon: Activity, text: 'Log workouts across 5+ sports' },
              { icon: Waves, text: 'Auto-sync with Strava & wearables' },
              { icon: TrendingUp, text: 'Track PRs and weekly trends' },
              { icon: Calendar, text: 'Visual calendar to plan ahead' },
              { icon: Sparkles, text: 'AI-powered workout suggestions' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                <item.icon className="h-4.5 w-4.5 text-white/80 shrink-0" />
                <span className="text-sm font-medium text-white/80">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
        </div>

        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <RegisterForm />
      </div>
    </div>
  );
}
