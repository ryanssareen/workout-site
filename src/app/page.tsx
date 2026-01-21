import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dumbbell, Users, Calendar, TrendingUp, ArrowRight, Activity, CheckCircle2, Target, Bike, Waves, Zap, Shield, Clock } from 'lucide-react';

export default function Home() {
  const features = [
    { icon: Users, title: 'Coach-Student Connection', description: 'Simple 6-letter codes connect coaches and students instantly.' },
    { icon: Calendar, title: 'Smart Workout Planning', description: 'Create, assign, and track workouts with precision.' },
    { icon: Activity, title: 'Strava Integration', description: 'Auto-sync activities from Strava without manual entry.' },
    { icon: TrendingUp, title: 'Progress Tracking', description: 'Color-coded status and automated weekly summaries.' },
    { icon: Clock, title: 'Automated Reminders', description: '24-hour email reminders before workouts.' },
    { icon: Shield, title: 'Secure & Private', description: 'Your data is protected with industry-standard security.' },
  ];

  const sports = [
    { icon: Waves, name: 'Swimming', color: 'bg-blue-500' },
    { icon: Activity, name: 'Running', color: 'bg-emerald-500' },
    { icon: Bike, name: 'Cycling', color: 'bg-orange-500' },
    { icon: Dumbbell, name: 'Strength', color: 'bg-purple-500' },
  ];

  const steps = [
    { title: 'Sign Up', description: 'Create your account in 30 seconds.', icon: Users },
    { title: 'Connect', description: 'Use coach code to link accounts.', icon: Target },
    { title: 'Train', description: 'Track workouts, sync with Strava.', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
              <Dumbbell className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">CoachTrack</span>
          </Link>
          <div className="flex gap-2 items-center">
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex"><Link href="/features">Features</Link></Button>
            <Button variant="ghost" size="sm" asChild><Link href="/login">Sign In</Link></Button>
            <Button size="sm" asChild className="shadow-md shadow-primary/20"><Link href="/register">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          </div>
          
          <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Zap className="h-3.5 w-3.5" />Simple & Powerful
              </div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
                The Workout Tracker<span className="block bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">Coaches Love</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">Plan workouts, track completion, sync with Strava, and send automated reminders. All in one place.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg" className="h-11 px-6 shadow-xl shadow-primary/25"><Link href="/register">Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                <Button variant="outline" asChild size="lg" className="h-11 px-6"><Link href="/features">Learn More</Link></Button>
              </div>
              <div className="flex justify-center gap-4 pt-10">
                {sports.map((sport, i) => (<div key={i} className="flex flex-col items-center gap-2"><div className={`p-3 rounded-xl ${sport.color} shadow-lg`}><sport.icon className="h-5 w-5 text-white" /></div><span className="text-xs font-medium text-muted-foreground">{sport.name}</span></div>))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Get Started in <span className="text-primary">3 Steps</span></h2>
              <p className="text-muted-foreground">No complicated setup required.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {steps.map((step, i) => (<Card key={i} className="relative p-6 text-center bg-card/50 backdrop-blur border-border/50 hover:shadow-lg transition-shadow"><div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">{i + 1}</div><div className="mb-3 flex justify-center"><div className="p-2.5 rounded-xl bg-primary/10"><step.icon className="h-6 w-6 text-primary" /></div></div><h3 className="font-bold mb-1">{step.title}</h3><p className="text-sm text-muted-foreground">{step.description}</p></Card>))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-3"><Zap className="h-3.5 w-3.5" />Features</div>
              <h2 className="text-2xl md:text-3xl font-bold">Everything You Need</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {features.map((feature, i) => (<Card key={i} className="p-5 bg-card/50 backdrop-blur border-border/50 hover:shadow-lg hover:border-primary/20 transition-all group"><div className="mb-3"><div className="inline-flex p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-110 transition-transform"><feature.icon className="h-4 w-4" /></div></div><h3 className="font-semibold mb-1">{feature.title}</h3><p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p></Card>))}
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-10 items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 text-sm font-medium"><Activity className="h-3.5 w-3.5" />Strava Integration</div>
                <h2 className="text-2xl md:text-3xl font-bold">Auto-Sync Activities</h2>
                <p className="text-muted-foreground">Connect Strava once and your activities sync automatically. No manual entry needed.</p>
                <ul className="space-y-2">{['One-click connection', 'Auto-sync all activities', 'See pace, distance, duration', 'Match to planned workouts'].map((item, i) => (<li key={i} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-orange-500 flex-shrink-0" /><span>{item}</span></li>))}</ul>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full animate-pulse" />
                  <div className="absolute inset-6 bg-gradient-to-br from-orange-500/30 to-red-500/30 rounded-full" />
                  <div className="absolute inset-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/30"><Activity className="h-12 w-12 text-white" /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-20">
          <div className="container mx-auto px-4 max-w-2xl text-center space-y-6">
            <h2 className="text-2xl md:text-3xl font-bold">Ready to get started?</h2>
            <p className="text-muted-foreground">Join coaches and athletes using CoachTrack.</p>
            <Button asChild size="lg" className="h-11 px-8 shadow-xl shadow-primary/25"><Link href="/register">Start Free Today <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 bg-muted/30">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center"><Dumbbell className="h-4 w-4 text-primary-foreground" /></div>
            <span className="font-semibold">CoachTrack</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
