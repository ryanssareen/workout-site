'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getUserWorkouts, getPersonalRecords, getMilestones } from '@/lib/firebase/firestore';
import { computeSummary, computeTypeDistribution } from '@/lib/analytics';
import { PhotoUpload } from '@/components/profile/PhotoUpload';
import {
  StatCard,
  PieChart,
  formatDistance,
  formatHours,
  formatNumber,
  getInitials,
  TYPE_EMOJI,
  SPORT_LABELS,
  FEATURED_SPORTS,
} from '@/components/profile/ProfileComponents';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Pencil,
  Dumbbell,
  Clock,
  MapPin,
  Activity,
  Trophy,
  Sparkles,
  Flame,
  Star,
  Medal,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import type { Workout, PersonalRecord } from '@/types';
import type { Milestone } from '@/types/achievements';

const MILESTONE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star, medal: Medal, award: Award, trophy: Trophy, flame: Flame, dumbbell: Dumbbell,
};

const MILESTONE_CATEGORY_COLORS: Record<string, string> = {
  workout_count: 'from-amber-400 to-orange-500',
  distance: 'from-green-400 to-emerald-500',
  streak: 'from-orange-400 to-red-500',
  first_ever: 'from-blue-400 to-cyan-500',
};

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getUserWorkouts(user.username, user.role as 'coach' | 'athlete' | 'student'),
      getPersonalRecords(user.username),
      getMilestones(user.username),
    ]).then(([w, pr, ms]) => {
      setWorkouts(w);
      setPersonalRecords(pr);
      setMilestones(ms);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user]);

  // Analytics
  const summary = useMemo(() => computeSummary(workouts), [workouts]);
  const typeDistribution = useMemo(() => computeTypeDistribution(workouts), [workouts]);

  const activeSports = useMemo(
    () => typeDistribution.filter(td => FEATURED_SPORTS.has(td.type)).map(td => td.type),
    [typeDistribution],
  );

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
    return [...workouts]
      .filter(w => w.completed)
      .sort((a, b) => {
        const ad = a.date?.toDate?.() ?? new Date(a.date as any);
        const bd = b.date?.toDate?.() ?? new Date(b.date as any);
        return bd.getTime() - ad.getTime();
      })
      .slice(0, 5);
  }, [workouts]);

  const topPRs = useMemo(() => {
    return [...personalRecords]
      .sort((a, b) => {
        const ad = a.date?.toDate?.() ?? new Date(a.date as any);
        const bd = b.date?.toDate?.() ?? new Date(b.date as any);
        return bd.getTime() - ad.getTime();
      })
      .slice(0, 3);
  }, [personalRecords]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const hasWorkouts = workouts.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* ── Hero ── */}
      <section className="text-center space-y-3">
        <div className="flex justify-center">
          <PhotoUpload user={user} size={96} />
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{user.displayName}</h1>
          <p className="text-muted-foreground font-mono text-sm">@{user.username}</p>
        </div>

        {user.profileTagline && (
          <p className="text-muted-foreground italic text-sm max-w-sm mx-auto">
            &ldquo;{user.profileTagline}&rdquo;
          </p>
        )}

        {user.bio && (
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{user.bio}</p>
        )}

        {/* Sport pills */}
        {activeSports.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {activeSports.map(sport => (
              <Badge key={sport} variant="secondary" className="text-xs gap-1">
                {TYPE_EMOJI[sport]} {SPORT_LABELS[sport] || sport}
              </Badge>
            ))}
            {user.experienceLevel && (
              <Badge variant="outline" className="text-xs">{user.experienceLevel}</Badge>
            )}
          </div>
        )}

        {/* Training For */}
        {user.trainingFor && user.trainingFor.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            {user.trainingFor.map(t => (
              <Badge key={t} variant="outline" className="text-xs font-normal">{t}</Badge>
            ))}
          </div>
        )}

        {/* Events */}
        {user.events && user.events.filter(e => e.eventName || e.eventDate).length > 0 && (
          <div className="space-y-1">
            {user.events.filter(e => e.eventName || e.eventDate).map((e, i) => (
              <p key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{e.goal}</span>
                {e.eventName && <> — {e.eventName}</>}
                {e.eventDate && <> ({e.eventDate})</>}
              </p>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" asChild>
          <Link href="/settings"><Pencil className="h-4 w-4 mr-1.5" />Edit Profile</Link>
        </Button>
      </section>

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

      {/* ── Training Breakdown + Recent Workouts ── */}
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
                {recentWorkouts.map(w => {
                  const d = w.date?.toDate?.() ?? new Date(w.date as any);
                  return (
                    <Link key={w.id} href={`/workouts/${w.id}`} className="flex items-center gap-2.5 py-1.5 hover:bg-muted/50 rounded-lg px-1 -mx-1 transition-colors">
                      <span className="text-base">{TYPE_EMOJI[w.type] || '⚡'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{w.name}</p>
                        <p className="text-[11px] text-muted-foreground">{format(d, 'MMM d')}</p>
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
                    </Link>
                  );
                })}
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
            {topPRs.map(pr => {
              const d = pr.date?.toDate?.() ?? new Date(pr.date as any);
              return (
                <div key={pr.id} className="rounded-xl border bg-card p-3.5 space-y-1">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm font-medium truncate">{pr.name}</span>
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {pr.value} <span className="text-xs font-normal text-muted-foreground">{pr.unit}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{format(d, 'MMM d, yyyy')}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Milestones ── */}
      {milestones.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Milestones</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {milestones.map(ms => {
              const d = ms.date?.toDate?.() ?? new Date(ms.date as any);
              const IconComp = MILESTONE_ICON_MAP[ms.icon] || Star;
              const gradient = MILESTONE_CATEGORY_COLORS[ms.category] || 'from-amber-400 to-orange-500';
              return (
                <div key={ms.id} className="rounded-xl border bg-card p-3.5 text-center space-y-2">
                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm mx-auto`}>
                    <IconComp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{ms.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{ms.description}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{format(d, 'MMM d, yyyy')}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Empty state ── */}
      {!hasWorkouts && (
        <div className="text-center py-10 space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-muted">
            <Sparkles className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-base font-medium">Start training!</p>
          <p className="text-sm text-muted-foreground">Your stats and progress will appear here.</p>
        </div>
      )}
    </div>
  );
}
