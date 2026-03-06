'use client';

import { useMemo, useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles, Trophy, Clock, MapPin, Dumbbell,
  Activity, UserPlus, LogIn, Lock, Share2, Flame,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/lib/stores/authStore';
import { cn } from '@/lib/utils';
import {
  computeSummary,
  computeTypeDistribution,
} from '@/lib/analytics';
import {
  StatCard,
  PieChart,
  formatDistance,
  formatHours,
  formatNumber,
  getInitials,
  TYPE_EMOJI,
  TYPE_COLORS,
  SPORT_LABELS,
  FEATURED_SPORTS,
} from '@/components/profile/ProfileComponents';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import type { Workout } from '@/types';

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

// ── Component ──

export function AthleteProfileClient({ profile }: { profile: AthleteProfileData }) {
  const currentUser = useAuthStore((s) => s.user);
  const isOwnProfile = currentUser?.username === profile.username;
  const [tagline, setTagline] = useState(profile.profileTagline);
  const [taglineLoading, setTaglineLoading] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

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

  // Derive active sports from workout history (only featured sports)
  const activeSports = useMemo(() => {
    return typeDistribution
      .filter(td => FEATURED_SPORTS.has(td.type))
      .map(td => td.type);
  }, [typeDistribution]);

  // Filter type distribution to featured sports only for pie chart
  const pieData = useMemo(() => {
    const featured = typeDistribution.filter(td => FEATURED_SPORTS.has(td.type));
    const total = featured.reduce((sum, td) => sum + td.count, 0);
    if (total === 0) return [];
    return featured.map(td => ({
      ...td,
      percentage: Math.round((td.count / total) * 100),
    }));
  }, [typeDistribution]);

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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── Hero ── */}
        <section className="text-center space-y-3">
          <Avatar className="w-24 h-24 mx-auto ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            {profile.photoURL && <AvatarImage src={profile.photoURL} alt={profile.displayName} />}
            <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary/20 to-orange-500/20">
              {getInitials(profile.displayName)}
            </AvatarFallback>
          </Avatar>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{profile.displayName}</h1>
            <p className="text-muted-foreground font-mono text-sm">@{profile.username}</p>
          </div>

          {(tagline || taglineLoading) && (
            <p className={cn(
              'text-muted-foreground italic text-sm max-w-sm mx-auto transition-opacity duration-500',
              taglineLoading ? 'opacity-0' : 'opacity-100',
            )}>
              &ldquo;{tagline}&rdquo;
            </p>
          )}

          {profile.bio && (
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{profile.bio}</p>
          )}

          {/* Sport pills from workout history */}
          {activeSports.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-center">
              {activeSports.map(sport => (
                <Badge key={sport} variant="secondary" className="text-xs gap-1">
                  {TYPE_EMOJI[sport]} {SPORT_LABELS[sport] || sport}
                </Badge>
              ))}
              {profile.experienceLevel && (
                <Badge variant="outline" className="text-xs">{profile.experienceLevel}</Badge>
              )}
            </div>
          )}

          {/* Share Profile Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShare(!showShare)}
            className="gap-2"
          >
            <Share2 className="h-4 w-4" />
            Share Profile
          </Button>
        </section>

        {/* Share Profile Panel */}
        {showShare && (
          <section className="space-y-4">
            <ShareButtons
              title="Share Profile"
              shareText={`Check out ${profile.displayName}'s athlete profile on The Daily Athlete 💪`}
              shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/athlete/${profile.username}` : ''}
              fileName={`${profile.username}-profile`}
              cardRef={shareCardRef}
              onClose={() => setShowShare(false)}
            />

            {/* Share Preview Card */}
            <div className="rounded-xl border overflow-hidden">
              <p className="text-xs text-muted-foreground px-4 py-2 bg-muted/30">Preview — this is what people will see</p>
              <div ref={shareCardRef} className="p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-red-950" style={{ width: '100%', minHeight: 200 }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">DA</span>
                    </div>
                    <span className="text-gray-400 text-sm font-medium">The Daily Athlete</span>
                  </div>
                  <span className="text-gray-500 text-xs">@{profile.username}</span>
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500/30 to-orange-500/30 flex items-center justify-center border-2 border-white/10 overflow-hidden">
                    {profile.photoURL ? (
                      <img src={profile.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold text-white">{getInitials(profile.displayName)}</span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
                    {tagline && <p className="text-sm text-gray-400 italic">{tagline}</p>}
                  </div>
                </div>

                {activeSports.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {activeSports.map(sport => (
                      <span key={sport} className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-white/80">
                        {TYPE_EMOJI[sport]} {SPORT_LABELS[sport] || sport}
                      </span>
                    ))}
                  </div>
                )}

                {hasWorkouts && (
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Streak</p>
                      <p className="text-white text-xl font-bold">{summary.currentStreak} <span className="text-base">🔥</span></p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Workouts</p>
                      <p className="text-white text-xl font-bold">{summary.completedWorkouts}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Hours</p>
                      <p className="text-white text-xl font-bold">{formatHours(summary.totalHours)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Distance</p>
                      <p className="text-white text-xl font-bold">{formatDistance(summary.totalDistanceKm)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Stats Grid ── */}
        {hasWorkouts && (
          <section>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <StatCard value={`${summary.currentStreak}`} label="Day Streak" icon={<Flame className="w-3.5 h-3.5 text-orange-500" />} />
              <StatCard value={String(summary.completedWorkouts)} label="Workouts" icon={<Dumbbell className="w-3.5 h-3.5" />} />
              <StatCard value={formatHours(summary.totalHours)} label="Hours Trained" icon={<Clock className="w-3.5 h-3.5" />} />
              <StatCard value={formatDistance(summary.totalDistanceKm)} label="Distance" icon={<MapPin className="w-3.5 h-3.5" />} />
              {summary.totalCalories > 0 && (
                <StatCard value={formatNumber(summary.totalCalories)} label="Calories" icon={<Activity className="w-3.5 h-3.5" />} />
              )}
            </div>
          </section>
        )}

        {/* ── Training Breakdown (pie chart) + Recent Workouts side by side on desktop ── */}
        {hasWorkouts && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Pie chart */}
            {pieData.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Training Breakdown</h2>
                <div className="flex items-center justify-center">
                  <PieChart data={pieData} size={140} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center">
                  {pieData.map(td => (
                    <div key={td.type} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: td.color }} />
                      <span className="capitalize">{SPORT_LABELS[td.type] || td.type}</span>
                      <span className="text-muted-foreground">{td.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent workouts */}
            {recentWorkouts.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Workouts</h2>
                <div className="space-y-1.5">
                  {recentWorkouts.map(w => (
                    <div key={w.id} className="flex items-center gap-2.5 py-1.5">
                      <span className="text-base">{TYPE_EMOJI[w.type] || '⚡'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{w.name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(w.date), 'MMM d')}</p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular-nums">
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
              </div>
            )}
          </section>
        )}

        {/* ── PR Showcase ── */}
        {topPRs.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Personal Records</h2>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {topPRs.map(pr => (
                <div key={pr.id} className="rounded-xl border bg-card p-3.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm font-medium truncate">{pr.name}</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {pr.value} <span className="text-xs font-normal text-muted-foreground">{pr.unit}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(pr.date), 'MMM d, yyyy')}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ── */}
        {!hasWorkouts && (
          <div className="text-center py-10 space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted">
              <Sparkles className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium">Just getting started!</p>
            <p className="text-sm text-muted-foreground">Check back soon for training stats.</p>
          </div>
        )}

        {/* ── CTA ── */}
        {!isOwnProfile && <CTABanner isLoggedIn={!!currentUser} />}
      </div>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-xs text-muted-foreground">
        Powered by <Link href="/" className="font-semibold hover:text-foreground transition-colors">The Daily Athlete</Link>
      </footer>
    </div>
  );
}

// ── Sub-components ──

function HeaderBar() {
  return (
    <header className="border-b">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
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

function CTABanner({ isLoggedIn }: { isLoggedIn: boolean }) {
  if (isLoggedIn) return null;

  return (
    <section className="rounded-2xl border bg-gradient-to-br from-card to-primary/5 p-6 text-center space-y-3">
      <div className="space-y-1">
        <h3 className="text-lg font-bold">Track your training journey</h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Join The Daily Athlete to sync your workouts and share your progress.
        </p>
      </div>
      <div className="flex gap-3 justify-center">
        <Button size="sm" asChild>
          <Link href="/register"><UserPlus className="w-4 h-4 mr-1.5" />Sign Up Free</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/login"><LogIn className="w-4 h-4 mr-1.5" />Log In</Link>
        </Button>
      </div>
    </section>
  );
}
