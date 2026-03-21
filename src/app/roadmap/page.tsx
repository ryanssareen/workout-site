'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import {
  Activity, BarChart3, Bell, Brain, Calendar, CheckCircle2,
  Circle, Clock, Code2, Dumbbell, Eye, Flag, Flame, GitMerge,
  Globe, Heart, Layers, Link2, Mail, Map, Rocket,
  Share2, Shield, Smartphone, Sparkles, Star, Target,
  TrendingUp, Trophy, Upload, Users, Video, Zap,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────── */
type FeatureStatus = 'done' | 'building' | 'planned' | 'future';
type PhaseStatus   = 'complete' | 'active' | 'upcoming' | 'future';

interface Feature {
  icon: React.ElementType;
  name: string;
  desc: string;
  status: FeatureStatus;
}

interface Phase {
  num: string;
  name: string;
  tagline: string;
  status: PhaseStatus;
  features: Feature[];
}

/* ── Roadmap data ───────────────────────────────────────────── */
const PHASES: Phase[] = [
  {
    num: '01', name: 'Foundation', status: 'complete',
    tagline: 'The building blocks every athlete needs',
    features: [
      { icon: Dumbbell,   name: 'Multi-Sport Logging',    desc: 'Run, bike, swim, strength, and custom workout types with type-specific fields',  status: 'done' },
      { icon: Shield,     name: 'Secure Auth',             desc: 'Email/password and Google sign-in via Firebase with username system',             status: 'done' },
      { icon: Users,      name: 'Coach-Athlete System',    desc: 'Coaches and athletes connect via a unique 6-letter code',                         status: 'done' },
      { icon: Calendar,   name: 'Calendar Views',          desc: 'Day, week, month, and year training calendars with workout pills',                 status: 'done' },
      { icon: Upload,     name: 'History Import',          desc: 'CSV/XLSX import with AI-assisted parsing — bring your entire training history',    status: 'done' },
      { icon: Mail,       name: 'Email Reminders',         desc: 'Day-before workout reminders and 10-day training summaries',                      status: 'done' },
      { icon: Globe,      name: 'Athlete Profiles',        desc: 'Public profile page with sport stats, PRs, and recent workouts (SSR)',             status: 'done' },
      { icon: TrendingUp, name: 'Progress Tracking',       desc: 'Streaks, completion rates, all-time stats, and upcoming event countdowns',         status: 'done' },
    ],
  },
  {
    num: '02', name: 'Intelligence & Sharing', status: 'complete',
    tagline: 'AI, real-time sync, and shareable moments',
    features: [
      { icon: Activity,   name: 'Strava Auto-Sync',        desc: 'OAuth connect + phase-based sync (2d → 7d → 30d) with Firestore quota protection', status: 'done' },
      { icon: Brain,      name: 'AI Workout Tagging',       desc: 'LLaMA auto-classifies imported Strava activities by effort and intensity',         status: 'done' },
      { icon: Sparkles,   name: 'AI Suggestions',           desc: '3-tier pipeline: logic engine → LLaMA 70B enhancement → validator with retry',    status: 'done' },
      { icon: Share2,     name: 'Weekly Wrap',              desc: 'Shareable weekly capsule — per-sport stats, week-over-week %, export to image',     status: 'done' },
      { icon: BarChart3,  name: 'Monthly Review',           desc: 'Activity heatmap, sport breakdown, month-over-month comparison, shareable card',    status: 'done' },
      { icon: Star,       name: 'Yearly Wrapped',           desc: '8-slide interactive recap with a guess game, public sharing, and OG images',       status: 'done' },
      { icon: Trophy,     name: 'Personal Records',         desc: 'Automatic PR detection across all sports with full history timeline',               status: 'done' },
      { icon: Smartphone, name: 'PWA & Offline',            desc: 'Installable on any device, works offline via service worker caching',              status: 'done' },
      { icon: Bell,       name: 'Push Notifications',       desc: 'Web Push for Strava sync alerts and weekly wrap ready notifications',               status: 'done' },
    ],
  },
  {
    num: '03', name: 'Integrations & Polish', status: 'active',
    tagline: 'Reliability, analytics, and growth tooling',
    features: [
      { icon: GitMerge,   name: 'Manual Strava Merge',      desc: 'Link missed planned workouts to Strava activities when auto-merge fails',          status: 'done' },
      { icon: Eye,        name: 'Product Analytics',        desc: 'PostHog integration for user behaviour tracking and funnel analysis',               status: 'done' },
      { icon: Map,        name: 'Marketing Pages',          desc: 'Features, Portfolio, and Roadmap pages with light/dark theme toggle',               status: 'done' },
      { icon: Link2,      name: 'Custom Domain',            desc: 'thedailyathlete.in — DNS fully resolved and SSL active',                           status: 'building' },
      { icon: Zap,        name: 'Strava Webhooks',          desc: 'Real-time activity delivery instead of polling on every page load',                 status: 'building' },
      { icon: Clock,      name: 'Offline Improvements',     desc: 'Better caching strategy, background sync queue, and offline workout creation',      status: 'planned' },
    ],
  },
  {
    num: '04', name: 'Growth', status: 'upcoming',
    tagline: 'More data sources, deeper coaching intelligence',
    features: [
      { icon: Activity,   name: 'Garmin Connect',           desc: 'Direct sync from Garmin watches and Edge cycling computers',                       status: 'planned' },
      { icon: Heart,      name: 'Apple Health',             desc: 'Read workouts and health data from iPhone and Apple Watch',                         status: 'planned' },
      { icon: Target,     name: 'Training Load (TSS)',       desc: 'ATL/CTL/TSB fitness, fatigue, and form curves — the full performance model',       status: 'planned' },
      { icon: Flame,      name: 'Group Challenges',         desc: 'Compete with friends on distance targets, streaks, and weekly volume',              status: 'planned' },
      { icon: Brain,      name: 'Adaptive AI Plans',        desc: 'Weekly plans that auto-adjust based on actual performance and recovery signals',    status: 'planned' },
      { icon: Flag,       name: 'Race Predictions',         desc: 'Time estimates for target events based on current training data',                   status: 'planned' },
    ],
  },
  {
    num: '05', name: 'Scale', status: 'future',
    tagline: 'Teams, APIs, and the platform layer',
    features: [
      { icon: Users,      name: 'Teams & Clubs',            desc: 'Group leaderboards, shared training plans, and club-wide challenges',               status: 'future' },
      { icon: Code2,      name: 'Public API',               desc: 'REST API and webhooks for third-party integrations and custom dashboards',          status: 'future' },
      { icon: Layers,     name: 'Nutrition Integration',    desc: 'Connect food tracking apps and correlate nutrition with training load and recovery', status: 'future' },
      { icon: Video,      name: 'Video Workouts',           desc: 'Guided strength and mobility sessions streamed in-app',                             status: 'future' },
      { icon: Smartphone, name: 'Native Mobile App',        desc: 'iOS and Android apps with offline-first logging and GPS tracking',                  status: 'future' },
      { icon: Rocket,     name: 'AI Race Coach',            desc: 'Pacing strategies, taper guidance, and real-time race day coaching',                status: 'future' },
    ],
  },
];

