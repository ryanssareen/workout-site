'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/dashboard/ThemeToggle';
import {
  Activity, ArrowRight, Brain, Calendar,
  ChevronLeft, ChevronRight, Dumbbell, Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════
   Theme-aware styles
   ═══════════════════════════════════════════════════════════════ */
const styles = {
  page:         'bg-background text-foreground',
  header:       'border-border bg-background/80',
  logo:         'bg-foreground',
  logoIcon:     'text-background',
  navLink:      'text-muted-foreground hover:text-foreground/70',
  panelBg:      'bg-card',
  panelBorder:  'border-foreground',
  panelShadow:  'shadow-[6px_6px_0_0_hsl(var(--foreground)/0.15)]',
  bubbleBg:     'bg-card',
  bubbleBorder: 'border-foreground',
  bubbleText:   'text-foreground',
  bubbleTail:   'border-t-foreground',
  thinkDot:     'border-foreground bg-card',
  narrationBg:  'bg-amber-900/30 border-amber-400/20',
  narrationText:'text-amber-200',
  textMuted:    'text-muted-foreground',
  textSubtle:   'text-muted-foreground',
  halftone:     'text-foreground',
  dotInactive:  'bg-muted-foreground/30',
  dotActive:    'bg-red-500',
  navBtn:       'bg-muted/50 hover:bg-muted text-foreground',
  navBtnDis:    'bg-muted/30 text-muted-foreground/30',
  footer:       'border-border bg-background',
  footerText:   'text-muted-foreground hover:text-foreground/60',
  footerCopy:   'text-muted-foreground',
  // Slide-specific
  phoneBg:      'bg-muted border-border',
  phoneScreen:  'bg-background',
  laptopBg:     'bg-muted border-border',
  laptopScreen: 'bg-background',
  socialBg:     'bg-card border-border',
  cellBg:       'bg-muted/50',
  lockBanner:   'bg-orange-600/90',
  miniPanel:    'bg-card border-border',
  starburstBg:  'bg-red-600/10',
  glowBg:       'bg-yellow-500/10',
};

type Theme = typeof styles;

/* ═══════════════════════════════════════════════════════════════
   Reusable comic primitives
   ═══════════════════════════════════════════════════════════════ */
function SpeechBubble({ children, direction = 'left', className, t }: {
  children: React.ReactNode; direction?: 'left' | 'right' | 'think'; className?: string; t: Theme;
}) {
  return (
    <div className={cn('relative rounded-2xl px-4 py-2.5 border-2 text-sm font-medium', t.bubbleBg, t.bubbleBorder, t.bubbleText, className)}>
      {children}
      {direction === 'left' && (
        <div className={cn('absolute -bottom-2.5 left-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px]', t.bubbleTail)} />
      )}
      {direction === 'right' && (
        <div className={cn('absolute -bottom-2.5 right-6 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px]', t.bubbleTail)} />
      )}
      {direction === 'think' && (
        <>
          <div className={cn('absolute -bottom-2 left-8 w-2.5 h-2.5 rounded-full border-2', t.thinkDot)} />
          <div className={cn('absolute -bottom-4.5 left-5 w-1.5 h-1.5 rounded-full border-2', t.thinkDot)} />
        </>
      )}
    </div>
  );
}

function Character({ emoji, label, className, t }: {
  emoji: string; label?: string; className?: string; t: Theme;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-0.5', className)}>
      <span className="text-4xl sm:text-5xl">{emoji}</span>
      {label && <span className={cn('text-[10px] font-bold uppercase tracking-wider', t.textMuted)}>{label}</span>}
    </div>
  );
}

function NarrationBox({ children, t, className }: { children: React.ReactNode; t: Theme; className?: string }) {
  return (
    <div className={cn('px-4 py-2 border-2 text-sm font-semibold italic', t.narrationBg, t.narrationText, className)}>
      {children}
    </div>
  );
}

function ActionText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('inline-block font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tight text-red-600 -rotate-2 transform', className)}>
      {text}
    </span>
  );
}

function Halftone({ t }: { t: Theme }) {
  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', t.halftone)}
      style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '14px 14px', opacity: 0.03 }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════
   Individual slides
   ═══════════════════════════════════════════════════════════════ */

