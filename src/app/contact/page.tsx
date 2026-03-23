import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dumbbell, Mail, Github, ArrowRight } from 'lucide-react';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';

export default function ContactPage() {
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
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground/70 transition-colors">Features</Link>
            <ThemeToggle />
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white border-0 ml-2">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-600/8 rounded-full blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight mb-4">
              Get in <span className="bg-gradient-to-r from-red-400 to-red-200 bg-clip-text text-transparent">Touch</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Have questions, feedback, or want to collaborate? Reach out anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <a href="mailto:ryanssareen@gmail.com" className="group p-6 rounded-2xl border border-border bg-card hover:border-red-500/40 transition-all duration-300 text-center">
              <div className="p-3 rounded-xl bg-red-600/20 w-fit mx-auto mb-4">
                <Mail className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="font-bold mb-1 group-hover:text-red-400 transition-colors">Primary Email</h3>
              <p className="text-sm text-foreground/50 break-all">ryanssareen@gmail.com</p>
            </a>

            <a href="mailto:ryansareen6@gmail.com" className="group p-6 rounded-2xl border border-border bg-card hover:border-red-500/40 transition-all duration-300 text-center">
              <div className="p-3 rounded-xl bg-red-600/20 w-fit mx-auto mb-4">
                <Mail className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="font-bold mb-1 group-hover:text-red-400 transition-colors">Secondary Email</h3>
              <p className="text-sm text-foreground/50 break-all">ryansareen6@gmail.com</p>
            </a>

            <a href="https://github.com/ryanssareen" target="_blank" rel="noopener noreferrer" className="group p-6 rounded-2xl border border-border bg-card hover:border-red-500/40 transition-all duration-300 text-center">
              <div className="p-3 rounded-xl bg-muted/50 w-fit mx-auto mb-4">
                <Github className="h-6 w-6 text-foreground" />
              </div>
              <h3 className="font-bold mb-1 group-hover:text-red-400 transition-colors">GitHub</h3>
              <p className="text-sm text-foreground/50">@ryanssareen</p>
            </a>
          </div>

          <div className="text-center space-y-6">
            <p className="text-muted-foreground/70">Want to start training with The Daily Athlete?</p>
            <Button asChild size="lg" className="h-12 px-8 bg-red-600 hover:bg-red-700 text-white border-0 font-bold shadow-xl shadow-red-600/25">
              <Link href="/register">
                Create Free Account <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 bg-background">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-foreground flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-background" />
            </div>
            <span className="font-bold">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="text-sm text-muted-foreground/70 hover:text-foreground/60 transition-colors">Privacy</Link>
            <Link href="/terms" className="text-sm text-muted-foreground/70 hover:text-foreground/60 transition-colors">Terms</Link>
            <Link href="/features" className="text-sm text-muted-foreground/70 hover:text-foreground/60 transition-colors">Features</Link>
            <p className="text-sm text-muted-foreground/70">&copy; {new Date().getFullYear()} The Daily Athlete</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
