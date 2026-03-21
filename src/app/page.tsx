import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, Calendar, TrendingUp, ArrowRight, Activity, Target, Bike, Waves, Clock, Smartphone, Flame, Sparkles } from 'lucide-react';
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

          <div className="container mx-auto px-4 py-16 sm:py-24 md:py-36">
            <div className="max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 dark:text-red-400 text-sm font-medium">
                <Flame className="h-3.5 w-3.5" />
                Free during early access
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight">
                Your training,{' '}
                <span className="bg-gradient-to-r from-red-500 via-red-600 to-red-400 dark:from-red-400 dark:via-red-500 dark:to-red-300 bg-clip-text text-transparent">
                  all in one place
                </span>
              </h1>

              <p className="text-base md:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
                Track workouts across every sport, sync with Strava, and stay on top of your training — no coach required.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
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

              {/* Sport pills */}
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

        {/* How it works */}
        <section className="py-20 md:py-24 border-y border-border bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-14">
              Get started in minutes
            </h2>
            <div className="grid md:grid-cols-3 gap-10 max-w-3xl mx-auto">
              {[
                { step: '1', title: 'Create your account', desc: 'Sign up free and pick your sports and goals.' },
                { step: '2', title: 'Connect Strava', desc: 'Link your watch so workouts sync automatically.' },
                { step: '3', title: 'Train & improve', desc: 'Log sessions, track PRs, and build consistency.' },
              ].map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-10 h-10 rounded-full bg-red-600/15 border border-red-600/30 flex items-center justify-center mx-auto mb-4">
                    <span className="text-sm font-bold text-red-500 dark:text-red-400">{item.step}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
              Everything you need to train smarter
            </h2>
            <p className="text-muted-foreground text-center mb-14 max-w-md mx-auto">
              Simple tools that help you stay consistent and see progress over time.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                { icon: Activity, title: 'Strava Sync', desc: 'Workouts auto-complete when you train. Garmin, Apple Watch, any Strava-connected device.' },
                { icon: Calendar, title: 'Visual Calendar', desc: 'See your whole week at a glance. Plan ahead and never miss a session.' },
                { icon: TrendingUp, title: 'Progress Tracking', desc: 'Track personal records, view trends, and watch your fitness build over time.' },
                { icon: Sparkles, title: 'AI Coach', desc: 'Get personalized workout suggestions based on your history and goals.' },
                { icon: Smartphone, title: 'Multi-Sport', desc: 'Running, swimming, cycling, strength — all your training in one app.' },
                { icon: Clock, title: 'Email Reminders', desc: 'Get notified about upcoming workouts so you never miss a planned session.' },
              ].map((feature, i) => (
                <div key={i} className="p-5 rounded-2xl border border-border bg-card hover:border-red-500/20 transition-colors">
                  <div className="p-2 rounded-lg bg-red-600/10 w-fit mb-3">
                    <feature.icon className="h-4.5 w-4.5 text-red-500 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 md:py-24 border-t border-border bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-14">
              Frequently asked questions
            </h2>
            <div className="grid sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
              {[
                { q: 'Is it really free?', a: 'Yes — completely free during early access. Paid plans will come later, and early users get the best deal.' },
                { q: 'Do I need a coach?', a: 'Nope. The Daily Athlete is built for self-coached athletes who want structure and accountability.' },
                { q: 'Does it work with my watch?', a: 'If your device syncs to Strava, your workouts will appear automatically.' },
                { q: 'What sports are supported?', a: 'Running, swimming, cycling, triathlon, and strength training.' },
              ].map((faq, i) => (
                <div key={i} className="p-5 rounded-2xl border border-border bg-card">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-red-600/8 rounded-full blur-[100px]" />
          </div>
          <div className="container mx-auto px-4 max-w-xl text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to start training?
            </h2>
            <p className="text-muted-foreground text-lg">
              Join athletes who track every session and build the habit. Free to use, no credit card needed.
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
          <div className="flex items-center gap-4">
            <Link href="/contact" className="text-sm text-muted-foreground/70 hover:text-muted-foreground transition-colors">Contact</Link>
            <p className="text-sm text-muted-foreground/70">&copy; {new Date().getFullYear()} The Daily Athlete</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
