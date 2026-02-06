import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Activity, Brain, Calendar, CheckCircle2, Clock, Dumbbell,
  Mail, MessageSquare, Smartphone, Sparkles, Users,
  Zap, Target, TrendingUp, Shield, ArrowRight, Flame
} from 'lucide-react';

const features = [
  { icon: Users, title: 'Coach-Athlete System', description: 'Coaches create workouts and assign them to athletes. Athletes track progress and mark completions.', badge: 'Core' },
  { icon: Activity, title: 'Strava Integration', description: 'Auto-sync workouts from Strava. Activities are automatically matched with assigned workouts.', badge: 'Integration' },
  { icon: Brain, title: 'AI-Powered Tagging', description: 'Workouts imported from Strava are automatically analyzed and tagged using AI.', badge: 'AI' },
  { icon: Sparkles, title: 'AI Workout Suggestions', description: 'Get intelligent workout recommendations based on training history and goals.', badge: 'AI' },
  { icon: Calendar, title: 'Calendar View', description: 'Visualize your training schedule with an interactive calendar showing all workouts.', badge: 'Core' },
  { icon: MessageSquare, title: 'Comments & Feedback', description: 'Coaches and athletes can leave comments on workouts for better communication.', badge: 'Communication' },
  { icon: Target, title: 'Multiple Workout Types', description: 'Support for swim, bike, run, strength training, and custom workout types.', badge: 'Core' },
  { icon: TrendingUp, title: 'Progress Tracking', description: 'Track completion rates, streaks, and performance improvements over time.', badge: 'Analytics' },
  { icon: Mail, title: 'Email Notifications', description: 'Get notified when new workouts are assigned or when athletes complete tasks.', badge: 'Communication' },
  { icon: Shield, title: 'Secure Authentication', description: 'Firebase-powered authentication with email/password and Google sign-in.', badge: 'Security' },
  { icon: Smartphone, title: 'Mobile Responsive', description: 'Works seamlessly on desktop, tablet, and mobile devices.', badge: 'UX' },
  { icon: Zap, title: 'Real-time Updates', description: 'Changes sync instantly across all devices without page refresh.', badge: 'Performance' },
];

const workoutTags = [
  'easy', 'moderate', 'hard', 'recovery', 'speed',
  'endurance', 'intervals', 'tempo', 'long', 'technique', 'race',
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-600/30">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">CoachTrack</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-white/40 hover:text-white/70 transition-colors">Home</Link>
            <Link href="/contact" className="text-sm text-white/40 hover:text-white/70 transition-colors">Contact</Link>
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
          <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-red-900/15 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-500 text-sm font-medium mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Coaching Platform
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-6 uppercase">
            Everything you need to
            <span className="block bg-gradient-to-r from-red-500 via-red-600 to-orange-500 bg-clip-text text-transparent mt-2">train smarter</span>
          </h1>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-8">
            A complete workout tracking platform for coaches and athletes.
            Powered by AI, integrated with Strava, built for results.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button asChild size="lg" className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white border-0 font-bold shadow-xl shadow-red-600/25">
              <Link href="/register">
                Get Started Free <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 border-white/20 text-white hover:bg-white/5 hover:text-white font-bold">
              <Link href="#features">View All Features</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Highlight Pillars */}
      <section className="container mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: CheckCircle2, title: 'Plan & assign fast', desc: 'Create multi-sport workouts, duplicate templates, and auto-tag with AI.' },
            { icon: TrendingUp, title: 'See progress instantly', desc: 'Calendar with completion signals, weekly stats, and visual progress.' },
            { icon: Clock, title: 'Save time', desc: 'Strava auto-completion, email reminders, and one-click summaries.' },
          ].map((item) => (
            <div key={item.title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-red-500/30 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-red-600/20">
                  <item.icon className="h-5 w-5 text-red-500" />
                </div>
                <h3 className="font-bold">{item.title}</h3>
              </div>
              <p className="text-sm text-white/40">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workout Tags */}
      <section className="py-16 border-y border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Smart Workout Tags</h2>
            <p className="text-white/40">AI automatically categorizes your workouts</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
            {workoutTags.map((tag) => (
              <span key={tag} className="px-4 py-2 rounded-full text-sm font-medium capitalize bg-white/5 border border-white/10 text-white/60 hover:border-red-500/30 hover:text-white/80 transition-all">
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
            <p className="text-white/40 max-w-2xl mx-auto">
              Everything you need to manage training programs, track progress, and achieve goals.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature) => (
              <div key={feature.title} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-red-500/30 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-600/20">
                    <feature.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold tracking-widest text-white/20 uppercase">{feature.badge}</span>
                </div>
                <h3 className="font-bold text-lg mb-2 group-hover:text-red-400 transition-colors">{feature.title}</h3>
                <p className="text-sm text-white/40">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-y border-white/10 bg-white/[0.02]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-black mb-3 uppercase tracking-tight">3 Steps. That&apos;s It.</h2>
            <p className="text-white/40">No complicated setup. No learning curve.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { step: '01', title: 'Create & Connect', desc: 'Coaches create an account, share a code, athletes join and link Strava.', icon: Users },
              { step: '02', title: 'Plan & Automate', desc: 'Build workouts, clone templates, set recurring sessions, auto-tag with AI.', icon: Calendar },
              { step: '03', title: 'Track & Report', desc: 'Calendar views, completion stats, and one-click email summaries.', icon: TrendingUp },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="text-5xl font-black text-red-600/20 group-hover:text-red-600/40 transition-colors mb-4">{item.step}</div>
                <item.icon className="h-6 w-6 text-red-500 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-white/40">{item.desc}</p>
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
          <Flame className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
            Ready to elevate<br />
            <span className="bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">your training?</span>
          </h2>
          <p className="text-white/40 text-lg">
            Join coaches and athletes already using CoachTrack to train smarter.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="h-14 px-10 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 border-0 font-bold text-lg">
              <Link href="/register">
                Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-14 px-10 border-white/20 text-white hover:bg-white/5 hover:text-white font-bold text-lg">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 bg-black">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">CoachTrack</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className="text-sm text-white/30 hover:text-white/60 transition-colors">Contact</Link>
            <p className="text-sm text-white/30">&copy; {new Date().getFullYear()} CoachTrack</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
