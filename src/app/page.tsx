import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dumbbell, Users, Calendar, TrendingUp, Zap } from 'lucide-react';

/**
 * Landing page component
 * 
 * Marketing structure:
 * - Hero section: Value proposition + CTA buttons
 * - Feature grid: 4 core capabilities with icons
 * - Responsive layout: Mobile-first design
 * 
 * Navigation:
 * - Login button (existing users)
 * - Sign up button (new users, primary CTA)
 * 
 * SEO considerations:
 * - Descriptive headings for search indexing
 * - Clear value proposition above fold
 * - Feature descriptions for content relevance
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation bar */}
      <nav className="container mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-8 w-8 text-primary" />
          <span className="font-bold text-2xl">Workout Tracker</span>
        </div>
        <div className="flex gap-4">
          <Button variant="outline" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Sign Up</Link>
          </Button>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-16">
        {/* Hero section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Streamline Your Coaching Workflow
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Create, assign, and track workouts for your students. Built for coaches who want to focus on training, not paperwork.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/register">Get Started Free</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <Users className="h-10 w-10 mb-2 text-primary" />
              <CardTitle>Coach-Student Platform</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Dedicated accounts for coaches and students with role-based access and permissions. Secure workout assignment system.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <Calendar className="h-10 w-10 mb-2 text-primary" />
              <CardTitle>Workout Scheduling</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Create detailed workouts with dates, types, descriptions, and durations for comprehensive planning and organization.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <TrendingUp className="h-10 w-10 mb-2 text-primary" />
              <CardTitle>Progress Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Monitor completion status and track student progress across swim, run, bike, and strength training disciplines.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader>
              <Zap className="h-10 w-10 mb-2 text-primary" />
              <CardTitle>AI Vision Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Upload whiteboard photos and let AI automatically extract workout details. Transform physical planning into digital workouts instantly.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Footer CTA */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">
            Join coaches and students already streamlining their training workflow
          </p>
          <Button size="lg" asChild>
            <Link href="/register">Create Free Account</Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 Workout Tracker. Built with Next.js and Firebase.</p>
        </div>
      </footer>
    </div>
  );
}
