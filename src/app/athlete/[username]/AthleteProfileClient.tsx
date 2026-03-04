'use client';

import { useMemo, useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Trophy, Flame, Clock, MapPin, Dumbbell,
  Activity, UserPlus, LogIn, Lock, Calendar,
} from 'lucide-react';
import { format, subMonths, eachDayOfInterval, getDay, startOfWeek } from 'date-fns';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import {
  computeSummary,
  computeTypeDistribution,
  computeCalendarData,
  computeInsights,
  type SummaryStats,
  type TypeDistribution,
  type CalendarDay,
} from '@/lib/analytics';
import type { Workout, WorkoutType } from '@/types';

// ── Types ──

export interface AthleteProfileData {
  isPrivate: boolean;
  displayName: string;
  username: string;
  photoURL: string | null;
  bio: string | null;
  ageRange: string | null;
  experienceLevel: string | null;
  sportPreferences: string[];
  trainingFor: string[];
  profileTagline: string | null;
  stravaConnected: boolean;
  memberSince: string | null;
  workouts: SerializedWorkout[];
  personalRecords: SerializedPR[];
}

interface SerializedWorkout {
  id: string;
  name: string;
  type: string;
  date: string;
  completed: boolean;
  duration?: number;
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
    avgHeartRate?: number;
    elevationGain?: number;
  };
  strength?: {
    exercises?: {
      name: string;
      sets: number;
      reps: number;
      weight?: number;
      weightUnit?: string;
    }[];
  };
}

interface SerializedPR {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: string;
  date: string;
}

// ── Constants ──

const TYPE_EMOJI: Record<string, string> = {
  run: '🏃', bike: '🚴', swim: '🏊', strength: '💪', other: '⚡',
};

const TYPE_COLORS: Record<string, string> = {
  swim: '#3b82f6', run: '#22c55e', bike: '#f97316', strength: '#a855f7', other: '#6b7280',
};

const AGE_LABELS: Record<string, string> = {
  'under-18': 'Under 18', '18-24': '18–24', '25-34': '25–34',
  '35-44': '35–44', '45-54': '45–54', '55-64': '55–64', '65+': '65+',
};

// ── Helpers ──

function formatDistance(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
  if (km >= 100) return `${Math.round(km)} km`;
  return `${km.toFixed(1)} km`;
}

