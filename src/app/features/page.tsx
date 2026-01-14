'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Brain, Calendar, CheckCircle2, Clock, Dumbbell,
  LineChart, Mail, MessageSquare, Smartphone, Sparkles, Users,
  Zap, Target, TrendingUp, Shield, ArrowRight
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'Coach-Student System',
    description: 'Coaches create workouts and assign them to students. Students track progress and mark completions.',
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
    description: 'Coaches and students can leave comments on workouts for better communication.',
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
    description: 'Get notified when new workouts are assigned or when students complete tasks.',
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
        <div className="flex items-center justify-center gap-4">
          <Link href="#features">
            <Button size="lg" className="gap-2">
              View All Features <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
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
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300"
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
          
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="font-semibold mb-2">Coach Creates Account</h3>
              <p className="text-sm text-muted-foreground">
                Sign up as a coach and get a unique code to share with your athletes
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="font-semibold mb-2">Students Join</h3>
              <p className="text-sm text-muted-foreground">
                Athletes sign up with the coach code and connect their Strava account
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="font-semibold mb-2">Train Together</h3>
              <p className="text-sm text-muted-foreground">
                Assign workouts, track completions, and achieve goals together
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to elevate your training?</h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join coaches and athletes who are using CoachTrack to train smarter and achieve more.
        </p>
        <Link href="/">
          <Button size="lg" variant="outline" className="gap-2">
            <ArrowRight className="h-4 w-4 rotate-180" /> Back to Home
          </Button>
        </Link>
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
