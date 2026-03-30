import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, Calendar, TrendingUp, ArrowRight, Activity, Target, Bike, Waves, Clock, Smartphone, Flame, Sparkles } from 'lucide-react';
import { AuthRedirect } from '@/components/auth/AuthRedirect';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AuthRedirect />

      {/* Nav */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold text-lg">The Daily Athlete</span>
          </Link>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="text-foreground/70 hover:text-foreground text-sm px-3">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 border-0 text-sm px-4">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-red-900/8 rounded-full blur-[100px]" />
          </div>

          <div className="container mx-auto px-4 py-20 sm:py-28 md:py-36">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 dark:text-red-400 text-sm font-medium">
                <Flame className="h-4 w-4" />
                Free during early access
              </div>

              <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.08]">
                Your training,{' '}
                <span className="bg-gradient-to-r from-red-500 via-red-600 to-red-400 dark:from-red-400 dark:via-red-500 dark:to-red-300 bg-clip-text text-transparent">
                  all in one place
                </span>
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Track workouts across every sport, sync with Strava, and stay on top of your training — no coach required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg" className="h-13 px-8 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/25 border-0 font-semibold text-base">
                  <Link href="/register">
                    Start for free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-13 px-8 border-border text-foreground hover:bg-muted font-semibold text-base">
                  <Link href="/login">I have an account</Link>
                </Button>
              </div>

              <div className="flex justify-center items-center gap-3 pt-4 flex-wrap">
                {[
                  { icon: Activity, name: 'Running' },
                  { icon: Waves, name: 'Swimming' },
                  { icon: Bike, name: 'Cycling' },
                  { icon: Dumbbell, name: 'Strength' },
                  { icon: Target, name: 'Triathlon' },
                ].map((sport, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-sm text-muted-foreground">
                    <sport.icon className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                    {sport.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-20 border-y border-border bg-muted/30">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
              Get started in minutes
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { step: '1', title: 'Create your account', desc: 'Sign up free and set your sports and goals.' },
                { step: '2', title: 'Connect Strava', desc: 'Link your watch so workouts sync automatically.' },
                { step: '3', title: 'Train & improve', desc: 'Log sessions, track PRs, and build consistency.' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-11 h-11 rounded-full bg-red-600/15 border border-red-600/30 flex items-center justify-center mx-auto mb-4">
                    <span className="text-sm font-bold text-red-500 dark:text-red-400">{item.step}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-1.5">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
              Everything you need to train smarter
            </h2>
            <p className="text-muted-foreground text-center mb-12 max-w-md mx-auto">
              Simple tools that help you stay consistent and see progress.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                { icon: Activity, title: 'Strava Sync', desc: 'Workouts auto-complete when you train. Garmin, Apple Watch, or any Strava device.' },
                { icon: Calendar, title: 'Visual Calendar', desc: 'See your whole week at a glance. Plan ahead and never miss a session.' },
                { icon: TrendingUp, title: 'Progress Tracking', desc: 'Track personal records, view trends, and watch your fitness build over time.' },
                { icon: Sparkles, title: 'AI Coach', desc: 'Get personalized workout suggestions based on your history and goals.' },
                { icon: Smartphone, title: 'Multi-Sport', desc: 'Running, swimming, cycling, strength — all your training in one app.' },
                { icon: Clock, title: 'Email Reminders', desc: 'Get notified about upcoming workouts so you stay on track.' },
              ].map((feature, i) => (
                <div key={i} className="group p-6 rounded-2xl border border-border bg-card hover:border-red-500/25 transition-colors">
                  <div className="p-2.5 rounded-xl bg-red-600/10 w-fit mb-4 group-hover:bg-red-600/15 transition-colors">
                    <feature.icon className="h-5 w-5 text-red-500 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-base mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="py-20 border-t border-border bg-muted/30 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-red-600/8 rounded-full blur-[100px]" />
          </div>
          <div className="container mx-auto px-4 max-w-xl text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to start training?
            </h2>
            <p className="text-muted-foreground text-lg">
              Join athletes who track every session. Free to use, no credit card.
            </p>
            <Button asChild size="lg" className="h-13 px-10 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/25 border-0 font-semibold text-lg">
              <Link href="/register">
                Get started free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="border-t border-border py-8 bg-background"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground/70">
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