function formatHours(h: number): string {
  if (h >= 100) return `${Math.round(h)}h`;
  return `${h.toFixed(1)}h`;
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return n.toLocaleString();
  return String(Math.round(n));
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ── Component ──

export function AthleteProfileClient({ profile }: { profile: AthleteProfileData }) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = currentUser?.username === profile.username;
  const [tagline, setTagline] = useState(profile.profileTagline);
  const [taglineLoading, setTaglineLoading] = useState(false);

  // Lazy-load tagline if not cached
  useEffect(() => {
    if (tagline || profile.isPrivate || profile.workouts.length === 0) return;
    setTaglineLoading(true);
    fetch('/api/ai/profile-tagline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profile.username }),
    })
      .then(res => res.json())
      .then(data => { if (data.tagline) setTagline(data.tagline); })
      .catch(() => {})
      .finally(() => setTaglineLoading(false));
  }, [tagline, profile.isPrivate, profile.workouts.length, profile.username]);

  // Cast serialized workouts for analytics functions
  const workouts = useMemo(() => profile.workouts as unknown as Workout[], [profile.workouts]);
  const summary = useMemo(() => computeSummary(workouts), [workouts]);
  const typeDistribution = useMemo(() => computeTypeDistribution(workouts), [workouts]);
  const calendarData = useMemo(() => computeCalendarData(workouts, 12), [workouts]);
  const insights = useMemo(() => computeInsights(workouts), [workouts]);

  const recentWorkouts = useMemo(() => {
    return [...profile.workouts]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [profile.workouts]);

  const topPRs = useMemo(() => {
    return [...profile.personalRecords]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  }, [profile.personalRecords]);

  // ── Private profile ──
  if (profile.isPrivate) {
    return (
      <div className="min-h-screen bg-background">
        <HeaderBar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          <p className="text-muted-foreground">This profile is private.</p>
          <CTABanner isLoggedIn={!!currentUser} />
        </div>
      </div>
    );
  }

  const hasWorkouts = profile.workouts.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <HeaderBar />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">
        {/* ── Hero ── */}
        <section className="text-center space-y-4">
          <Avatar className="w-24 h-24 mx-auto ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            {profile.photoURL && <AvatarImage src={profile.photoURL} alt={profile.displayName} />}
            <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary/20 to-orange-500/20">
              {getInitials(profile.displayName)}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{profile.displayName}</h1>
            <p className="text-muted-foreground font-mono text-sm">@{profile.username}</p>
          </div>

          {(tagline || taglineLoading) && (
            <p className={cn(
              'text-muted-foreground italic max-w-md mx-auto transition-opacity duration-500',
              taglineLoading ? 'opacity-0' : 'opacity-100',
            )}>
              &ldquo;{tagline}&rdquo;
            </p>
          )}

          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">{profile.bio}</p>
          )}

          {profile.stravaConnected && (
            <Badge variant="outline" className="text-xs gap-1">
              <Activity className="w-3 h-3" /> Strava Connected
            </Badge>
          )}
        </section>

        {/* ── Stats Grid ── */}
        {hasWorkouts && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard value={String(summary.completedWorkouts)} label="Workouts" icon={<Dumbbell className="w-4 h-4" />} />
              <StatCard value={formatHours(summary.totalHours)} label="Hours Trained" icon={<Clock className="w-4 h-4" />} />
              <StatCard value={formatDistance(summary.totalDistanceKm)} label="Distance" icon={<MapPin className="w-4 h-4" />} />
              <StatCard value={`${summary.currentStreak}d`} label="Current Streak" icon={<Flame className="w-4 h-4" />} accent />
              {summary.totalCalories > 0 && (
                <StatCard value={formatNumber(summary.totalCalories)} label="Calories" icon={<Activity className="w-4 h-4" />} />
              )}
              <StatCard value={`${Math.round(summary.completionRate)}%`} label="Completion" icon={<Trophy className="w-4 h-4" />} />
            </div>
          </section>
        )}

        {/* ── Personal Info Strip ── */}
        <section className="flex flex-wrap gap-2 justify-center">
          {profile.ageRange && AGE_LABELS[profile.ageRange] && (
            <Badge variant="secondary">{AGE_LABELS[profile.ageRange]}</Badge>
          )}
          {profile.experienceLevel && (
            <Badge variant="secondary">{profile.experienceLevel}</Badge>
          )}
          {profile.sportPreferences.map(sport => (
            <Badge key={sport} variant="outline">{sport}</Badge>
          ))}
          {profile.memberSince && (
            <Badge variant="outline" className="text-xs">
              Member since {format(new Date(profile.memberSince), 'MMM yyyy')}
            </Badge>
          )}
        </section>

        {/* ── Sport Breakdown ── */}
        {hasWorkouts && typeDistribution.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Training Breakdown</h2>
            {/* Stacked bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-muted">
              {typeDistribution.map(td => (
                <div
                  key={td.type}
                  style={{ width: `${td.percentage}%`, backgroundColor: td.color }}
                  className="transition-all duration-500"
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {typeDistribution.map(td => (
                <div key={td.type} className="flex items-center gap-1.5 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: td.color }} />
                  <span className="capitalize">{td.type}</span>
                  <span className="text-muted-foreground">{td.percentage}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Activity Heatmap ── */}
        {hasWorkouts && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Activity</h2>
            <ActivityHeatmap data={calendarData} />
          </section>
        )}

        {/* ── PR Showcase ── */}
        {topPRs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Records</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {topPRs.map(pr => (
                <div key={pr.id} className="rounded-xl border bg-card p-4 space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium truncate">{pr.name}</span>
                  </div>
                  <p className="text-2xl font-bold tabular-nums">
                    {pr.value} <span className="text-sm font-normal text-muted-foreground">{pr.unit}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(pr.date), 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Recent Activity ── */}
        {recentWorkouts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Workouts</h2>
            <div className="space-y-2">
              {recentWorkouts.map(w => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                  <span className="text-lg">{TYPE_EMOJI[w.type] || '⚡'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(w.date), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {w.actualStats?.distance
                      ? `${(w.actualStats.distance / 1000).toFixed(1)} km`
                      : w.actualStats?.duration
                        ? `${Math.round(w.actualStats.duration / 60)} min`
                        : w.duration
                          ? `${w.duration} min`
                          : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {!hasWorkouts && (
          <div className="text-center py-12 space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted">
              <Sparkles className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">Just getting started!</p>
            <p className="text-sm text-muted-foreground">Check back soon for training stats and achievements.</p>
          </div>
        )}

        {/* ── CTA ── */}
        {!isOwnProfile && <CTABanner isLoggedIn={!!currentUser} />}
      </div>

      {/* Footer */}
      <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground">
        Powered by <Link href="/" className="font-semibold hover:text-foreground transition-colors">The Daily Athlete</Link> — Train Harder. Track Smarter.
      </footer>
    </div>
  );
}

// ── Sub-components ──

function HeaderBar() {
  return (
    <header className="border-b">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm">The Daily Athlete</span>
        </Link>
      </div>
    </header>
  );
}

function StatCard({ value, label, icon, accent }: {
  value: string; label: string; icon: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 text-center space-y-1 transition-colors',
      accent && 'border-primary/30 bg-primary/5',
    )}>
      <div className="flex justify-center text-muted-foreground">{icon}</div>
      <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums tracking-tight', accent && 'text-primary')}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ActivityHeatmap({ data }: { data: CalendarDay[] }) {
  // Build weeks grid: 53 columns x 7 rows
  const weeks: (CalendarDay | null)[][] = [];
  let currentWeek: (CalendarDay | null)[] = [];

  if (data.length === 0) return null;

  // Pad the first week
  const firstDayOfWeek = getDay(data[0].date);
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(null);
  }

  for (const day of data) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  // Month labels
  const monthLabels: { label: string; weekIdx: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIdx) => {
    for (const day of week) {
      if (day) {
        const month = day.date.getMonth();
        if (month !== lastMonth) {
          monthLabels.push({ label: format(day.date, 'MMM'), weekIdx });
          lastMonth = month;
        }
        break;
      }
    }
  });

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        {/* Month labels */}
        <div className="flex mb-1 text-[10px] text-muted-foreground" style={{ paddingLeft: '18px' }}>
          {monthLabels.map((m, i) => (
            <span
              key={i}
              className="absolute"
              style={{ marginLeft: `${m.weekIdx * 14}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>
        <div className="flex gap-[2px] mt-4">
          {/* Day labels */}
          <div className="flex flex-col gap-[2px] text-[10px] text-muted-foreground pr-1">
            {['', 'M', '', 'W', '', 'F', ''].map((d, i) => (
              <div key={i} className="h-[12px] flex items-center justify-end">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px]">
              {week.map((day, di) => (
                <div
                  key={di}
                  className={cn(
                    'w-[12px] h-[12px] rounded-sm',
                    !day ? 'bg-transparent' :
                    day.count === 0 ? 'bg-muted/50' :
                    day.count === 1 ? 'bg-primary/30' :
                    day.count === 2 ? 'bg-primary/60' :
                    'bg-primary',
                  )}
                  title={day ? `${format(day.date, 'MMM d, yyyy')}: ${day.count} workout${day.count !== 1 ? 's' : ''}` : undefined}
                />
              ))}
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1 mt-2 justify-end text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="w-[12px] h-[12px] rounded-sm bg-muted/50" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary/30" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary/60" />
          <div className="w-[12px] h-[12px] rounded-sm bg-primary" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function CTABanner({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) return null;

  return (
    <section className="rounded-2xl border bg-gradient-to-br from-card to-primary/5 p-8 text-center space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-bold">Track your training journey</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Join The Daily Athlete to sync your workouts, get AI coaching insights, and share your progress.
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <Button asChild>
          <Link href="/register"><UserPlus className="w-4 h-4 mr-2" />Sign Up Free</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/login"><LogIn className="w-4 h-4 mr-2" />Log In</Link>
        </Button>
      </div>
    </section>
  );
}
