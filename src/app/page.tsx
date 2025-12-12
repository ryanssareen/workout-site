import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dumbbell, Users, Calendar, TrendingUp, ArrowRight, Sparkles, Shield, Zap,
  Activity, CheckCircle2, Clock, Target, Bike, Waves, Play, Star, ChevronRight
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Users,
      title: 'Coach-Athlete Connection',
      description: 'Seamless collaboration between coaches and athletes with role-based dashboards and real-time updates.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Calendar,
      title: 'Smart Scheduling',
      description: 'Plan workouts with precision. Set dates, durations, and detailed instructions for each session.',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: Activity,
      title: 'Strava Integration',
      description: 'Connect your Strava account to automatically sync activities and track real performance data.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: TrendingUp,
      title: 'Progress Analytics',
      description: 'Visualize improvement over time with completion rates, streaks, and performance metrics.',
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  const sports = [
    { icon: Waves, name: 'Swimming', color: 'text-blue-500' },
    { icon: Activity, name: 'Running', color: 'text-green-500' },
    { icon: Bike, name: 'Cycling', color: 'text-orange-500' },
    { icon: Dumbbell, name: 'Strength', color: 'text-purple-500' },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Create Your Account',
      description: 'Sign up as a coach or athlete. Coaches can invite athletes to join their training group.',
      icon: Users,
    },
    {
      step: '02',
      title: 'Plan Workouts',
      description: 'Coaches create detailed workout plans with exercises, durations, and specific instructions.',
      icon: Calendar,
    },
    {
      step: '03',
      title: 'Track & Complete',
      description: 'Athletes view assigned workouts, mark them complete, and sync activities from Strava.',
      icon: CheckCircle2,
    },
    {
      step: '04',
      title: 'Monitor Progress',
      description: 'Both coaches and athletes can track progress, view statistics, and celebrate achievements.',
      icon: TrendingUp,
    },
  ];

  const stats = [
    { value: '100%', label: 'Free to Use' },
    { value: '4', label: 'Sport Types' },
    { value: '∞', label: 'Workouts' },
    { value: '24/7', label: 'Access' },
  ];

  const testimonials = [
    {
      quote: "Finally, a platform that understands what coaches actually need. Simple, effective, and my athletes love it.",
      author: "Sarah M.",
      role: "Triathlon Coach",
      avatar: "S",
    },
    {
      quote: "The Strava integration is a game-changer. I can see my athletes' real performance without any manual entry.",
      author: "Michael R.",
      role: "Running Coach",
      avatar: "M",
    },
    {
      quote: "As an athlete, I love being able to see all my workouts in one place and track my progress over time.",
      author: "Alex T.",
      role: "Competitive Swimmer",
      avatar: "A",
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Dumbbell className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">Workout Tracker</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild className="hidden sm:flex">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild className="shadow-lg shadow-primary/20">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-500/5 to-background" />
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

          <div className="container relative mx-auto px-4 py-24 md:py-32 lg:py-40">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
                <Sparkles className="h-4 w-4" />
                The Modern Coaching Platform
                <ChevronRight className="h-4 w-4" />
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight">
                Train Smarter,
                <span className="block bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Coach Better
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                The all-in-one platform for coaches and athletes. Create workouts, track progress, and sync with Strava — all in one place.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button asChild size="lg" className="text-lg h-14 px-8 shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 transition-all">
                  <Link href="/register">
                    Start Free Today
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg h-14 px-8 group">
                  <Link href="/login">
                    <Play className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                    Sign In
                  </Link>
                </Button>
              </div>

              {/* Sport icons */}
              <div className="flex justify-center gap-8 pt-12">
                {sports.map((sport, index) => {
                  const Icon = sport.icon;
                  return (
                    <div key={index} className="flex flex-col items-center gap-2 group">
                      <div className={`p-4 rounded-2xl bg-muted/50 group-hover:bg-muted transition-colors ${sport.color}`}>
                        <Icon className="h-8 w-8" />
                      </div>
                      <span className="text-sm text-muted-foreground font-medium">{sport.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 border-y bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground mt-2 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Zap className="h-4 w-4" />
                Powerful Features
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Everything you need to
                <span className="text-primary"> succeed</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Built with coaches and athletes in mind. Every feature designed to make training more effective.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="relative overflow-hidden group hover:shadow-xl transition-all duration-500 border-2 hover:border-primary/20">
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                    <CardHeader className="pb-2">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} text-white mb-4 w-fit shadow-lg`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-2xl">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it Works Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Target className="h-4 w-4" />
                How It Works
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Get started in <span className="text-primary">minutes</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Simple setup, powerful results. Here's how to transform your coaching workflow.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {howItWorks.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="relative">
                    {index < howItWorks.length - 1 && (
                      <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent -translate-x-1/2" />
                    )}
                    <div className="text-center group">
                      <div className="relative inline-block mb-6">
                        <div className="w-24 h-24 rounded-2xl bg-background shadow-xl flex items-center justify-center group-hover:shadow-2xl transition-shadow">
                          <Icon className="h-10 w-10 text-primary" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                          {item.step}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Strava Integration Highlight */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <Card className="overflow-hidden border-2 border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-background">
                <div className="grid md:grid-cols-2 gap-8 p-8 md:p-12">
                  <div className="space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 text-sm font-medium">
                      <Activity className="h-4 w-4" />
                      Strava Integration
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold">
                      Sync your activities
                      <span className="text-orange-500"> automatically</span>
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      Connect your Strava account and watch your activities flow in automatically.
                      No more manual entry — just train and let the data sync.
                    </p>
                    <ul className="space-y-3">
                      {[
                        'One-click Strava connection',
                        'Auto-sync runs, rides, and swims',
                        'View pace, distance, and duration',
                        'Match activities to planned workouts',
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5 text-orange-500 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="relative">
                      <div className="w-64 h-64 rounded-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                        <div className="w-48 h-48 rounded-full bg-gradient-to-br from-orange-500/30 to-red-500/30 flex items-center justify-center">
                          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-2xl">
                            <Activity className="h-16 w-16 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                <Star className="h-4 w-4" />
                Testimonials
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6">
                Loved by <span className="text-primary">coaches & athletes</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-muted-foreground mb-6 leading-relaxed italic">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.author}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary via-purple-600 to-pink-600 text-white">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIyIi8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
              <CardHeader className="relative text-center py-16 md:py-20 px-4">
                <CardTitle className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
                  Ready to level up your training?
                </CardTitle>
                <CardDescription className="text-xl text-white/80 max-w-2xl mx-auto mb-10">
                  Join the platform built for serious coaches and dedicated athletes. Start for free, no credit card required.
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" variant="secondary" className="text-lg h-14 px-10 shadow-xl">
                    <Link href="/register">
                      Create Free Account
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="text-lg h-14 px-10 bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white">
                    <Link href="/login">
                      Sign In
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <Dumbbell className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-xl">Workout Tracker</span>
              </div>
              <p className="text-muted-foreground max-w-md leading-relaxed">
                The modern platform for coaches and athletes. Create workouts, track progress, and achieve your goals together.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li><Link href="/login" className="hover:text-primary transition-colors">Login</Link></li>
                <li><Link href="/register" className="hover:text-primary transition-colors">Sign Up</Link></li>
                <li><Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Features</h4>
              <ul className="space-y-3 text-muted-foreground">
                <li>Workout Planning</li>
                <li>Progress Tracking</li>
                <li>Strava Integration</li>
                <li>Team Management</li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Workout Tracker. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built with passion for coaches and athletes
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
