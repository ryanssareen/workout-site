import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell, Users, Calendar, TrendingUp, ArrowRight, Sparkles, Shield, Zap } from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Users,
      title: 'Coach-Student Platform',
      description: 'Dedicated accounts with role-based access and permissions for seamless collaboration.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Calendar,
      title: 'Workout Scheduling',
      description: 'Create detailed workouts with dates, types, descriptions, and durations.',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      icon: TrendingUp,
      title: 'Progress Tracking',
      description: 'Monitor completion status and track progress across all training types.',
      gradient: 'from-orange-500 to-red-500',
    },
    {
      icon: Dumbbell,
      title: 'Multi-Sport Support',
      description: 'Support for swimming, running, cycling, and strength training.',
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  const benefits = [
    { icon: Sparkles, text: 'Intuitive interface designed for efficiency' },
    { icon: Shield, text: 'Secure authentication and data protection' },
    { icon: Zap, text: 'Real-time updates and instant synchronization' },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl">Workout Tracker</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Sign Up</Link>
            </Button>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
          <div className="container relative mx-auto px-4 py-24 md:py-32">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Modern Coaching Platform
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
                Streamline Your
                <span className="block text-primary mt-2">Coaching Workflow</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Create, assign, and track workouts for your students. Built for coaches who want to focus on training, not paperwork.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button asChild size="lg" className="text-lg h-12 px-8 shadow-lg shadow-primary/20">
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg h-12 px-8">
                  <Link href="/login">
                    Sign In
                  </Link>
                </Button>
              </div>

              <div className="flex flex-wrap justify-center gap-6 pt-8">
                {benefits.map((benefit, index) => {
                  const Icon = benefit.icon;
                  return (
                    <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      <span>{benefit.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Everything you need to coach effectively
              </h2>
              <p className="text-lg text-muted-foreground">
                Powerful features designed to make workout planning and tracking effortless
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                    <CardHeader>
                      <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${feature.gradient} text-white mb-4 w-fit`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
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

        {/* CTA Section */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-background" />
              <CardHeader className="relative text-center py-16 px-4">
                <CardTitle className="text-4xl md:text-5xl font-bold mb-4">
                  Ready to transform your coaching?
                </CardTitle>
                <CardDescription className="text-lg max-w-2xl mx-auto mb-8">
                  Join coaches who are already using Workout Tracker to streamline their training programs
                </CardDescription>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="text-lg h-12 px-8">
                    <Link href="/register">
                      Start Free Today
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Dumbbell className="h-5 w-5" />
            <span className="font-semibold">Workout Tracker</span>
          </div>
          <p className="text-sm">
            Built with ❤️ for coaches and athletes
          </p>
        </div>
      </footer>
    </div>
  );
}
