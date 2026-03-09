'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Brain,
  Dumbbell,
  Eye,
  Moon,
  Share2,
  Smartphone,
  Sun,
  Trophy,
  Users,
} from 'lucide-react';

/* ── theme definitions ──────────────────────────────────────── */
const dark = {
  page:         'bg-black text-white',
  header:       'border-white/10 bg-black/80',
  logo:         'bg-black border-white/20',
  logoIcon:     'text-white',
  logoText:     'text-white',
  navLink:      'text-white/40 hover:text-white/70',
  heroBadge:    'bg-red-600/10 border-red-600/20 text-red-400',
  heroSub:      'text-white/40',
  stepNum:      'text-white/[0.03]',
  sectionSub:   'text-white/40',
  bullet:       'text-white/50',
  divider:      'border-white/[0.05]',
  browserWrap:  'border-white/[0.08] bg-black/60 shadow-black/60',
  browserBar:   'border-white/[0.06] bg-white/[0.02]',
  browserDot:   'bg-white/10',
  browserUrl:   'bg-white/[0.04]',
  phone:        'border-white/[0.08] bg-black/60 shadow-black/60',
  notch:        'bg-black',
  sportPill:    'bg-white/[0.04] border-white/10',
  sportText:    '',
  featureGrid:  'border-white/[0.05] bg-white/[0.01]',
  featureCard:  'border-white/[0.06] bg-white/[0.02] hover:border-red-500/30',
  featureDesc:  'text-white/40',
  featureHover: 'group-hover:text-red-400',
  footer:       'border-white/10 bg-black',
  footerLogo:   'bg-black border-white/20',
  footerText:   'text-white/30 hover:text-white/60',
  footerCopy:   'text-white/30',
  toggleBg:     'bg-white/10 hover:bg-white/20',
  toggleIcon:   'text-white',
};

const light = {
  page:         'bg-gray-50 text-gray-900',
  header:       'border-gray-200 bg-white/90',
  logo:         'bg-white border-gray-200',
  logoIcon:     'text-gray-900',
  logoText:     'text-gray-900',
  navLink:      'text-gray-500 hover:text-gray-900',
  heroBadge:    'bg-red-50 border-red-200 text-red-600',
  heroSub:      'text-gray-500',
  stepNum:      'text-gray-900/[0.03]',
  sectionSub:   'text-gray-500',
  bullet:       'text-gray-600',
  divider:      'border-gray-100',
  browserWrap:  'border-gray-200 bg-white shadow-gray-200/80',
  browserBar:   'border-gray-200 bg-gray-50',
  browserDot:   'bg-gray-300',
  browserUrl:   'bg-gray-100',
  phone:        'border-gray-300 bg-gray-100 shadow-gray-300/60',
  notch:        'bg-gray-900',
  sportPill:    'bg-white border-gray-200',
  sportText:    'text-gray-700',
  featureGrid:  'border-gray-100 bg-gray-100/50',
  featureCard:  'border-gray-200 bg-white hover:border-red-300',
  featureDesc:  'text-gray-500',
  featureHover: 'group-hover:text-red-600',
  footer:       'border-gray-200 bg-white',
  footerLogo:   'bg-white border-gray-200',
  footerText:   'text-gray-400 hover:text-gray-700',
  footerCopy:   'text-gray-400',
  toggleBg:     'bg-gray-900/10 hover:bg-gray-900/20',
  toggleIcon:   'text-gray-700',
};

/* ── phone frame ────────────────────────────────────────────── */
function PhoneFrame({
  src, alt, className = '', priority = false, t,
}: {
  src: string; alt: string; className?: string; priority?: boolean;
  t: typeof dark;
}) {
  return (
    <div className={`relative mx-auto ${className}`}>
      <div className={`rounded-[2.5rem] border-[5px] ${t.phone} p-1.5 shadow-2xl`}>
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 ${t.notch} rounded-b-xl z-10`} />
        <div className="rounded-[2rem] overflow-hidden bg-black">
          <Image src={src} alt={alt} width={320} height={693} className="w-full h-auto" priority={priority} />
        </div>
      </div>
    </div>
  );
}

/* ── feature section ────────────────────────────────────────── */
function FeatureSection({
  step, title, description, bullets, children, reverse = false, t,
}: {
  step: string; title: string; description: string; bullets: string[];
  children: React.ReactNode; reverse?: boolean; t: typeof dark;
}) {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-12 md:gap-16 max-w-5xl mx-auto`}>
          <div className="flex-1 text-center md:text-left">
            <span className={`text-8xl font-black ${t.stepNum} absolute -top-4 -left-4 select-none pointer-events-none hidden md:block`}>
              {step}
            </span>
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">{title}</h2>
            <p className={`${t.sectionSub} text-base md:text-lg mb-6 leading-relaxed`}>{description}</p>
            <ul className="space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className={`flex items-start gap-2.5 text-sm ${t.bullet}`}>
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1 flex justify-center">{children}</div>
        </div>
      </div>
    </section>
  );
}

