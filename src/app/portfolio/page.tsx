import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Activity,
  ArrowRight,
  Brain,
  Calendar,
  Dumbbell,
  Eye,
  Flame,
  Share2,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';

/* ── phone frame wrapper ────────────────────────────────── */
function PhoneFrame({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`relative mx-auto ${className}`}>
      {/* bezel */}
      <div className="rounded-[2.5rem] border-[5px] border-white/[0.08] bg-black/60 p-1.5 shadow-2xl shadow-black/60">
        {/* notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
        {/* screen */}
        <div className="rounded-[2rem] overflow-hidden bg-black">
          <Image
            src={src}
            alt={alt}
            width={320}
            height={693}
            className="w-full h-auto"
            priority={priority}
          />
        </div>
      </div>
    </div>
  );
}

/* ── feature tour section ───────────────────────────────── */
function FeatureSection({
  step,
  title,
  description,
  bullets,
  children,
  reverse = false,
}: {
  step: string;
  title: string;
  description: string;
  bullets: string[];
  children: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div
          className={`flex flex-col ${
            reverse ? 'md:flex-row-reverse' : 'md:flex-row'
          } items-center gap-12 md:gap-16 max-w-5xl mx-auto`}
        >
          {/* text */}
          <div className="flex-1 text-center md:text-left">
            <span className="text-8xl font-black text-white/[0.03] absolute -top-4 -left-4 select-none pointer-events-none hidden md:block">
              {step}
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
              {title}
            </h2>
            <p className="text-white/40 text-base md:text-lg mb-6 leading-relaxed">
              {description}
            </p>
            <ul className="space-y-2.5">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-white/50"
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          {/* visual */}
          <div className="flex-1 flex justify-center">{children}</div>
        </div>
      </div>
    </section>
  );
}

/* ── secondary feature card ─────────────────────────────── */
const secondaryFeatures = [
  {
    icon: Activity,
    title: 'Strava Auto-Sync',
    desc: 'Activities sync automatically from your watch or phone.',
  },
  {
    icon: Brain,
    title: 'AI Workout Suggestions',
    desc: 'Personalized training plans powered by AI.',
  },
  {
    icon: Trophy,
    title: 'Personal Records',
    desc: 'Track PRs across every exercise with full history.',
  },
  {
    icon: Smartphone,
    title: 'Install as App',
    desc: 'Works offline. Installable on any phone.',
  },
  {
    icon: Users,
    title: 'Coach-Athlete System',
    desc: 'Coaches assign workouts via a 6-letter code.',
  },
  {
    icon: Share2,
    title: 'Share & Export',
    desc: 'Share wraps, reviews, and workouts with friends.',
  },
];

