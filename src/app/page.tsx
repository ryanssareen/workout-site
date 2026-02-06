import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, Users, Calendar, TrendingUp, ArrowRight, Activity, CheckCircle2, Target, Bike, Waves, Zap, Shield, Clock, UserCheck, ClipboardList, Bell, BarChart3, Smartphone, HelpCircle, Flame } from 'lucide-react';

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
    { icon: Waves, name: 'Swimming', color: 'bg-red-600' },
    { icon: Activity, name: 'Running', color: 'bg-red-700' },
    { icon: Bike, name: 'Cycling', color: 'bg-red-800' },
    { icon: Dumbbell, name: 'Strength', color: 'bg-red-900' },
  ];

  const faqs = [
    { q: 'Is CoachTrack free?', a: 'Yes! CoachTrack is completely free for coaches and athletes.' },
    { q: 'Do I need a coach to use this?', a: 'No. Athletes can use CoachTrack independently to track their own workouts and sync with Strava.' },
    { q: 'How do I connect with my coach?', a: 'Your coach will give you a 6-letter code. Enter it in Settings and you\'re connected instantly.' },
    { q: 'Does it work with Garmin/Apple Watch?', a: 'Yes! If your device syncs to Strava, it will automatically sync to CoachTrack.' },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg text-white">CoachTrack</span>
          </Link>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" asChild className="text-white/70 hover:text-white hover:bg-white/10">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 border-0">
              <Link href="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/15 rounded-full blur-[120px]" />
            <div className="absolute top-1/2 -left-40 w-[400px] h-[400px] bg-red-900/20 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/5 rounded-full blur-[80px]" />
          </div>

          {/* Subtle grid pattern */}
          <div className="absolute inset-0 -z-10 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

          <div className="container mx-auto px-4 py-20 md:py-32">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-sm font-medium">
                  <Flame className="h-3.5 w-3.5" />
                  100% Free Forever
                </div>
                <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[0.9]">
                  TRAIN
                  <span className="block bg-gradient-to-r from-red-500 via-red-600 to-orange-500 bg-clip-text text-transparent">HARDER.</span>
                  <span className="block text-white/40 text-4xl sm:text-5xl md:text-6xl mt-2">TRACK SMARTER.</span>
                </h1>
                <p className="text-lg md:text-xl text-white/50 max-w-lg">
                  Assign, track, and crush workouts with a visual calendar, Strava sync, and AI suggestions that keep every athlete on track.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="h-13 px-8 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/25 border-0 font-bold text-base">
                    <Link href="/register">
                      START TRAINING
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="h-13 px-8 border-white/20 text-white hover:bg-white/5 hover:text-white font-bold text-base">
                    <Link href="/login">I have an account</Link>
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4 max-w-lg pt-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Completion</p>
                    <p className="text-2xl font-black text-red-500">82%</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Setup</p>
                    <p className="text-2xl font-black text-white">&lt; 1 min</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-white/40 uppercase tracking-wider">Price</p>
                    <p className="text-2xl font-black text-red-500">$0</p>
                  </div>
                </div>
              </div>

              {/* Hero visual - workout card stack */}
              <div className="relative hidden lg:block">
                <div className="absolute -inset-8 bg-gradient-to-br from-red-600/10 via-transparent to-red-900/10 blur-3xl rounded-3xl" />
                <div className="relative space-y-4">
                  {/* Workout cards */}
                  {[
                    { type: 'RUN', name: 'Morning 5K', stat: '5.0 km · 24:30', icon: Activity, accent: 'bg-red-500' },
                    { type: 'SWIM', name: 'Endurance Set', stat: '2000m · 35:00', icon: Waves, accent: 'bg-red-600' },
                    { type: 'BIKE', name: 'Hill Intervals', stat: '30 km · 55:00', icon: Bike, accent: 'bg-red-700' },
                    { type: 'STRENGTH', name: 'Upper Body', stat: '45 min · 6 sets', icon: Dumbbell, accent: 'bg-red-800' },
                  ].map((workout, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white shadow-lg shadow-black/10 transition-all duration-300" style={{ transform: `translateX(${i * 12}px)` }}>
                      <div className={`p-2.5 rounded-lg ${workout.accent}`}>
                        <workout.icon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tracking-widest text-red-600">{workout.type}</span>
                        </div>
                        <p className="font-semibold text-gray-900">{workout.name}</p>
                        <p className="text-sm text-gray-400">{workout.stat}</p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sports Icons */}
        <section className="py-8 border-y border-white/10 bg-white/[0.02]">
          <div className="container mx-auto px-4">
            <div className="flex justify-center items-center gap-8 md:gap-12">
              <span className="text-sm text-white/30 hidden sm:block uppercase tracking-wider">Works for</span>
              {sports.map((sport, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${sport.color} shadow-lg`}>
                    <sport.icon className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-white/60 hidden md:block">{sport.name}</span>
                </div>
              ))}
              <span className="text-sm text-white/30">& more</span>
            </div>
          </div>
        </section>

        {/* Who is this for? */}
        <section className="py-20 md:py-28 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-red-600/5 rounded-full blur-[120px]" />
          </div>
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-black mb-3 uppercase tracking-tight">Built for the Grind</h2>
              <p className="text-white/40 max-w-xl mx-auto">
                Whether you coach others or train solo, CoachTrack keeps everyone locked in.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* For Coaches */}
              <div className="p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-red-500/40 transition-all duration-300 group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-red-600 shadow-lg shadow-red-600/30">
                    <UserCheck className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase">For Coaches</h3>
                    <p className="text-sm text-white/40">Manage your athletes</p>
                  </div>
                </div>
                <ul className="space-y-4">
                  {forCoaches.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-red-600/10 mt-0.5">
                        <item.icon className="h-4 w-4 text-red-500" />
                      </div>
                      <span className="text-sm text-white/70">{item.text}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-6 bg-red-600 hover:bg-red-700 text-white border-0 font-bold">
                  <Link href="/register">Sign Up as Coach</Link>
                </Button>
              </div>

              {/* For Athletes */}
              <div className="p-6 md:p-8 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-red-500/40 transition-all duration-300 group">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-red-700 to-red-900 shadow-lg shadow-red-700/30">
                    <Target className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase">For Athletes</h3>
                    <p className="text-sm text-white/40">Track your training</p>
                  </div>
                </div>
                <ul className="space-y-4">
                  {forAthletes.map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className="p-1.5 rounded-lg bg-red-600/10 mt-0.5">
                        <item.icon className="h-4 w-4 text-red-500" />
                      </div>
                      <span className="text-sm text-white/70">{item.text}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full mt-6 bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold">
                  <Link href="/register">Sign Up as Athlete</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-20 md:py-24 border-y border-white/10 bg-white/[0.02]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-black mb-3 uppercase tracking-tight">3 Steps. That&apos;s It.</h2>
              <p className="text-white/40">No complicated setup. No learning curve.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {[
                { step: '01', title: 'Create Account', desc: 'Sign up free as a coach or athlete. Takes 30 seconds.' },
                { step: '02', title: 'Connect', desc: "Athletes enter their coach's code. Optional: link Strava." },
                { step: '03', title: 'Start Training', desc: 'Coaches assign workouts. Athletes complete and track.' },
              ].map((item) => (
                <div key={item.step} className="text-center group">
                  <div className="text-5xl font-black text-red-600/20 group-hover:text-red-600/40 transition-colors mb-4">{item.step}</div>
                  <h3 className="font-bold text-lg mb-2 text-white">{item.title}</h3>
                  <p className="text-sm text-white/40">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 md:py-24 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[100px]" />
          </div>
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-sm font-medium mb-4">
                <Zap className="h-3.5 w-3.5" />
                Features
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Simple but Powerful</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {features.map((feature, i) => (
                <div key={i} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-red-500/30 transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 text-white shadow-lg shadow-red-600/20 flex-shrink-0">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold mb-1 text-white">{feature.title}</h3>
                      <p className="text-sm text-white/40">{feature.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Strava Integration */}
        <section className="py-20 md:py-24 border-y border-white/10 bg-white/[0.02]">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-sm font-medium">
                  <Activity className="h-3.5 w-3.5" />
                  Strava Integration
                </div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Works With Your Gear</h2>
                <p className="text-white/40">
                  Use a Garmin, Apple Watch, or any device that syncs to Strava?
                  Your workouts will automatically appear in CoachTrack.
                </p>
                <ul className="space-y-3">
                  {[
                    'One-click Strava connection',
                    'Workouts auto-mark as complete',
                    'See distance, pace, heart rate',
                    'Coach sees your actual stats',
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="text-white/60">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 to-orange-600/20 rounded-full animate-pulse" />
                  <div className="absolute inset-6 bg-gradient-to-br from-red-600/30 to-orange-600/30 rounded-full" />
                  <div className="absolute inset-12 bg-gradient-to-br from-red-600 to-orange-600 rounded-full flex items-center justify-center shadow-2xl shadow-red-600/40">
                    <Activity className="h-12 w-12 text-white" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 md:py-24 relative">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-sm font-medium mb-4">
                <HelpCircle className="h-3.5 w-3.5" />
                FAQ
              </div>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">Common Questions</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {faqs.map((faq, i) => (
                <div key={i} className="p-5 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <h3 className="font-bold mb-2 text-white">{faq.q}</h3>
                  <p className="text-sm text-white/40">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 md:py-28 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[100px]" />
          </div>
          <div className="container mx-auto px-4 max-w-2xl text-center space-y-8">
            <Flame className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
              Stop Planning.<br />
              <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">Start Training.</span>
            </h2>
            <p className="text-white/40 text-lg">
              Join coaches and athletes already using CoachTrack to stay organized and motivated.
            </p>
            <Button asChild size="lg" className="h-14 px-10 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 border-0 font-bold text-lg">
              <Link href="/register">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <p className="text-xs text-white/30">
              Free forever. No credit card needed.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 bg-black">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-white">CoachTrack</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/features" className="text-sm text-white/30 hover:text-white/60 transition-colors">Features</Link>
            <p className="text-sm text-white/30">
              &copy; {new Date().getFullYear()} CoachTrack
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