/* ── secondary features data ────────────────────────────────── */
const secondaryFeatures = [
  { icon: Activity,   title: 'Strava Auto-Sync',       desc: 'Activities sync automatically from your watch or phone.' },
  { icon: Brain,      title: 'AI Workout Suggestions',  desc: 'Personalized training plans powered by AI.' },
  { icon: Trophy,     title: 'Personal Records',        desc: 'Track PRs across every exercise with full history.' },
  { icon: Smartphone, title: 'Install as App',          desc: 'Works offline. Installable on any phone.' },
  { icon: Users,      title: 'Coach-Athlete System',    desc: 'Coaches assign workouts via a 6-letter code.' },
  { icon: Share2,     title: 'Share & Export',          desc: 'Share wraps, reviews, and workouts with friends.' },
];

/* ── page ────────────────────────────────────────────────────── */
export default function PortfolioPage() {
  const [isDark, setIsDark] = useState(false);
  const t = isDark ? dark : light;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${t.page}`}>

      {/* Header */}
      <header className={`border-b ${t.header} backdrop-blur-xl sticky top-0 z-50`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl border flex items-center justify-center ${t.logo}`}>
              <Dumbbell className={`h-4 w-4 ${t.logoIcon}`} />
            </div>
            <span className={`font-bold text-lg ${t.logoText}`}>The Daily Athlete</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/"        className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Home</Link>
            <Link href="/features" className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Features</Link>
            <Link href="/roadmap"  className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Roadmap</Link>
            <Link href="/comic"   className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Our Story</Link>
            <Link href="/contact"  className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Contact</Link>
            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg transition-colors ${t.toggleBg}`}
              aria-label="Toggle theme"
            >
              {isDark
                ? <Sun  className={`h-4 w-4 ${t.toggleIcon}`} />
                : <Moon className={`h-4 w-4 ${t.toggleIcon}`} />}
            </button>
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white border-0 ml-1">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 -left-40 w-[400px] h-[400px] bg-red-900/10 rounded-full blur-[100px]" />
        </div>
        <div className="container mx-auto px-4 pt-16 md:pt-24 pb-8 text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mb-6 ${t.heroBadge}`}>
            <Eye className="h-3.5 w-3.5" />
            Product Tour
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 uppercase">
            See it in{' '}
            <span className="bg-gradient-to-r from-red-400 via-red-500 to-red-300 bg-clip-text text-transparent">
              action
            </span>
          </h1>
          <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-10 ${t.heroSub}`}>
            A visual walkthrough of everything The Daily Athlete offers — from daily tracking to monthly reviews.
          </p>
          <PhoneFrame
            src="/portfolio/dashboard.png"
            alt="The Daily Athlete dashboard showing stats, recent workouts, and training summary"
            className="w-[240px] md:w-[280px]"
            priority
            t={t}
          />
        </div>
      </section>

      {/* ─── Section 1: Calendar ───────────────────────────── */}
      <section className="py-16 md:py-24 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className={`text-8xl font-black ${t.stepNum} absolute -top-4 left-8 select-none pointer-events-none hidden md:block`}>01</span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Your training, visualized</h2>
              <p className={`${t.sectionSub} text-base md:text-lg max-w-xl mx-auto leading-relaxed`}>
                An interactive calendar that shows your entire training life at a glance. Switch between day, week, month, and year views.
              </p>
            </div>

            {/* Desktop screenshot in browser frame */}
            <div className="relative">
              <div className={`rounded-xl border overflow-hidden shadow-2xl ${t.browserWrap}`}>
                <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${t.browserBar}`}>
                  <div className="flex gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${t.browserDot}`} />
                    <div className={`w-2.5 h-2.5 rounded-full ${t.browserDot}`} />
                    <div className={`w-2.5 h-2.5 rounded-full ${t.browserDot}`} />
                  </div>
                  <div className="flex-1 mx-8">
                    <div className={`h-5 rounded-md ${t.browserUrl} max-w-xs mx-auto`} />
                  </div>
                </div>
                <Image
                  src="/portfolio/calendar-desktop.jpeg"
                  alt="Desktop calendar week view with color-coded Strava, completed, planned, and missed workouts"
                  width={1280} height={660} className="w-full h-auto"
                />
              </div>
              {/* Mobile overlay in bottom-right */}
              <div className="absolute -bottom-6 -right-2 md:-right-6 z-10">
                <PhoneFrame
                  src="/portfolio/calendar-mobile.png"
                  alt="Calendar mobile view showing planned bike and matched swim"
                  className="w-[120px] md:w-[160px]"
                  t={t}
                />
              </div>
            </div>

            {/* Bullets */}
            <div className="grid sm:grid-cols-2 gap-3 mt-12 max-w-2xl mx-auto">
              {[
                'Color-coded status — green for done, orange for Strava, blue for planned',
                'Week view with daily workout pills and weekly summary',
                'Add notes, events, or workouts from any day cell',
                'Year view shows an activity heatmap across all 12 months',
              ].map((b) => (
                <div key={b} className={`flex items-start gap-2.5 text-sm ${t.bullet}`}>
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={`border-t ${t.divider}`} />

      {/* ─── Section 2: Weekly Wrap ─────────────────────────── */}
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
        t={t}
      >
        <div className="relative flex items-center justify-center">
          <div className="relative z-10 -mr-8">
            <PhoneFrame
              src="/portfolio/weekly-wrap-light.png"
              alt="Weekly training wrap in light mode showing running, strength, and swimming stats"
              className="w-[200px] md:w-[220px]"
              t={t}
            />
          </div>
          <div className="relative z-0 mt-8">
            <PhoneFrame
              src="/portfolio/weekly-wrap-dark.png"
              alt="Weekly training wrap in dark mode showing multi-sport breakdown"
              className="w-[200px] md:w-[220px]"
              t={t}
            />
          </div>
        </div>
      </FeatureSection>

      <div className={`border-t ${t.divider}`} />

      {/* ─── Section 3: Monthly Review ──────────────────────── */}
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
        t={t}
      >
        <PhoneFrame
          src="/portfolio/monthly-review.png"
          alt="Monthly review showing February 2026 stats, sport breakdown, and share dialog"
          className="w-[240px] md:w-[260px]"
          t={t}
        />
      </FeatureSection>

      <div className={`border-t ${t.divider}`} />

      {/* ─── Section 4: Multi-Sport ─────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <span className={`text-8xl font-black ${t.stepNum} absolute select-none pointer-events-none hidden md:block`}>04</span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-4">Built for every sport</h2>
          <p className={`${t.sectionSub} text-base md:text-lg mb-8 leading-relaxed max-w-xl mx-auto`}>
            Log any sport with type-specific fields. Track distance, duration, pace, power, heart rate, and elevation — all in one place.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              { emoji: '🏃', label: 'Running' },
              { emoji: '🚴', label: 'Cycling' },
              { emoji: '🏊', label: 'Swimming' },
              { emoji: '💪', label: 'Strength' },
              { emoji: '🏅', label: 'Triathlon' },
            ].map((s) => (
              <span key={s.label} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium ${t.sportPill} ${t.sportText}`}>
                <span className="text-lg">{s.emoji}</span>
                {s.label}
              </span>
            ))}
          </div>
          <p className={`text-sm ${t.footerCopy}`}>
            Import your entire training history from CSV or XLSX.<br />
            Connect Strava to auto-sync every activity.
          </p>
        </div>
      </section>

      {/* ─── Secondary Features Grid ────────────────────────── */}
      <section className={`py-16 md:py-20 border-y ${t.featureGrid}`}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3 uppercase">And a lot more</h2>
            <p className={t.sectionSub}>Everything else that makes training easier.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {secondaryFeatures.map((f) => (
              <div key={f.title} className={`p-5 rounded-2xl border transition-all group ${t.featureCard}`}>
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="p-2 rounded-lg bg-red-600/20">
                    <f.icon className="h-4 w-4 text-red-500" />
                  </div>
                  <h3 className={`font-bold text-sm transition-colors ${t.featureHover}`}>{f.title}</h3>
                </div>
                <p className={`text-xs leading-relaxed ${t.featureDesc}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className={`border-t py-8 ${t.footer}`}>
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg border flex items-center justify-center ${t.footerLogo}`}>
              <Dumbbell className={`h-4 w-4 ${t.logoIcon}`} />
            </div>
            <span className="font-bold">The Daily Athlete</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/contact" className={`text-sm transition-colors ${t.footerText}`}>Contact</Link>
            <p className={`text-sm ${t.footerCopy}`}>&copy; {new Date().getFullYear()} The Daily Athlete</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
