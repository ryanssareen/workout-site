import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, Calendar, TrendingUp, ArrowRight, Activity, Target, Bike, Waves, Smartphone, Flame, Sparkles } from 'lucide-react';
import { AuthRedirect } from '@/components/auth/AuthRedirect';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthRedirect />

      {/* Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold text-base sm:text-lg">The Daily Athlete</span>
          </Link>
          <div className="flex gap-1.5 sm:gap-2 items-center">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="text-foreground/70 hover:text-foreground hover:bg-muted text-xs sm:text-sm px-2 sm:px-3">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 border-0 text-xs sm:text-sm px-2.5 sm:px-3">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))' }}>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-red-900/8 rounded-full blur-[100px]" />
          </div>

          <div className="container mx-auto px-4 py-16 sm:py-24 md:py-32">
            <div className="max-w-2xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 dark:text-red-400 text-sm font-medium">
                <Flame className="h-3.5 w-3.5" />
                Free during early access
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1]">
                Your training,{' '}
                <span className="bg-gradient-to-r from-red-500 via-red-600 to-red-400 dark:from-red-400 dark:via-red-500 dark:to-red-300 bg-clip-text text-transparent">
                  simplified
                </span>
              </h1>

              <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
                Track workouts, sync with Strava, and stay on top of your training — no coach required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg" className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/25 border-0 font-semibold">
                  <Link href="/register">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-8 border-border text-foreground hover:bg-muted font-semibold">
                  <Link href="/login">I have an account</Link>
                </Button>
              </div>

              <div className="flex justify-center items-center gap-2.5 pt-2 flex-wrap">
                {[
                  { icon: Activity, name: 'Running' },
                  { icon: Waves, name: 'Swimming' },
                  { icon: Bike, name: 'Cycling' },
                  { icon: Dumbbell, name: 'Strength' },
                  { icon: Target, name: 'Triathlon' },
                ].map((sport, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/50 text-xs text-muted-foreground">
                    <sport.icon className="h-3 w-3 text-red-500 dark:text-red-400" />
                    {sport.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features — compact grid */}
        <section className="py-16 md:py-20 border-t border-border">
          <div className="container mx-auto px-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {[
                { icon: Activity, title: 'Strava Sync', desc: 'Auto-sync from Garmin, Apple Watch, or any Strava device.' },
                { icon: Calendar, title: 'Visual Calendar', desc: 'Plan your week and never miss a session.' },
                { icon: TrendingUp, title: 'Track Progress', desc: 'PRs, trends, and streaks over time.' },
                { icon: Sparkles, title: 'AI Coach', desc: 'Smart suggestions based on your training.' },
              ].map((feature, i) => (
                <div key={i} className="p-4 rounded-xl border border-border bg-card hover:border-red-500/20 transition-colors">
                  <div className="p-1.5 rounded-lg bg-red-600/10 w-fit mb-2.5">
                    <feature.icon className="h-4 w-4 text-red-500 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-center items-center gap-6 mt-10 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-red-400" />
                Multi-sport
              </div>
              <span className="text-border">|</span>
              <span>Email reminders</span>
              <span className="text-border">|</span>
              <span>No credit card</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-border py-6 bg-background"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
              <Dumbbell className="h-3.5 w-3.5 text-background" />
            </div>
            <span className="font-bold text-sm">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
            <Link href="/contact" className="hover:text-muted-foreground transition-colors">Contact</Link>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
