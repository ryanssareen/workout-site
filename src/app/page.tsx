import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dumbbell, Users, Calendar, TrendingUp, ArrowRight,
  Activity, CheckCircle2, Target, Bike, Waves, Zap, Shield, Clock
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Users,
      title: 'Coach-Student Connection',
      description: 'Simple 6-letter codes connect coaches and students instantly. No complicated setup.',
    },
    {
      icon: Calendar,
      title: 'Smart Workout Planning',
      description: 'Create, assign, and track workouts with precision. Set dates, durations, and detailed instructions.',
    },
    {
      icon: Activity,
      title: 'Strava Integration',
      description: 'Auto-sync activities from Strava. Track real performance data without manual entry.',
    },
    {
      icon: TrendingUp,
      title: 'Progress Tracking',
      description: 'Color-coded completion status, late tracking, and automated weekly summaries via email.',
    },
    {
      icon: Clock,
      title: 'Automated Reminders',
      description: '24-hour email reminders before workouts. Never miss a training session.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Your data is protected with industry-standard security. Only you and your coach can see your workouts.',
    },
  ];

  const sports = [
    { icon: Waves, name: 'Swimming', gradient: 'from-blue-500 to-cyan-500' },
    { icon: Activity, name: 'Running', gradient: 'from-green-500 to-emerald-500' },
    { icon: Bike, name: 'Cycling', gradient: 'from-orange-500 to-yellow-500' },
    { icon: Dumbbell, name: 'Strength', gradient: 'from-purple-500 to-pink-500' },
  ];

  const steps = [
    {
      title: 'Sign Up',
      description: 'Create an account as coach or student in 30 seconds.',
      icon: Users,
    },
    {
      title: 'Connect',
      description: 'Students use coach code to connect. That\'s it.',
      icon: Target,
    },
    {
      title: 'Train',
      description: 'Create workouts, track completion, sync with Strava.',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <Dumbbell className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Workout Tracker</span>
          </Link>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" asChild>
              <Link href="/features">Features</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild className="shadow-md">
              <Link href="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section - Simplified & Bold */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-purple-500/5 to-background -z-10" />
          
          <div className="container mx-auto px-4 py-20 md:py-32">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
                The Workout Tracker
                <span className="block mt-2 bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Coaches Actually Use
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                Plan workouts. Track completion. Sync with Strava. Send automated reminders. All in one simple platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button asChild size="lg" className="h-12 px-8 text-base shadow-xl">
                  <Link href="/register">
                    Start Free <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Sport Icons */}
              <div className="grid grid-cols-4 gap-4 pt-12 max-w-2xl mx-auto">
                {sports.map((sport, i) => {
                  const Icon = sport.icon;
                  return (
                    <div key={i} className="flex flex-col items-center gap-3 group cursor-default">
                      <div className={`p-4 rounded-2xl bg-gradient-to-br ${sport.gradient} shadow-lg`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">{sport.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works - Super Simple */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">
                Get Started in <span className="text-primary">3 Steps</span>
              </h2>
              <p className="text-lg text-muted-foreground">No complicated setup. No credit card. Just sign up and start.</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <Card key={i} className="relative p-6 text-center hover:shadow-lg transition-shadow">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div className="mb-4 flex justify-center">
                      <div className="p-3 rounded-xl bg-primary/10">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                    <p className="text-muted-foreground">{step.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Grid - Clean & Direct */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Zap className="h-4 w-4" />
                Everything You Need
              </div>
              <h2 className="text-3xl md:text-5xl font-bold">
                Built for <span className="text-primary">Real Training</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <Card key={i} className="p-6 hover:shadow-lg transition-shadow">
                    <div className="mb-4">
                      <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Strava Integration Highlight */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-sm font-medium">
                    <Activity className="h-4 w-4" />
                    Strava Integration
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold">
                    Auto-Sync Your Activities
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    Connect Strava once. Your runs, rides, and swims sync automatically. 
                    No manual entry. Just train.
                  </p>
                  <ul className="space-y-3">
                    {[
                      'One-click connection',
                      'Auto-sync all activities',
                      'See pace, distance, duration',
                      'Match to planned workouts',
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-orange-600 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative w-64 h-64">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full" />
                    <div className="absolute inset-8 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-full" />
                    <div className="absolute inset-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-2xl">
                      <Activity className="h-16 w-16 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Minimal */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Dumbbell className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-bold">Workout Tracker</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </Link>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Built for coaches and athletes
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