function SlideTitle({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 text-center">
      <Halftone t={t} />
      <span className="text-6xl sm:text-7xl">🏋️</span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight leading-tight">
        The Daily Athlete
      </h2>
      <div className="h-1 w-20 bg-red-500 rounded-full" />
      <NarrationBox t={t} className="max-w-xs">An Origin Story</NarrationBox>
      <p className={cn('text-xs max-w-sm', t.textSubtle)}>Swipe or use arrows to read</p>
    </div>
  );
}

function SlideCookieCutter({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <NarrationBox t={t}>Meanwhile, at training camp...</NarrationBox>
      <Character emoji="🧑‍🏫" label="Coach" t={t} />
      <SpeechBubble t={t} direction="left" className="max-w-xs text-center">
        &quot;Everyone does 5 x 800m today! Same pace, same rest, same plan.&quot;
      </SpeechBubble>
      <div className="grid grid-cols-4 gap-2 sm:gap-3 mt-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="text-2xl sm:text-3xl">🏃</span>
            <SpeechBubble t={t} direction="think" className="text-xs px-2 py-1 mt-1">...</SpeechBubble>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideWrongPlan({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <Character emoji="🏃‍♂️" label="" className="text-5xl sm:text-6xl" t={t} />
      <SpeechBubble t={t} direction="left" className="max-w-xs text-center text-base">
        &quot;But I&apos;m training for a <span className="font-black">marathon</span>, not a 5K...&quot;
      </SpeechBubble>
      <div className="mt-4">
        <NarrationBox t={t} className="max-w-sm text-center">
          Every athlete is different.<br />But the plans aren&apos;t.
        </NarrationBox>
      </div>
    </div>
  );
}

function SlideStravaPaywall({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Phone mockup */}
      <div className={cn('rounded-2xl border-2 p-3 w-48 sm:w-52 shrink-0', t.phoneBg)}>
        <div className={cn('rounded-xl overflow-hidden', t.phoneScreen)}>
          <div className="bg-orange-600 text-white text-center py-1.5 text-xs font-bold tracking-wider">STRAVA</div>
          <div className="p-3 space-y-2">
            <div className={cn('text-xs font-bold', t.bubbleText)}>Your Performance</div>
            {/* Blurred/locked stats */}
            <div className="space-y-1.5">
              {['Fitness', 'Relative Effort', 'Training Log'].map((s) => (
                <div key={s} className={cn('h-5 rounded blur-[3px]', t.cellBg)} />
              ))}
            </div>
            <div className={cn('text-center text-[10px] font-bold text-white py-1.5 rounded-lg mt-3', t.lockBanner)}>
              Upgrade to Summit &mdash; $11.99/mo
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Character emoji="😐" t={t} />
        <SpeechBubble t={t} direction="think" className="max-w-[200px] text-sm">
          &quot;I just want to see my weekly stats...&quot;
        </SpeechBubble>
      </div>
    </div>
  );
}

function SlideSpreadsheet({ t }: { t: Theme }) {
  const cols = ['Date', 'Type', 'Dist', 'Time', 'Notes'];
  const rows = [
    ['03/01', 'Run', '5km', '28m', 'Easy'],
    ['03/02', 'Swim', '1.5k', '35m', 'Drills'],
    ['03/03', 'Bike', '??', '?hr', ''],
    ['03/04', '???', '', '', 'forgot'],
    ['03/05', '', '', '', ''],
  ];
  return (
    <div className="flex flex-col items-center gap-5">
      <NarrationBox t={t}>Plan B: The spreadsheet.</NarrationBox>
      {/* Laptop mockup */}
      <div className={cn('rounded-xl border-2 p-2 max-w-sm w-full', t.laptopBg)}>
        <div className={cn('rounded-lg overflow-hidden p-2', t.laptopScreen)}>
          <table className="w-full text-[10px] sm:text-xs">
            <thead>
              <tr>{cols.map((c) => <th key={c} className={cn('px-1 py-0.5 font-bold text-left', t.textMuted)}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={i > 2 ? 'opacity-40' : ''}>
                  {r.map((c, j) => <td key={j} className={cn('px-1 py-0.5', t.bubbleText)}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Laptop base */}
        <div className={cn('h-2 mt-1 rounded-b-lg', t.cellBg)} />
      </div>
      <Character emoji="😩" t={t} />
      <p className={cn('text-sm font-medium text-center', t.textMuted)}>...gave up by week two.</p>
    </div>
  );
}

function SlideEliteOnly({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <NarrationBox t={t}>Meanwhile, on social media...</NarrationBox>
      {/* Fake social post */}
      <div className={cn('rounded-xl border-2 p-4 max-w-xs w-full', t.socialBg)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">PA</div>
          <div>
            <div className={cn('text-xs font-bold', t.bubbleText)}>Pro Athlete XYZ</div>
            <div className={cn('text-[10px]', t.textSubtle)}>Sponsored Athlete</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {['Nike', 'Garmin', 'GU', 'Hoka'].map((s) => (
            <span key={s} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-bold">{s}</span>
          ))}
        </div>
        <p className={cn('text-xs', t.textMuted)}>&quot;Just finished my 180km training week! 🔥 Recovery in Chamonix next week&quot;</p>
        <div className="flex gap-3 mt-2 text-[10px]">
          <span>❤️ 4,832</span>
          <span>💬 287</span>
        </div>
      </div>
      <Character emoji="📱" t={t} />
      <SpeechBubble t={t} direction="think" className="max-w-xs text-sm text-center">
        &quot;Cool, but... that&apos;s not me.&quot;
      </SpeechBubble>
    </div>
  );
}

function SlideWhatAboutUs({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <h3 className="text-2xl sm:text-3xl font-black text-center">What about the rest of us?</h3>
      <div className="grid grid-cols-3 gap-4 sm:gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl sm:text-5xl">🏃‍♀️</span>
          <p className={cn('text-[10px] sm:text-xs font-medium leading-tight', t.textMuted)}>
            Parent who runs<br />during lunch break
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl sm:text-5xl">🏊‍♂️</span>
          <p className={cn('text-[10px] sm:text-xs font-medium leading-tight', t.textMuted)}>
            Office worker who<br />swims at 6 AM
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-4xl sm:text-5xl">🚴‍♂️</span>
          <p className={cn('text-[10px] sm:text-xs font-medium leading-tight', t.textMuted)}>
            Weekend cyclist<br />chasing sunsets
          </p>
        </div>
      </div>
      <NarrationBox t={t} className="text-center max-w-xs">
        Not trying to go pro. Just trying to <span className="not-italic font-black">show up.</span>
      </NarrationBox>
    </div>
  );
}

function SlideDailyAthletes({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Halftone t={t} />
      <p className={cn('text-lg sm:text-xl font-bold', t.textMuted)}>Not full-time athletes.</p>
      <p className="text-xl sm:text-2xl font-black leading-tight">
        But every single day,<br />they show up.
      </p>
      <div className="flex gap-2 sm:gap-3 text-3xl sm:text-4xl my-2">
        {['🏃', '🚴', '🏊', '💪', '🧘', '⛹️'].map((e) => (
          <span key={e} className="animate-bounce" style={{ animationDelay: `${Math.random() * 0.4}s` }}>{e}</span>
        ))}
      </div>
      <ActionText text="Daily." />
    </div>
  );
}

function SlideLightbulb({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className={cn('w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center', t.glowBg)}>
        <span className="text-6xl sm:text-7xl">💡</span>
      </div>
      <SpeechBubble t={t} direction="left" className="max-w-xs text-base text-center">
        &quot;What if we built something <span className="font-black">honest?</span>&quot;
      </SpeechBubble>
      <p className={cn('text-sm font-medium', t.textMuted)}>
        No paywalls. No gatekeeping.<br />Just training.
      </p>
    </div>
  );
}

function SlideAppReveal({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <p className={cn('text-sm font-bold uppercase tracking-widest', t.textMuted)}>Introducing</p>
      <h3 className="text-2xl sm:text-3xl font-black">The Daily Athlete</h3>
      {/* Simplified phone */}
      <div className={cn('rounded-2xl border-2 p-2 w-44 sm:w-48', t.phoneBg)}>
        <div className={cn('rounded-xl p-3 space-y-2', t.phoneScreen)}>
          <div className="flex items-center gap-2 mb-2">
            <Dumbbell className="h-3 w-3 text-red-500" />
            <span className="text-[10px] font-bold">Dashboard</span>
          </div>
          {/* Stat blocks */}
          <div className="grid grid-cols-2 gap-1.5">
            {['🔥 7 day streak', '🏃 12.4 km', '⏱️ 5h 20m', '💪 4 sessions'].map((s) => (
              <div key={s} className={cn('text-[9px] px-1.5 py-1 rounded-md font-medium', t.cellBg)}>{s}</div>
            ))}
          </div>
          {/* Mini workout rows */}
          <div className="space-y-1 mt-1">
            {['Run — 5km', 'Swim — 1.2km', 'Strength'].map((w) => (
              <div key={w} className={cn('text-[9px] px-2 py-1 rounded', t.cellBg)}>{w}</div>
            ))}
          </div>
        </div>
      </div>
      <ActionText text="Simple." className="mt-1" />
    </div>
  );
}

function SlideFeatures({ t }: { t: Theme }) {
  const items = [
    { icon: Calendar, label: 'Visual Calendar',  emoji: '📅' },
    { icon: Activity, label: 'Strava Sync',      emoji: '🔄' },
    { icon: Brain,    label: 'AI Suggestions',    emoji: '🤖' },
    { icon: Share2,   label: 'Weekly Wrap',       emoji: '📊' },
  ];
  return (
    <div className="flex flex-col items-center gap-4">
      <h3 className="text-xl sm:text-2xl font-black text-center">Everything you actually need</h3>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {items.map(({ icon: Icon, label, emoji }) => (
          <div key={label} className={cn('rounded-xl border-2 p-3 sm:p-4 flex flex-col items-center gap-2 text-center', t.miniPanel)}>
            <span className="text-2xl sm:text-3xl">{emoji}</span>
            <div className="flex items-center gap-1.5">
              <Icon className="h-3 w-3 text-red-500" />
              <span className="text-xs font-bold">{label}</span>
            </div>
          </div>
        ))}
      </div>
      <p className={cn('text-xs text-center', t.textSubtle)}>And personal records, push notifications, coach system, import, monthly review, yearly wrapped...</p>
    </div>
  );
}

function SlideCommunity({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Halftone t={t} />
      <div className="flex -space-x-1 text-4xl sm:text-5xl">
        {['🏃‍♀️', '🚴‍♂️', '🏊‍♀️', '💪', '🧘‍♂️', '⛹️‍♀️', '🤸‍♂️'].map((e) => (
          <span key={e}>{e}</span>
        ))}
      </div>
      <h3 className="text-xl sm:text-2xl font-black leading-tight">
        Built for daily athletes,<br />
        <span className="text-red-500">by daily athletes.</span>
      </h3>
      <p className={cn('text-sm max-w-xs', t.textMuted)}>
        We use this app ourselves. Every feature exists because we needed it.
      </p>
    </div>
  );
}

function SlideEarlyAccess({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center relative">
      {/* Starburst */}
      <div className={cn('absolute -top-8 -right-8 w-36 h-36 rounded-full rotate-12 blur-xl opacity-60', t.starburstBg)} />
      <div className={cn('absolute -bottom-6 -left-6 w-28 h-28 rounded-full -rotate-12 blur-xl opacity-40', t.starburstBg)} />
      <ActionText text="Free" className="text-5xl sm:text-6xl rotate-0" />
      <p className="text-lg sm:text-xl font-black">during early access</p>
      <div className="h-px w-24 bg-red-500/40" />
      <div className="space-y-1">
        <p className={cn('text-sm font-medium', t.textMuted)}>No credit card. No trial period.</p>
        <p className={cn('text-sm font-medium', t.textMuted)}>Just training.</p>
      </div>
      <NarrationBox t={t} className="max-w-xs text-center mt-2">
        We&apos;re building this in the open.
      </NarrationBox>
    </div>
  );
}

function SlideCTA({ t }: { t: Theme }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <Dumbbell className="h-10 w-10 text-red-500" />
      <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight leading-tight">
        Start your<br />
        <span className="bg-gradient-to-r from-red-400 to-red-300 bg-clip-text text-transparent">training journey</span>
      </h3>
      <p className={cn('text-sm', t.textMuted)}>Join daily athletes training with purpose.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="bg-red-600 hover:bg-red-700 text-white border-0 font-bold shadow-lg shadow-red-600/30">
          <Link href="/register">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
        <Button asChild size="lg" variant="outline" className={cn('font-bold', t.panelBorder)}>
          <Link href="/register">See the App</Link>
        </Button>
      </div>
      <p className={cn('text-xs mt-2', t.textSubtle)}>Built with ❤️ for daily athletes</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Slide registry
   ═══════════════════════════════════════════════════════════════ */
const SLIDES: { key: string; render: (t: Theme) => React.ReactNode }[] = [
  { key: 'title',           render: (t) => <SlideTitle t={t} /> },
  { key: 'cookie-cutter',   render: (t) => <SlideCookieCutter t={t} /> },
  { key: 'wrong-plan',      render: (t) => <SlideWrongPlan t={t} /> },
  { key: 'strava-paywall',  render: (t) => <SlideStravaPaywall t={t} /> },
  { key: 'spreadsheet',     render: (t) => <SlideSpreadsheet t={t} /> },
  { key: 'elite-only',      render: (t) => <SlideEliteOnly t={t} /> },
  { key: 'what-about-us',   render: (t) => <SlideWhatAboutUs t={t} /> },
  { key: 'daily-athletes',  render: (t) => <SlideDailyAthletes t={t} /> },
  { key: 'lightbulb',       render: (t) => <SlideLightbulb t={t} /> },
  { key: 'app-reveal',      render: (t) => <SlideAppReveal t={t} /> },
  { key: 'features',        render: (t) => <SlideFeatures t={t} /> },
  { key: 'community',       render: (t) => <SlideCommunity t={t} /> },
  { key: 'early-access',    render: (t) => <SlideEarlyAccess t={t} /> },
  { key: 'cta',             render: (t) => <SlideCTA t={t} /> },
];

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */
export default function ComicPage() {
  const [current, setCurrent] = useState(0);
  const [animateIn, setAnimateIn] = useState(true);
  const touchStartX = useRef(0);
  const t = styles;

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= SLIDES.length) return;
    setAnimateIn(false);
    setTimeout(() => {
      setCurrent(idx);
      setAnimateIn(true);
    }, 50);
  }, []);

  const goNext = useCallback(() => goTo(current + 1), [goTo, current]);
  const goPrev = useCallback(() => goTo(current - 1), [goTo, current]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  return (
    <div className={cn('min-h-screen transition-colors duration-300 flex flex-col', t.page)}>

      {/* ─── Header ──────────────────────────────────── */}
      <header className={cn('border-b backdrop-blur-xl sticky top-0 z-50', t.header)}>
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', t.logo)}>
              <Dumbbell className={cn('h-3.5 w-3.5', t.logoIcon)} />
            </div>
            <span className={cn('font-bold text-base hidden sm:inline', t.logoIcon)}>The Daily Athlete</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/"          className={cn('text-xs sm:text-sm transition-colors hidden sm:inline', t.navLink)}>Home</Link>
            <ThemeToggle />
            <Button size="sm" asChild className="bg-red-600 hover:bg-red-700 text-white border-0 text-xs h-8">
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Slide area ──────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx < -50) goNext();
          if (dx > 50)  goPrev();
        }}
      >
        {/* Comic panel */}
        <div className={cn(
          'relative w-full max-w-lg rounded-2xl border-[3px] p-6 sm:p-8 md:p-10 min-h-[400px] sm:min-h-[440px] flex items-center justify-center overflow-hidden',
          t.panelBg, t.panelBorder, t.panelShadow,
          'transition-all duration-500',
          animateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.98]',
        )}>
          {SLIDES[current].render(t)}
        </div>
      </div>

      {/* ─── Bottom nav ──────────────────────────────── */}
      <div className={cn('sticky bottom-0 border-t py-3 px-4 backdrop-blur-xl z-40', t.header)}>
        <div className="container mx-auto max-w-lg flex items-center justify-between gap-4">
          {/* Prev button */}
          <button
            onClick={goPrev}
            disabled={current === 0}
            className={cn('p-2 rounded-lg transition-colors', current === 0 ? t.navBtnDis : t.navBtn)}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={cn(
                  'h-2 rounded-full transition-all duration-300 shrink-0',
                  i === current ? cn('w-6', t.dotActive) : cn('w-2', t.dotInactive),
                )}
              />
            ))}
          </div>

          {/* Next button */}
          <button
            onClick={goNext}
            disabled={current === SLIDES.length - 1}
            className={cn('p-2 rounded-lg transition-colors', current === SLIDES.length - 1 ? t.navBtnDis : t.navBtn)}
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Slide counter */}
        <p className={cn('text-center text-[10px] mt-1.5', t.textSubtle)}>
          {current + 1} / {SLIDES.length}
        </p>
      </div>
    </div>
  );
}