/* ── Derived stats ──────────────────────────────────────────── */
const allFeatures  = PHASES.flatMap((p) => p.features);
const doneCount    = allFeatures.filter((f) => f.status === 'done').length;
const totalCount   = allFeatures.length;
const pct          = Math.round((doneCount / totalCount) * 100);

/* ── Status config ──────────────────────────────────────────── */
const PHASE_CONFIG: Record<PhaseStatus, {
  border: string; glow: string; badge: string; badgeDot: string; label: string;
}> = {
  complete: {
    border:   'border-emerald-500/40',
    glow:     'bg-emerald-500/5',
    badge:    'bg-emerald-500/10 border-emerald-500/30 text-emerald-600',
    badgeDot: 'bg-emerald-500',
    label:    'Complete',
  },
  active: {
    border:   'border-blue-500/40',
    glow:     'bg-blue-500/5',
    badge:    'bg-blue-500/10 border-blue-500/30 text-blue-600',
    badgeDot: 'bg-blue-500 animate-pulse',
    label:    'Building Now',
  },
  upcoming: {
    border:   'border-amber-500/30',
    glow:     'bg-amber-500/3',
    badge:    'bg-amber-500/10 border-amber-500/30 text-amber-600',
    badgeDot: 'bg-amber-500',
    label:    'Up Next',
  },
  future: {
    border:   'border-purple-500/20',
    glow:     'bg-purple-500/3',
    badge:    'bg-purple-500/10 border-purple-500/30 text-purple-500',
    badgeDot: 'bg-purple-500',
    label:    'Future',
  },
};

