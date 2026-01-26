import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dumbbell, Users, Calendar, TrendingUp, ArrowRight, Activity, CheckCircle2, Target, Bike, Waves, Zap, Shield, Clock, UserCheck, ClipboardList, Bell, BarChart3, Smartphone, HelpCircle } from 'lucide-react';

export default function Home() {
  const forCoaches = [
    { icon: ClipboardList, text: 'Create and assign workouts to your athletes' },
    { icon: Calendar, text: 'Schedule training plans weeks in advance' },
    { icon: Bell, text: 'Automatic reminders sent to athletes' },
    { icon: BarChart3, text: 'Track completion rates and progress' },
  ];

  const forAthletes = [
    { icon: Smartphone, text: 'See your workouts in one place' },
    { icon: Activity, text: 'Auto-sync from Strava or Garmin' },
    { icon: CheckCircle2, text: 'Mark workouts complete with notes' },
    { icon: TrendingUp, text: 'Track personal records over time' },
  ];

  const features = [
    { icon: Users, title: 'Easy Connection', description: 'Coaches share a 6-letter code. Athletes enter it once. Done.' },
    { icon: Activity, title: 'Strava Sync', description: 'Connect Strava and your workouts auto-complete when you train.' },
    { icon: Clock, title: 'Smart Reminders', description: 'Athletes get email reminders 24 hours before scheduled workouts.' },
    { icon: Shield, title: 'Private & Secure', description: 'Only you and your coach can see your workout data.' },
  ];

  const sports = [
    { icon: Waves, name: 'Swimming', color: 'bg-blue-500' },
    { icon: Activity, name: 'Running', color: 'bg-emerald-500' },
    { icon: Bike, name: 'Cycling', color: 'bg-orange-500' },
    { icon: Dumbbell, name: 'Strength', color: 'bg-purple-500' },
  ];

  const faqs = [
    { q: 'Is CoachTrack free?', a: 'Yes! CoachTrack is completely free for coaches and athletes.' },
    { q: 'Do I need a coach to use this?', a: 'No. Athletes can use CoachTrack independently to track their own workouts and sync with Strava.' },
    { q: 'How do I connect with my coach?', a: 'Your coach will give you a 6-letter code. Enter it in Settings and you\'re connected instantly.' },
    { q: 'Does it work with Garmin/Apple Watch?', a: 'Yes! If your device syncs to Strava, it will automatically sync to CoachTrack.' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Dumbbell className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">CoachTrack</span>
          </Link>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="shadow-md shadow-primary/20">
              <Link href="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>

          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                100% Free Forever
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                Workout Planning
                <span className="block bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">Made Simple</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                CoachTrack helps coaches assign workouts and athletes track their training.
                Connect with Strava, get reminders, and never miss a workout.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button asChild size="lg" className="h-12 px-8 shadow-xl shadow-primary/25">
                  <Link href="/register">
                    Create Free Account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                No credit card required. Set up in under a minute.
              </p>
            </div>
          </div>
        </section>

        {/* Sports Icons */}
        <section className="py-8 border-y bg-muted/20">
          <div className="container mx-auto px-4">
            <div className="flex justify-center items-center gap-8 md:gap-12">
              <span className="text-sm text-muted-foreground hidden sm:block">Works for:</span>
              {sports.map((sport, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${sport.color} shadow-md`}>
                    <sport.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium hidden md:block">{sport.name}</span>
                </div>
              ))}
              <span className="text-sm text-muted-foreground">& more</span>
            </div>
          </div>
        </section>

        {/* Who is this for? */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Built for Coaches & Athletes</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Whether you coach others or train solo, CoachTrack keeps everyone on the same page.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* For Coaches */}
              <Card className="p-6 md:p-8 border-2 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-primary text-primary-foreground">
                    <UserCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">For Coaches</h3>
                    <p className="text-sm text-muted-foreground">Manage your athletes</p>
                  </div>
                </div>
                <ul className="space-y-4">
                  {forCoaches.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-primary/10 mt-0.5">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-6">
                  <Link href="/register">Sign Up as Coach</Link>
                </Button>
              </Card>

              {/* For Athletes */}
              <Card className="p-6 md:p-8 border-2 hover:border-purple-500/50 transition-colors">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-purple-500 text-white">
                    <Target className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">For Athletes</h3>
                    <p className="text-sm text-muted-foreground">Track your training</p>
                  </div>
                </div>
                <ul className="space-y-4">
                  {forAthletes.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 mt-0.5">
                        <item.icon className="h-4 w-4 text-purple-500" />
                      </div>
                      <span className="text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full mt-6 border-purple-500/50 hover:bg-purple-500/10">
                  <Link href="/register">Sign Up as Athlete</Link>
                </Button>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3">How It Works</h2>
              <p className="text-muted-foreground">Get started in 3 simple steps</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">1</div>
                <h3 className="font-bold text-lg mb-2">Create Account</h3>
                <p className="text-sm text-muted-foreground">Sign up free as a coach or athlete. Takes 30 seconds.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">2</div>
                <h3 className="font-bold text-lg mb-2">Connect</h3>
                <p className="text-sm text-muted-foreground">Athletes enter their coach&apos;s code. Optional: link Strava.</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">3</div>
                <h3 className="font-bold text-lg mb-2">Start Training</h3>
                <p className="text-sm text-muted-foreground">Coaches assign workouts. Athletes complete and track.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
                <Zap className="h-3.5 w-3.5" />Features
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">Simple but Powerful</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {features.map((feature, i) => (
                <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 flex-shrink-0">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Strava Integration */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-sm font-medium">
                  <Activity className="h-3.5 w-3.5" />
                  Strava Integration
                </div>
                <h2 className="text-2xl md:text-3xl font-bold">Works With Your Gear</h2>
                <p className="text-muted-foreground">
                  Use a Garmin, Apple Watch, or any device that syncs to Strava?
                  Your workouts will automatically appear in CoachTrack.
                </p>
                <ul className="space-y-2">
                  {[
                    'One-click Strava connection',
                    'Workouts auto-mark as complete',
                    'See distance, pace, heart rate',
                    'Coach sees your actual stats',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full animate-pulse" />
                  <div className="absolute inset-6 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-full" />
                  <div className="absolute inset-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/30">
                    <Activity className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3">
                <HelpCircle className="h-3.5 w-3.5" />
                FAQ
              </div>
              <h2 className="text-2xl md:text-3xl font-bold">Common Questions</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {faqs.map((faq, i) => (
                <Card key={i} className="p-5">
                  <h3 className="font-semibold mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5">
          <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to simplify your training?</h2>
            <p className="text-muted-foreground">
              Join coaches and athletes already using CoachTrack to stay organized and motivated.
            </p>
            <Button asChild size="lg" className="h-12 px-8 shadow-xl shadow-primary/25">
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Free forever. No credit card needed.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">CoachTrack</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} CoachTrack. Free for everyone.
          </p>
        </div>
      </footer>
    </div>
  );
}
