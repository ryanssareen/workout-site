'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Brain, Calendar, CheckCircle2, Clock, Dumbbell,
  LineChart, Mail, MessageSquare, Smartphone, Sparkles, Users,
  Zap, Target, TrendingUp, Shield, ArrowRight, CheckSquare, BarChart3, Clock3
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Coach-Athlete System',
    description: 'Coaches create workouts and assign them to athletes. Athletes track progress and mark completions.',
    badge: 'Core',
    color: 'text-blue-500',
  },
  {
    icon: Activity,
    title: 'Strava Integration',
    description: 'Auto-sync workouts from Strava. Activities are automatically matched with assigned workouts.',
    badge: 'Integration',
    color: 'text-orange-500',
  },
  {
    icon: Brain,
    title: 'AI-Powered Tagging',
    description: 'Workouts imported from Strava are automatically analyzed and tagged using AI.',
    badge: 'AI',
    color: 'text-purple-500',
  },
  {
    icon: Sparkles,
    title: 'AI Workout Suggestions',
    description: 'Get intelligent workout recommendations based on training history and goals.',
    badge: 'AI',
    color: 'text-purple-500',
  },
  {
    icon: Calendar,
    title: 'Calendar View',
    description: 'Visualize your training schedule with an interactive calendar showing all workouts.',
    badge: 'Core',
    color: 'text-blue-500',
  },
  {
    icon: MessageSquare,
    title: 'Comments & Feedback',
    description: 'Coaches and athletes can leave comments on workouts for better communication.',
    badge: 'Communication',
    color: 'text-green-500',
  },
  {
    icon: Target,
    title: 'Multiple Workout Types',
    description: 'Support for swim, bike, run, strength training, and custom workout types.',
    badge: 'Core',
    color: 'text-blue-500',
  },
  {
    icon: TrendingUp,
    title: 'Progress Tracking',
    description: 'Track completion rates, streaks, and performance improvements over time.',
    badge: 'Analytics',
    color: 'text-cyan-500',
  },
  {
    icon: Mail,
    title: 'Email Notifications',
    description: 'Get notified when new workouts are assigned or when athletes complete tasks.',
    badge: 'Communication',
    color: 'text-green-500',
  },
  {
    icon: Shield,
    title: 'Secure Authentication',
    description: 'Firebase-powered authentication with email/password and secure sessions.',
    badge: 'Security',
    color: 'text-red-500',
  },
  {
    icon: Smartphone,
    title: 'Mobile Responsive',
    description: 'Works seamlessly on desktop, tablet, and mobile devices.',
    badge: 'UX',
    color: 'text-pink-500',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'Changes sync instantly across all devices without page refresh.',
    badge: 'Performance',
    color: 'text-yellow-500',
  },
];

const workoutTags = [
  { name: 'easy', color: 'bg-green-100 text-green-800' },
  { name: 'moderate', color: 'bg-yellow-100 text-yellow-800' },
  { name: 'hard', color: 'bg-red-100 text-red-800' },
  { name: 'recovery', color: 'bg-blue-100 text-blue-800' },
  { name: 'speed', color: 'bg-orange-100 text-orange-800' },
  { name: 'endurance', color: 'bg-purple-100 text-purple-800' },
  { name: 'intervals', color: 'bg-pink-100 text-pink-800' },
  { name: 'tempo', color: 'bg-indigo-100 text-indigo-800' },
  { name: 'long', color: 'bg-cyan-100 text-cyan-800' },
  { name: 'technique', color: 'bg-teal-100 text-teal-800' },
  { name: 'race', color: 'bg-rose-100 text-rose-800' },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Dumbbell className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">CoachTrack</span>
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <Badge variant="secondary" className="mb-4">
          <Sparkles className="h-3 w-3 mr-1" />
          AI-Powered Coaching Platform
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Everything you need to
          <span className="text-primary block mt-2">train smarter</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          A complete workout tracking platform for coaches and athletes. 
          Powered by AI, integrated with Strava, built for results.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline" className="gap-2">
              View All Features
            </Button>
          </Link>
        </div>
      </section>

      {/* Highlight Pillars */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: CheckSquare, title: 'Plan & assign fast', desc: 'Create multi-sport workouts, duplicate templates, and auto-tag with AI.' },
            { icon: BarChart3, title: 'See progress instantly', desc: 'Calendar with completion, missed, and late signals plus weekly % badges.' },
            { icon: Clock3, title: 'Save time', desc: 'Strava auto-completion, reminders, and one-click email summaries.' },
          ].map((item) => (
            <Card key={item.title} className="border-primary/15 bg-card/70 hover:border-primary/30 transition-all">
              <CardHeader className="flex flex-row items-center gap-3">
                <item.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{item.desc}</CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Workout Tags Showcase */}
      <section className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">Smart Workout Tags</h2>
          <p className="text-muted-foreground">
            AI automatically categorizes your workouts with intelligent tags
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {workoutTags.map((tag) => (
            <span
              key={tag.name}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize ${tag.color}`}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to manage training programs, track progress, and achieve goals.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Card 
              key={feature.title}
              className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300 bg-white/80 dark:bg-slate-900/60 backdrop-blur"
            >
              <CardHeader>
                <div className="flex items-center justify-between mb-2">
                  <feature.icon className={`h-8 w-8 ${feature.color}`} />
                  <Badge variant="outline" className="text-xs">
                    {feature.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-muted/50 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started in minutes with our simple workflow
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { step: '1', title: 'Create & Connect', desc: 'Coaches create an account, share a code, athletes join and link Strava.', icon: Users },
              { step: '2', title: 'Plan & Automate', desc: 'Build workouts, clone templates, set recurring sessions, auto-tag with AI.', icon: Calendar },
              { step: '3', title: 'Track & Report', desc: 'Calendar views, completion stats, and one-click email summaries keep everyone aligned.', icon: LineChart },
            ].map((item) => (
              <Card key={item.step} className="p-6 border-primary/10 bg-white/80 dark:bg-slate-900/60 backdrop-blur">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to elevate your training?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join coaches and athletes who are using CoachTrack to train smarter and achieve more.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Get Started Free
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" variant="outline" className="gap-2">
              <ArrowRight className="h-4 w-4 rotate-180" /> Back to Home
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Built with ❤️ by Ryan Sareen</p>
        </div>
      </footer>
    </div>
  );
}