const FEAT_CONFIG: Record<FeatureStatus, {
  dot: string; dotAnim: string; pill: string; pillText: string; label: string;
}> = {
  done:     { dot: 'bg-emerald-500',                      dotAnim: '',              pill: 'bg-emerald-500/10 border-emerald-500/20', pillText: 'text-emerald-600', label: 'Shipped'  },
  building: { dot: 'bg-blue-500',                         dotAnim: 'animate-pulse', pill: 'bg-blue-500/10 border-blue-500/20',       pillText: 'text-blue-600',    label: 'Building' },
  planned:  { dot: 'bg-amber-400',                        dotAnim: '',              pill: 'bg-amber-500/10 border-amber-400/20',     pillText: 'text-amber-600',   label: 'Planned'  },
  future:   { dot: 'bg-purple-400',                       dotAnim: '',              pill: 'bg-purple-500/10 border-purple-400/20',   pillText: 'text-purple-500',  label: 'Future'   },
};

/* ── Theme-aware styles ─────────────────────────────────────── */
const styles = {
  page:       'bg-background text-foreground',
  header:     'border-border bg-background/80',
  logo:       'bg-foreground',
  logoIcon:   'text-background',
  navLink:    'text-muted-foreground hover:text-foreground/70',
  heroBadge:  'bg-red-600/10 border-red-600/20 text-red-400',
  heroSub:    'text-muted-foreground',
  progress:   'bg-muted/50 border-border',
  progFill:   'bg-gradient-to-r from-emerald-500 to-emerald-400',
  progLabel:  'text-muted-foreground',
  legend:     'border-border bg-muted/30',
  legendText: 'text-foreground/50',
  phaseWrap:  'bg-muted/20',
  phaseNum:   'text-foreground/[0.04]',
  phaseName:  'text-foreground',
  phaseTag:   'text-muted-foreground',
  featCard:   'bg-muted/30 border-border hover:border-foreground/[0.12]',
  featName:   'text-foreground',
  featDesc:   'text-muted-foreground',
  footer:     'border-border bg-background',
  footerText: 'text-muted-foreground hover:text-foreground/60',
  footerCopy: 'text-muted-foreground',
};

