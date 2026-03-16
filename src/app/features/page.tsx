import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Activity, Brain, Calendar, CheckCircle2, Clock, Dumbbell,
  Mail, Smartphone, Sparkles,
  Zap, Target, TrendingUp, Shield, ArrowRight, Flame
} from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

const features = [
  { icon: Activity, title: 'Strava Integration', description: 'Auto-sync workouts from Strava. Activities are automatically matched and marked complete.', badge: 'Integration' },
  { icon: Brain, title: 'AI-Powered Tagging', description: 'Workouts imported from Strava are automatically analyzed and tagged using AI.', badge: 'AI' },
  { icon: Sparkles, title: 'AI Workout Suggestions', description: 'Get intelligent workout recommendations based on training history and goals.', badge: 'AI' },
  { icon: Calendar, title: 'Calendar View', description: 'Visualize your training schedule with an interactive calendar showing all workouts.', badge: 'Core' },
  { icon: Target, title: 'Multiple Workout Types', description: 'Support for swim, bike, run, strength training, and custom workout types.', badge: 'Core' },
  { icon: TrendingUp, title: 'Progress Tracking', description: 'Track completion rates, streaks, and performance improvements over time.', badge: 'Analytics' },
  { icon: Mail, title: 'Email Notifications', description: 'Get weekly summaries and workout reminders delivered to your inbox.', badge: 'Communication' },
  { icon: Shield, title: 'Secure Authentication', description: 'Firebase-powered authentication with email/password and Google sign-in.', badge: 'Security' },
  { icon: Smartphone, title: 'Mobile Responsive', description: 'Works seamlessly on desktop, tablet, and mobile devices.', badge: 'UX' },
  { icon: Zap, title: 'Real-time Updates', description: 'Changes sync instantly across all devices without page refresh.', badge: 'Performance' },
  { icon: Clock, title: 'Smart Reminders', description: 'Get email reminders the day before a scheduled workout so you never miss a session.', badge: 'Core' },
  { icon: Dumbbell, title: 'Training Plans', description: 'Structured training built around your sport, goal, and availability.', badge: 'Core' },
];

const workoutTags = [
  'easy', 'moderate', 'hard', 'recovery', 'speed',
  'endurance', 'intervals', 'tempo', 'long', 'technique', 'race',
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold text-lg">The Daily Athlete</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Home</Link>
            <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Portfolio</Link>
            <Link href="/roadmap"   className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Roadmap</Link>
            <Link href="/contact"   className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Contact</Link>
            <ThemeToggle />
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white border-0 ml-2">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-400 text-sm font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Training Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 uppercase">
            Everything you need to
            <span className="block bg-gradient-to-r from-red-400 via-red-500 to-red-300 bg-clip-text text-transparent mt-2">train smarter</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            A complete self-coaching platform for endurance athletes.
            Powered by AI, integrated with Strava, built for results.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button asChild size="lg" className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white border-0 font-bold shadow-xl shadow-red-600/25">
              <Link href="/register">
                Get Started <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 border-border text-foreground hover:bg-muted/50 hover:text-foreground font-bold">
              <Link href="#features">View All Features</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Highlight Pillars */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: CheckCircle2, title: 'Plan & track fast', desc: 'Create multi-sport workouts, build weekly plans, and auto-tag with AI.' },
            { icon: TrendingUp, title: 'See progress instantly', desc: 'Calendar with completion signals, weekly stats, and visual progress.' },
            { icon: Clock, title: 'Save time', desc: 'Strava auto-completion, email reminders, and one-click summaries.' },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-2xl border border-border bg-card hover:border-red-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-red-600/20">
                  <item.icon className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="font-bold">{item.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workout Tags */}
      <section className="py-16 border-y border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Smart Workout Tags</h2>
            <p className="text-muted-foreground">AI automatically categorizes your workouts</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {workoutTags.map((tag) => (
              <span key={tag} className="px-4 py-2 rounded-full text-sm font-medium capitalize bg-muted/50 border border-border text-foreground/60 hover:border-red-500/30 hover:text-foreground/80 transition-all">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 relative">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-4 uppercase tracking-tight">Powerful Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to structure your training, track progress, and crush your goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-2xl border border-border bg-card hover:border-red-500/30 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-red-600 shadow-lg shadow-red-600/20">
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground/50 uppercase">{feature.badge}</span>
                </div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-red-400 transition-colors">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-y border-border bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-3 uppercase tracking-tight">3 Steps. That&apos;s It.</h2>
            <p className="text-muted-foreground">No complicated setup. No learning curve.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up, pick your sport and goal, connect Strava.', icon: Target },
              { step: '02', title: 'Build Your Plan', desc: 'Get a starter plan, customize workouts, set your weekly schedule.', icon: Calendar },
              { step: '03', title: 'Track & Improve', desc: 'Log sessions, build streaks, and watch your performance grow.', icon: TrendingUp },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="text-5xl font-black text-red-600/20 group-hover:text-red-600/40 transition-colors mb-4">{item.step}</div>
                <item.icon className="h-6 w-6 text-red-400 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-8">
          <Flame className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
            Ready to elevate<br />
            <span className="bg-gradient-to-r from-red-400 to-red-200 bg-clip-text text-transparent">your training?</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Join athletes already using The Daily Athlete to train with purpose.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-14 px-10 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 border-0 font-bold text-lg">
              <Link href="/register">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-10 border-border text-foreground hover:bg-muted/50 hover:text-foreground font-bold text-lg">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="text-sm text-muted-foreground/70 hover:text-foreground/60 transition-colors">Contact</Link>
            <p className="text-sm text-muted-foreground/70">&copy; {new Date().getFullYear()} The Daily Athlete</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
