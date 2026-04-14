'use client';

import { useEffect, useState, useRef } from 'react';
import { getPersonalRecords, getMilestones, updateMilestoneDate } from '@/lib/firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Star, ChevronRight, Flame, Medal, Award, X, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { safeToDate } from '@/lib/dateUtils';
import { Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import type { PersonalRecord } from '@/types';
import type { Milestone } from '@/types/achievements';
import { MilestoneCard } from './MilestoneCard';
import { ShareButtons } from '@/components/workouts/ShareWorkoutCard';
import { useWorkoutStore } from '@/lib/stores/workoutStore';

const MILESTONE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star, medal: Medal, award: Award, trophy: Trophy, flame: Flame,
};

const CATEGORY_COLORS: Record<string, string> = {
  workout_count: 'text-amber-500',
  distance: 'text-green-500',
  streak: 'text-orange-500',
  first_ever: 'text-blue-500',
};

interface DashboardAchievementsProps {
  username: string;
  /** Pre-fetched PRs — if provided, skips Firestore read */
  prefetchedPRs?: PersonalRecord[];
  /** Pre-fetched milestones — if provided, skips Firestore read */
  prefetchedMilestones?: Milestone[];
}

export function DashboardAchievements({ username, prefetchedPRs, prefetchedMilestones }: DashboardAchievementsProps) {
  const [prs, setPrs] = useState<PersonalRecord[]>(prefetchedPRs?.slice(0, 3) ?? []);
  const [milestones, setMilestones] = useState<Milestone[]>(prefetchedMilestones?.slice(0, 3) ?? []);
  const [loading, setLoading] = useState(!prefetchedPRs && !prefetchedMilestones);
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const milestoneCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Skip fetch if data was provided via props
    if (prefetchedPRs || prefetchedMilestones) {
      if (prefetchedPRs) setPrs(prefetchedPRs.slice(0, 3));
      if (prefetchedMilestones) setMilestones(prefetchedMilestones.slice(0, 3));
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const [prData, msData] = await Promise.all([
          getPersonalRecords(username),
          getMilestones(username),
        ]);
        setPrs(prData.slice(0, 3));
        setMilestones(msData.slice(0, 3));
      } catch (error) {
        console.error('Failed to load achievements:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username, prefetchedPRs, prefetchedMilestones]);

  // Self-heal milestone epoch-zero dates: if any milestone has a date at or before
  // Unix epoch (Dec 31, 1969 / Jan 1, 1970 bug), look up the actual first workout
  // of that type and patch the Firestore document.
  useEffect(() => {
    if (milestones.length === 0) return;

    const EPOCH_THRESHOLD = 86400000; // 1 day in ms — anything before Jan 2, 1970 is suspect
    const badMilestones = milestones.filter(ms => {
      const d = safeToDate({ date: ms.date });
      return d.getTime() < EPOCH_THRESHOLD;
    });
    if (badMilestones.length === 0) return;

    (async () => {
      try {
        const allWorkouts = await useWorkoutStore.getState().getWorkouts(username, 'athlete');
        const completed = allWorkouts.filter(w => w.completed);
        let changed = false;

        for (const ms of badMilestones) {
          // For first_ever milestones, find the earliest workout of that type
          // For other categories, find the earliest completed workout overall
          const candidates = ms.category === 'first_ever'
            ? completed.filter(w => w.type === ms.unit)
            : completed;

          const dates = candidates
            .map(w => safeToDate(w))
            .filter(d => d.getTime() > EPOCH_THRESHOLD)
            .sort((a, b) => a.getTime() - b.getTime());

          if (dates.length > 0) {
            await updateMilestoneDate(username, ms.id, dates[0]);
            // Update local state so the UI shows the correct date immediately
            ms.date = Timestamp.fromDate(dates[0]);
            changed = true;
          }
        }

        if (changed) {
          setMilestones(prev => [...prev]); // trigger re-render
          console.log(`[milestones] self-healed ${badMilestones.length} epoch-zero dates`);
        }
      } catch (err) {
        console.error('[milestones] self-heal failed (non-fatal):', err);
      }
    })();
  }, [milestones.length, username]); // only run when milestones first load

  if (loading) return null;

  const hasPRs = prs.length > 0;
  const hasMilestones = milestones.length > 0;
  if (!hasPRs && !hasMilestones) return null;

  return (
    <div className={`grid gap-4 ${hasPRs && hasMilestones ? 'lg:grid-cols-2' : ''}`}>
      {/* Recent PRs */}
      {hasPRs && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Recent PRs
              </CardTitle>
              <Link
                href="/profile"
                className="text-xs text-muted-foreground hover:text-amber-500 transition-colors flex items-center gap-1"
              >
                All records <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {prs.map((pr) => {
                const d = safeToDate({ date: pr.date });
                return (
                  <div
                    key={pr.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] hover:border-amber-500/20 transition-all"
                  >
                    <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shrink-0">
                      <Trophy className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pr.name}</p>
                      <p className="text-[10px] text-muted-foreground">{format(d, 'MMM d, yyyy')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-amber-500 tabular-nums">
                        {pr.value}
                        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
                          {pr.unit}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Milestones */}
      {hasMilestones && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Milestones
              </CardTitle>
              <Link
                href="/profile"
                className="text-xs text-muted-foreground hover:text-amber-500 transition-colors flex items-center gap-1"
              >
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.map((ms) => {
                const d = safeToDate({ date: ms.date });
                const IconComp = MILESTONE_ICONS[ms.icon] || Star;
                const colorClass = CATEGORY_COLORS[ms.category] || 'text-amber-500';
                return (
                  <div
                    key={ms.id}
                    onClick={() => setSelectedMilestone(ms)}
                    className="flex items-center gap-3 p-2.5 rounded-xl border hover:border-primary/20 transition-all cursor-pointer"
                  >
                    <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
                      <IconComp className={`h-4 w-4 ${colorClass}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{ms.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ms.description}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground shrink-0">{format(d, 'MMM d, yyyy')}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Milestone Detail Modal */}
      {selectedMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setSelectedMilestone(null)}>
          <div className="relative w-full max-w-md" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedMilestone(null)}
              className="absolute -top-3 -right-3 z-10 h-8 w-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <MilestoneCard
              ref={milestoneCardRef}
              milestone={{
                category: selectedMilestone.category,
                name: selectedMilestone.name,
                description: selectedMilestone.description,
                value: selectedMilestone.value,
                unit: selectedMilestone.unit,
                icon: selectedMilestone.icon,
              }}
              date={safeToDate({ date: selectedMilestone.date })}
              userName={username}
            />
            <div className="mt-4 flex justify-center">
              <ShareButtons
                title="Milestone"
                fileName={`milestone-${selectedMilestone.name.toLowerCase().replace(/\s+/g, '-')}`}
                cardRef={milestoneCardRef}
                shareText={`${selectedMilestone.name} — ${selectedMilestone.description} 🏆 The Daily Athlete`}
                shareUrl={typeof window !== 'undefined' ? `${window.location.origin}/profile` : ''}
                onClose={() => setSelectedMilestone(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