/* ── Page ───────────────────────────────────────────────────── */
export default function RoadmapPage() {
  const t = styles;

  return (
    <div className={`min-h-screen transition-colors duration-300 ${t.page}`}>

      {/* ─── Header ──────────────────────────────────────────── */}
      <header className={`border-b ${t.header} backdrop-blur-xl sticky top-0 z-50`}>
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${t.logo}`}>
              <Dumbbell className={`h-4 w-4 ${t.logoIcon}`} />
            </div>
            <span className={`font-bold text-lg ${t.logoIcon}`}>The Daily Athlete</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/"          className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Home</Link>
            <Link href="/features"  className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Features</Link>
            <Link href="/contact"   className={`text-sm transition-colors hidden sm:inline ${t.navLink}`}>Contact</Link>
            <ThemeToggle />
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white border-0 ml-1">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[120px]" />
          <div className="absolute top-20 -left-40 w-[400px] h-[400px] bg-emerald-600/6 rounded-full blur-[120px]" />
        </div>
        <div className="container mx-auto px-4 pt-16 md:pt-20 pb-10 text-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium mb-5 ${t.heroBadge}`}>
            <Rocket className="h-3.5 w-3.5" />
            Product Roadmap
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 uppercase">
            Built in the{' '}
            <span className="bg-gradient-to-r from-red-400 via-red-500 to-red-300 bg-clip-text text-transparent">
              open
            </span>
          </h1>
          <p className={`text-lg md:text-xl max-w-2xl mx-auto mb-10 ${t.heroSub}`}>
            Track every feature from idea to shipped — what we&apos;ve built, what we&apos;re building, and where we&apos;re heading.
          </p>

          {/* ── Overall progress bar ── */}
          <div className={`max-w-md mx-auto rounded-2xl border p-5 shadow-sm ${t.progress}`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-semibold ${t.phaseName}`}>{doneCount} features shipped</span>
              <span className={`text-sm font-black text-emerald-500`}>{pct}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-muted/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ${t.progFill}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={`flex justify-between mt-2 text-xs ${t.progLabel}`}>
              <span>{doneCount} done</span>
              <span>{totalCount - doneCount} planned</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Status legend ── */}
      <div className="container mx-auto px-4 pb-10">
        <div className={`flex flex-wrap justify-center gap-x-6 gap-y-2 py-3 px-5 rounded-xl border max-w-lg mx-auto ${t.legend}`}>
          {([
            { status: 'done',     label: 'Shipped'  },
            { status: 'building', label: 'Building' },
            { status: 'planned',  label: 'Planned'  },
            { status: 'future',   label: 'Future'   },
          ] as { status: FeatureStatus; label: string }[]).map(({ status, label }) => {
            const cfg = FEAT_CONFIG[status];
            return (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot} ${cfg.dotAnim}`} />
                <span className={`text-xs font-medium ${t.legendText}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Phases ──────────────────────────────────────────── */}
      <div className="container mx-auto px-4 pb-20 space-y-6 max-w-5xl">
        {PHASES.map((phase) => {
          const pcfg = PHASE_CONFIG[phase.status];
          const phaseDone  = phase.features.filter((f) => f.status === 'done').length;
          const phaseTotal = phase.features.length;
          const phasePct   = Math.round((phaseDone / phaseTotal) * 100);

          return (
            <div
              key={phase.num}
              className={`relative rounded-2xl border-2 overflow-hidden ${pcfg.border} ${t.phaseWrap}`}
            >
              {/* Subtle phase color glow */}
              <div className={`absolute inset-0 ${pcfg.glow} pointer-events-none`} />

              <div className="relative p-6 md:p-8">
                {/* Phase header */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
                  <div className="flex items-start gap-4">
                    {/* Big phase number */}
                    <div className={`text-6xl md:text-7xl font-black leading-none select-none ${t.phaseNum}`}>
                      {phase.num}
                    </div>
                    <div>
                      <h2 className={`text-xl md:text-2xl font-black tracking-tight ${t.phaseName}`}>
                        {phase.name}
                      </h2>
                      <p className={`text-sm mt-1 ${t.phaseTag}`}>{phase.tagline}</p>
                      {/* Mini progress for non-complete phases */}
                      {phase.status !== 'complete' && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-1.5 w-24 rounded-full overflow-hidden bg-muted/50">
                            <div
                              className={`h-full rounded-full ${t.progFill}`}
                              style={{ width: `${phasePct}%` }}
                            />
                          </div>
                          <span className={`text-xs ${t.progLabel}`}>{phaseDone}/{phaseTotal}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phase status badge */}
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold self-start ${pcfg.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pcfg.badgeDot}`} />
                    {pcfg.label}
                    {phase.status === 'complete' && (
                      <CheckCircle2 className="h-3 w-3 ml-0.5" />
                    )}
                  </div>
                </div>

                {/* Feature grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {phase.features.map((feat) => {
                    const fcfg = FEAT_CONFIG[feat.status];
                    const Icon = feat.icon;
                    return (
                      <div
                        key={feat.name}
                        className={`relative p-4 rounded-xl border transition-all ${t.featCard}`}
                      >
                        {/* Status dot top-right */}
                        <div className={`absolute top-3 right-3 h-2 w-2 rounded-full ${fcfg.dot} ${fcfg.dotAnim}`} />

                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg mt-0.5 ${fcfg.pill} border`}>
                            <Icon className={`h-3.5 w-3.5 ${fcfg.pillText}`} />
                          </div>
                          <div className="min-w-0 pr-4">
                            <div className={`text-sm font-bold leading-tight ${t.featName}`}>{feat.name}</div>
                            <div className={`text-xs mt-1 leading-relaxed ${t.featDesc}`}>{feat.desc}</div>
                          </div>
                        </div>

                        {/* Status label bottom */}
                        <div className="mt-3 pt-2.5 border-t border-current border-opacity-10">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${fcfg.pillText}`}>
                            {feat.status === 'done'     && <CheckCircle2 className="h-3 w-3" />}
                            {feat.status === 'building' && <Zap          className="h-3 w-3" />}
                            {feat.status === 'planned'  && <Circle       className="h-3 w-3" />}
                            {feat.status === 'future'   && <Star         className="h-3 w-3" />}
                            {fcfg.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className={`border-t py-8 ${t.footer}`}>
        <div className="container mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.logo}`}>
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