/* ── page ────────────────────────────────────────────────── */
export default function PortfolioPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-black border border-white/20 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg">The Daily Athlete</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-white/40 hover:text-white/70 transition-colors hidden sm:inline"
            >
              Home
            </Link>
            <Link
              href="/features"
              className="text-sm text-white/40 hover:text-white/70 transition-colors hidden sm:inline"
            >
              Features
            </Link>
            <Link
              href="/contact"
              className="text-sm text-white/40 hover:text-white/70 transition-colors hidden sm:inline"
            >
              Contact
            </Link>
            <Button
              size="sm"
              asChild
              className="bg-red-600 hover:bg-red-700 text-white border-0 ml-2"
            >
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-600/10 border border-red-600/20 text-red-400 text-sm font-medium mb-6">
            <Eye className="h-3.5 w-3.5" />
            Product Tour
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 uppercase">
            See it in{' '}
            <span className="bg-gradient-to-r from-red-400 via-red-500 to-red-300 bg-clip-text text-transparent">
              action
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-10">
            A visual walkthrough of everything The Daily Athlete offers — from
            daily tracking to monthly reviews.
          </p>

          {/* Hero phone */}
          <PhoneFrame
            src="/portfolio/Dashboard.png"
            alt="The Daily Athlete dashboard showing stats, recent workouts, and training summary"
            className="w-[240px] md:w-[280px]"
            priority
          />
        </div>
      </section>

      {/* ─── Section 1: Calendar ───────────────────────── */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            {/* text */}
            <div className="text-center mb-10">
              <span className="text-8xl font-black text-white/[0.03] absolute -top-4 left-8 select-none pointer-events-none hidden md:block">
                01
              </span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
                Your training, visualized
              </h2>
              <p className="text-white/40 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                An interactive calendar that shows your entire training life at
                a glance. Switch between day, week, month, and year views.
              </p>
            </div>

            {/* desktop screenshot in browser frame */}
            <div className="relative">
              <div className="rounded-xl border border-white/[0.08] bg-black/60 overflow-hidden shadow-2xl shadow-black/60">
                {/* browser bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  </div>
                  <div className="flex-1 mx-8">
                    <div className="h-5 rounded-md bg-white/[0.04] max-w-xs mx-auto" />
                  </div>
                </div>
                <Image
                  src="/portfolio/Calendar.jpeg"
                  alt="Desktop calendar week view with color-coded Strava, completed, planned, and missed workouts"
                  width={1280}
                  height={660}
                  className="w-full h-auto"
                />
              </div>

              {/* mobile overlay in bottom-right */}
              <div className="absolute -bottom-6 -right-2 md:-right-6 z-10">
                <PhoneFrame
                  src="/portfolio/Calendar mobile Rupesh.png"
                  alt="Calendar mobile view showing planned bike and matched swim"
                  className="w-[120px] md:w-[160px]"
                />
              </div>
            </div>

            {/* bullets below */}
            <div className="grid sm:grid-cols-2 gap-3 mt-12 max-w-2xl mx-auto">
              {[
                'Color-coded status — green for done, orange for Strava, blue for planned',
                'Week view with daily workout pills and weekly summary',
                'Add notes, events, or workouts from any day cell',
                'Year view shows an activity heatmap across all 12 months',
              ].map((b) => (
                <div
                  key={b}
                  className="flex items-start gap-2.5 text-sm text-white/50"
                >
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* divider */}
      <div className="border-t border-white/[0.05]" />

      {/* ─── Section 2: Weekly Wrap ────────────────────── */}
      <FeatureSection
        step="02"
        title="Your week, wrapped"
        description="Every week, get a shareable capsule of your training. Per-sport stats with week-over-week comparison so you can see trends building."
        bullets={[
          'Monday–Sunday breakdown with distance, time, and session count',
          'Week-over-week percentage changes per sport',
          'Share directly to Instagram, WhatsApp, X, or iMessage',
          'Works in both light and dark mode',
        ]}
        reverse
      >
        {/* Two phones: light + dark overlapping */}
        <div className="relative flex items-center justify-center">
          <div className="relative z-10 -mr-8">
            <PhoneFrame
              src="/portfolio/Weekly wrap - Rishi.png"
              alt="Weekly training wrap in light mode showing running, strength, and swimming stats"
              className="w-[200px] md:w-[220px]"
            />
          </div>
          <div className="relative z-0 mt-8">
            <PhoneFrame
              src="/portfolio/Weekly wrap Rupesh.png"
              alt="Weekly training wrap in dark mode showing multi-sport breakdown"
              className="w-[200px] md:w-[220px]"
            />
          </div>
        </div>
      </FeatureSection>

      {/* divider */}
      <div className="border-t border-white/[0.05]" />

      {/* ─── Section 3: Monthly Review ─────────────────── */}
      <FeatureSection
        step="03"
        title="Monthly in review"
        description="A full month of training distilled into one visual page. See what worked, where you improved, and how your sports stack up."
        bullets={[
          'Key stats at a glance — workouts, distance, time, active days',
          'Per-sport breakdown with month-over-month comparison',
          'Activity heatmap calendar with color-coded intensity',
          'Save and share your monthly card with one tap',
        ]}
      >
        <PhoneFrame
          src="/portfolio/Screenshot - monthly review.png"
          alt="Monthly review showing February 2026 stats, sport breakdown, and share dialog"
          className="w-[240px] md:w-[260px]"
        />
      </FeatureSection>

      {/* divider */}
      <div className="border-t border-white/[0.05]" />

      {/* ─── Section 4: Multi-Sport (no screenshot) ────── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <span className="text-8xl font-black text-white/[0.03] absolute select-none pointer-events-none hidden md:block">
            04
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">
            Built for every sport
          </h2>
          <p className="text-white/40 text-base md:text-lg mb-8 leading-relaxed max-w-xl mx-auto">
            Log any sport with type-specific fields. Track distance, duration,
            pace, power, heart rate, and elevation — all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { emoji: '🏃', label: 'Running' },
              { emoji: '🚴', label: 'Cycling' },
              { emoji: '🏊', label: 'Swimming' },
              { emoji: '💪', label: 'Strength' },
              { emoji: '🏅', label: 'Triathlon' },
            ].map((s) => (
              <span
                key={s.label}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.04] border border-white/10 text-sm font-medium"
              >
                <span className="text-lg">{s.emoji}</span>
                {s.label}
              </span>
            ))}
          </div>
          <p className="text-sm text-white/30">
            Import your entire training history from CSV or XLSX.
            <br />
            Connect Strava to auto-sync every activity.
          </p>
        </div>
      </section>

      {/* ─── Secondary Features Grid ───────────────────── */}
      <section className="py-16 md:py-20 border-y border-white/[0.05] bg-white/[0.01]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3 uppercase">
              And a lot more
            </h2>
            <p className="text-white/40">
              Everything else that makes training easier.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {secondaryFeatures.map((f) => (
              <div
                key={f.title}
                className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-red-500/30 transition-all group"
              >
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="p-2 rounded-lg bg-red-600/20">
                    <f.icon className="h-4 w-4 text-red-400" />
                  </div>
                  <h3 className="font-bold text-sm group-hover:text-red-400 transition-colors">
                    {f.title}
                  </h3>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ───────────────────────────────────────── */}
      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-red-600/10 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 max-w-2xl text-center space-y-8">
          <Flame className="h-12 w-12 text-red-400 mx-auto" />
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">
            Ready to start
            <br />
            <span className="bg-gradient-to-r from-red-400 to-red-200 bg-clip-text text-transparent">
              training?
            </span>
          </h2>
          <p className="text-white/40 text-lg">
            Join athletes already using The Daily Athlete to train with purpose.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-14 px-10 bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/30 border-0 font-bold text-lg"
            >
              <Link href="/register">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-14 px-10 border-white/20 text-white hover:bg-white/5 hover:text-white font-bold text-lg"
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Footer ────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 bg-black">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-black border border-white/20 flex items-center justify-center">
              <Dumbbell className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/contact"
              className="text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Contact
            </Link>
            <p className="text-sm text-white/30">
              &copy; {new Date().getFullYear()} The Daily Athlete
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
