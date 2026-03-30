'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkout, completeWorkout, deleteWorkout } from '@/lib/firebase/firestore';
import { useWorkoutStore } from '@/lib/stores/workoutStore';
import { Workout, AchievementResult } from '@/types';
import { isCoachAssigned } from '@/types/workout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, ArrowLeft, Calendar, Clock, CheckCircle2, Circle, Activity, BookmarkPlus, BookmarkX, BarChart3, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { formatInTimezone, formatTime, safeToDate } from '@/lib/dateUtils';
import { CommentSection } from '@/components/workouts/comments';
import { ShareWorkoutCard } from '@/components/workouts/ShareWorkoutCard';
import { track } from '@/lib/posthog';
import dynamic from 'next/dynamic';

// Dynamic import for map (no SSR)
const RouteMap = dynamic(
  () => import('@/components/workouts/RouteMap').then(mod => mod.RouteMap),
  { ssr: false, loading: () => <div className="h-[300px] bg-muted rounded-lg animate-pulse" /> }
);
import { CompletionDialog, UncompletionDialog } from '@/components/workouts/CompletionDialog';
import { WorkoutPhotos } from '@/components/workouts/WorkoutPhotos';
import { CelebrationModal } from '@/components/achievements/CelebrationModal';
import { checkAchievements } from '@/lib/achievements';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function WorkoutDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);
  const [showUncompletionDialog, setShowUncompletionDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [frequency, setFrequency] = useState('');
  const [achievements, setAchievements] = useState<AchievementResult | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSplits, setShowSplits] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    async function loadWorkout() {
      if (!params.id || typeof params.id !== 'string') return;

      setDataLoading(true);
      try {
        const ownerUsername = searchParams.get('owner') || user?.username;
        if (!ownerUsername) return;
        const data = await getWorkout(ownerUsername, params.id);

        if (!data) {
          toast.error('Workout not found');
          router.push('/workouts');
          return;
        }

        setWorkout(data);
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          toast.error('Daily quota reached — try again later');
        } else {
          toast.error('Failed to load workout');
        }
        console.error('Workout load error:', err);
      } finally {
        setDataLoading(false);
      }
    }

    if (user) {
      loadWorkout();
    }
  }, [user, loading, router, params.id, searchParams]);

  const handleComplete = async (notes?: string, rating?: 1 | 2 | 3 | 4 | 5) => {
    if (!workout || !user) return;

    setIsUpdating(true);
    try {
      await completeWorkout(workout.ownerUsername, workout.id, true, notes, rating);
      const updatedWorkout: Workout = {
        ...workout,
        completed: true,
        completedBy: 'manual',
        completionNotes: notes,
        completionRating: rating,
      };
      setWorkout(updatedWorkout);
      setShowCompletionDialog(false);

      track('workout_completed', { type: workout.type, source: workout.source || 'manual' });

      // Check for achievements (non-blocking — show toast immediately, celebration after)
      toast.success('Workout marked as complete!');
      try {
        const { invalidate } = useWorkoutStore.getState();
        const allWorkouts = await invalidate(user.username, user.role);
        const result = await checkAchievements(user.username, user.uid, updatedWorkout, allWorkouts);
        if (result.newPRs.length > 0 || result.newMilestones.length > 0) {
          setAchievements(result);
          setShowCelebration(true);
        }
      } catch (achError) {
        console.error('Achievement check failed:', achError);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUncomplete = async () => {
    if (!workout) return;

    setIsUpdating(true);
    try {
      await completeWorkout(workout.ownerUsername, workout.id, false);
      setWorkout({
        ...workout,
        completed: false,
        completedBy: undefined,
        completionNotes: undefined,
      });
      setShowUncompletionDialog(false);
      toast.success('Workout marked as incomplete');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workout');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!workout || !user) return;

    setIsSavingTemplate(true);
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          type: workout.type,
          description: workout.description || '',
          duration: workout.duration,
          timeframe: timeframe || null,
          frequency: frequency || null,
          createdBy: user.username,
          workoutId: workout.id, // Track which workout created this template
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      const data = await response.json();
      
      // Update local workout state with templateId
      setWorkout({
        ...workout,
        templateId: data.id,
      });

      toast.success('Saved as template!');
      setShowTemplateDialog(false);
      setTemplateName('');
      setTimeframe('');
      setFrequency('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleUnsaveTemplate = async () => {
    if (!workout || !user || !workout.templateId) return;

    setIsSavingTemplate(true);
    try {
      const response = await fetch(
        `/api/templates?templateId=${workout.templateId}&userId=${user.username}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unsave template');
      }

      // Update local workout state to remove templateId
      setWorkout({
        ...workout,
        templateId: undefined,
      });

      toast.success('Template removed!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to unsave template');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const openTemplateDialog = () => {
    if (workout) {
      setTemplateName(workout.name);
      setTimeframe('');
      setFrequency('');
      setShowTemplateDialog(true);
    }
  };

  if (loading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !workout) return null;

  const canEdit = user.role === 'coach' && workout.createdBy === user.username;
  const canDelete = workout.ownerUsername === user.username || canEdit;
  const isPastWorkout = safeToDate(workout) < new Date();
  const isMissed = isPastWorkout && !workout.completed;
  const isAthlete = user.role === 'athlete' || user.role === 'student';
  const hasTemplate = !!(workout as any).templateId;

  const handleDelete = async () => {
    if (!workout || !user) return;
    setIsDeleting(true);
    try {
      await deleteWorkout(workout.ownerUsername, workout.id);
      useWorkoutStore.getState().clearCache();
      toast.success('Workout deleted');
      router.push('/workouts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workout');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link href={searchParams.get('from') === 'calendar' ? '/calendar' : '/workouts'}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {searchParams.get('from') === 'calendar' ? 'Back to Calendar' : 'Back to Workouts'}
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild>
              <Link href={`/workouts/${workout.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          )}
          {canEdit && (hasTemplate ? (
            <Button
              onClick={handleUnsaveTemplate}
              variant="outline"
              disabled={isSavingTemplate}
            >
              {isSavingTemplate ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookmarkX className="mr-2 h-4 w-4" />
              )}
              Unsave Template
            </Button>
          ) : (
            <Button
              onClick={openTemplateDialog}
              variant="outline"
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
          ))}
          {canDelete && (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card
        className={cn(
          workout.completed && 'border-green-200 dark:border-green-900',
          isMissed && 'border-red-200 dark:border-red-900'
        )}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-xl sm:text-2xl md:text-3xl">{workout.name}</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="capitalize">
                  {workout.type}
                </Badge>
                {isCoachAssigned(workout) && (
                  <Badge variant="outline" className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800">
                    Assigned by coach
                  </Badge>
                )}
                {workout.completed ? (
                  <Badge className="bg-green-500 hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                ) : isMissed ? (
                  <Badge variant="destructive">Missed</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
                {workout.completedBy === 'strava' && (
                  <Badge variant="outline" className="border-orange-500 text-orange-600">
                    <Activity className="h-3 w-3 mr-1" />
                    via Strava
                  </Badge>
                )}
                {hasTemplate && (
                  <Badge variant="outline" className="border-blue-500 text-blue-600">
                    <BookmarkPlus className="h-3 w-3 mr-1" />
                    Saved as Template
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {formatInTimezone(safeToDate(workout), 'MMMM d, yyyy', user?.timezone)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(safeToDate(workout), user?.timezone)}
                </p>
              </div>
            </div>

            {workout.duration && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{workout.duration} minutes</p>
                </div>
              </div>
            )}
          </div>

          {/* Strava stats if available */}
          {workout.actualStats && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Strava Stats
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {workout.actualStats.distance && (
                  <div>
                    <p className="text-sm text-muted-foreground">Distance</p>
                    <p className="font-medium">
                      {(workout.actualStats.distance / 1000).toFixed(2)} km
                    </p>
                  </div>
                )}
                {workout.actualStats.duration && (
                  <div>
                    <p className="text-sm text-muted-foreground">Moving Time</p>
                    <p className="font-medium">
                      {Math.round(workout.actualStats.duration / 60)} min
                    </p>
                  </div>
                )}
                {workout.actualStats.calories && (
                  <div>
                    <p className="text-sm text-muted-foreground">Calories</p>
                    <p className="font-medium">{workout.actualStats.calories}</p>
                  </div>
                )}
                {workout.actualStats.avgHeartRate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Avg HR</p>
                    <p className="font-medium">{workout.actualStats.avgHeartRate} bpm</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* HR Zone Breakdown */}
          {workout.hrZones && workout.hrZones.zones && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-red-500" />
                Heart Rate Zones
                <span className="text-xs font-normal text-muted-foreground ml-auto">Max HR: {workout.hrZones.maxHR} bpm</span>
              </h3>

              {/* Zone bars */}
              <div className="space-y-2">
                {workout.hrZones.zones.map(z => {
                  const colors = ['bg-gray-400', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-red-500'];
                  const mins = Math.floor(z.seconds / 60);
                  const secs = z.seconds % 60;
                  return (
                    <div key={z.zone} className="flex items-center gap-3">
                      <div className="w-24 sm:w-28 text-xs text-muted-foreground shrink-0">
                        <span className="font-semibold text-foreground">Z{z.zone}</span> {z.name}
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${colors[z.zone - 1]} rounded-full transition-all duration-700`}
                          style={{ width: `${Math.max(z.pct, z.pct > 0 ? 2 : 0)}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-xs tabular-nums shrink-0">
                        <span className="font-semibold">{z.pct}%</span>
                        <span className="text-muted-foreground ml-1">{mins}:{String(secs).padStart(2, '0')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* HR Timeline */}
              {workout.hrStream && workout.hrStream.heartrate.length > 0 && (() => {
                const hr = workout.hrStream!.heartrate;
                const maxHR = workout.hrZones!.maxHR;
                let hrMax = 0, hrMin = 300;
                for (let i = 0; i < hr.length; i++) { if (hr[i] > hrMax) hrMax = hr[i]; if (hr[i] < hrMin) hrMin = hr[i]; }
                const chartMax = Math.min(hrMax + 10, maxHR + 20);
                const chartMin = Math.max(hrMin - 10, 40);
                const range = chartMax - chartMin || 1;
                const points = hr.map((v, i) => `${i},${100 - ((v - chartMin) / range) * 100}`).join(' ');
                const bandColors = ['rgba(156,163,175,0.1)', 'rgba(59,130,246,0.1)', 'rgba(34,197,94,0.1)', 'rgba(249,115,22,0.15)', 'rgba(239,68,68,0.15)'];
                const zonePcts = [0, 0.6, 0.7, 0.8, 0.9, 1.0];
                return (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground mb-2">Heart Rate Over Time</p>
                    <div className="relative h-32 w-full">
                      {zonePcts.slice(0, -1).map((p, i) => {
                        const low = p * maxHR, high = zonePcts[i + 1] * maxHR;
                        const bottom = Math.max(0, ((low - chartMin) / range) * 100);
                        const top = Math.min(100, ((high - chartMin) / range) * 100);
                        if (top <= 0 || bottom >= 100) return null;
                        return <div key={i} className="absolute left-0 right-0" style={{ bottom: `${bottom}%`, height: `${top - bottom}%`, backgroundColor: bandColors[i] }} />;
                      })}
                      <svg viewBox={`0 0 ${hr.length} 100`} className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <polyline fill="none" stroke="#ef4444" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={points} />
                      </svg>
                      <div className="absolute left-0 top-0 text-[9px] text-muted-foreground/60">{chartMax}</div>
                      <div className="absolute left-0 bottom-0 text-[9px] text-muted-foreground/60">{chartMin}</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Splits / Laps */}
          {workout.source === 'strava' && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" />
                  {workout.type === 'run' ? 'Splits' : 'Laps'}
                </h3>
                {workout.stravaDetailsFetched && (workout.splits?.length || workout.laps?.length) ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSplits(!showSplits)}
                    className="text-sm"
                  >
                    {showSplits ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {showSplits ? 'Hide' : 'Show'}
                  </Button>
                ) : !workout.stravaDetailsFetched ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingDetails}
                    onClick={async () => {
                      setLoadingDetails(true);
                      try {
                        const ownerUsername = searchParams.get('owner') || user!.username;
                        const res = await fetch(`/api/strava/activity-details?userId=${ownerUsername}&workoutId=${workout.id}`);
                        if (!res.ok) {
                          const err = await res.json().catch(() => ({}));
                          if (res.status === 429 || err.rateLimited) {
                            toast.info('Strava is temporarily busy. Try again in a minute.', { icon: '⏳', duration: 5000 });
                            return;
                          }
                          throw new Error(err.error || 'Failed to load details');
                        }
                        const data = await res.json();
                        setWorkout(prev => prev ? {
                          ...prev,
                          stravaDetailsFetched: true,
                          laps: data.laps,
                          splits: data.splits,
                          ...(data.photos?.length > 0 ? { photos: data.photos } : {}),
                          ...(data.hrZones ? { hrZones: data.hrZones } : {}),
                          ...(data.hrStream ? { hrStream: data.hrStream } : {}),
                        } : null);
                        setShowSplits(true);
                        toast.success('Loaded detailed activity data');
                      } catch (err: any) {
                        toast.error(err.message || 'Failed to load details');
                      } finally {
                        setLoadingDetails(false);
                      }
                    }}
                  >
                    {loadingDetails ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
                    Load Details
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No split data</span>
                )}
              </div>

              {showSplits && workout.splits && workout.splits.length > 0 && workout.type === 'run' && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3">Split</th>
                        <th className="text-right py-2 px-3">Distance</th>
                        <th className="text-right py-2 px-3">Pace</th>
                        <th className="text-right py-2 px-3">Elev</th>
                        <th className="text-right py-2 pl-3">Zone</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workout.splits.map((s) => {
                        const paceSecPerKm = s.avgSpeed > 0 ? 1000 / s.avgSpeed : 0;
                        const paceMin = Math.floor(paceSecPerKm / 60);
                        const paceSec = Math.round(paceSecPerKm % 60);
                        return (
                          <tr key={s.split} className="border-b border-border/30">
                            <td className="py-2 pr-3 font-medium">{s.split}</td>
                            <td className="text-right py-2 px-3">{(s.distance / 1000).toFixed(2)} km</td>
                            <td className="text-right py-2 px-3 font-mono">
                              {paceSecPerKm > 0 ? `${paceMin}:${String(paceSec).padStart(2, '0')}/km` : '-'}
                            </td>
                            <td className="text-right py-2 px-3">
                              {s.elevationDifference != null ? `${s.elevationDifference > 0 ? '+' : ''}${Math.round(s.elevationDifference)}m` : '-'}
                            </td>
                            <td className="text-right py-2 pl-3">
                              {s.paceZone != null ? (
                                <span className={cn(
                                  'inline-block w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center',
                                  s.paceZone <= 2 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                                  s.paceZone <= 3 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400' :
                                  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                )}>{s.paceZone}</span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {showSplits && workout.laps && workout.laps.length > 0 && workout.type !== 'run' && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-2 pr-3">Lap</th>
                        <th className="text-right py-2 px-3">Distance</th>
                        <th className="text-right py-2 px-3">Time</th>
                        <th className="text-right py-2 px-3">Avg Speed</th>
                        {workout.laps.some(l => l.avgWatts) && <th className="text-right py-2 px-3">Power</th>}
                        {workout.laps.some(l => l.totalElevationGain) && <th className="text-right py-2 pl-3">Elev</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {workout.laps.map((lap) => {
                        const timeMin = Math.floor(lap.movingTime / 60);
                        const timeSec = Math.round(lap.movingTime % 60);
                        return (
                          <tr key={lap.index} className="border-b border-border/30">
                            <td className="py-2 pr-3 font-medium">{lap.name}</td>
                            <td className="text-right py-2 px-3">{(lap.distance / 1000).toFixed(2)} km</td>
                            <td className="text-right py-2 px-3 font-mono">{timeMin}:{String(timeSec).padStart(2, '0')}</td>
                            <td className="text-right py-2 px-3">{(lap.avgSpeed * 3.6).toFixed(1)} km/h</td>
                            {workout.laps!.some(l => l.avgWatts) && (
                              <td className="text-right py-2 px-3">{lap.avgWatts ? `${Math.round(lap.avgWatts)}W` : '-'}</td>
                            )}
                            {workout.laps!.some(l => l.totalElevationGain) && (
                              <td className="text-right py-2 pl-3">{lap.totalElevationGain ? `${Math.round(lap.totalElevationGain)}m` : '-'}</td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* For runs, also show laps if they exist and are different from splits */}
              {showSplits && workout.laps && workout.laps.length > 1 && workout.type === 'run' && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Laps</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 pr-3">Lap</th>
                          <th className="text-right py-2 px-3">Distance</th>
                          <th className="text-right py-2 px-3">Pace</th>
                          <th className="text-right py-2 pl-3">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workout.laps.map((lap) => {
                          const paceSecPerKm = lap.avgSpeed > 0 ? 1000 / lap.avgSpeed : 0;
                          const paceMin = Math.floor(paceSecPerKm / 60);
                          const paceSec = Math.round(paceSecPerKm % 60);
                          const timeMin = Math.floor(lap.movingTime / 60);
                          const timeSec = Math.round(lap.movingTime % 60);
                          return (
                            <tr key={lap.index} className="border-b border-border/30">
                              <td className="py-2 pr-3 font-medium">{lap.name}</td>
                              <td className="text-right py-2 px-3">{(lap.distance / 1000).toFixed(2)} km</td>
                              <td className="text-right py-2 px-3 font-mono">
                                {paceSecPerKm > 0 ? `${paceMin}:${String(paceSec).padStart(2, '0')}/km` : '-'}
                              </td>
                              <td className="text-right py-2 pl-3 font-mono">{timeMin}:{String(timeSec).padStart(2, '0')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Route Map if available */}
          {workout.routeData?.polyline && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Route Map
              </h3>
              <RouteMap routeData={workout.routeData} height={450} workoutId={workout.id} ownerUsername={workout.ownerUsername} />
            </div>
          )}

          {/* Strava Photos */}
          {workout.photos && workout.photos.length > 0 && (
            <WorkoutPhotos photos={workout.photos} />
          )}

          {/* Share */}
          <ShareWorkoutCard workout={workout} />

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {workout.description}
            </p>
          </div>

          {/* Completion notes */}
          {workout.completionNotes && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-green-700 dark:text-green-400">
                Completion Notes
              </h3>
              <p className="text-muted-foreground italic">
                &quot;{workout.completionNotes}&quot;
              </p>
            </div>
          )}

          {/* Completion button - only show for planned workouts (not Strava) */}
          {workout.source === 'strava' ? null : isAthlete ? (
            <Button
              onClick={() =>
                workout.completed
                  ? setShowUncompletionDialog(true)
                  : setShowCompletionDialog(true)
              }
              className={cn(
                'w-full',
                !workout.completed && 'bg-green-600 hover:bg-green-700'
              )}
              variant={workout.completed ? 'outline' : 'default'}
            >
              {workout.completed ? (
                <>
                  <Circle className="h-4 w-4 mr-2" />
                  Mark as Incomplete
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mark as Complete
                </>
              )}
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full">
                    <Button
                      className="w-full"
                      variant="outline"
                      disabled
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {workout.completed ? 'Completed' : 'Complete Workout'}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Only athletes can complete workouts</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </CardContent>
      </Card>


      {/* Comments section */}
      <CommentSection
        workoutId={workout.id}
        workoutName={workout.name}
        ownerUsername={workout.ownerUsername}
        currentUserId={user.username}
        currentUserName={user.displayName}
        currentUserRole={user.role}
        coachId={workout.createdBy}
      />

      {/* Completion dialogs */}
      <CompletionDialog
        open={showCompletionDialog}
        onOpenChange={setShowCompletionDialog}
        workoutName={workout.name}
        onConfirm={handleComplete}
        isLoading={isUpdating}
      />
      <UncompletionDialog
        open={showUncompletionDialog}
        onOpenChange={setShowUncompletionDialog}
        workoutName={workout.name}
        onConfirm={handleUncomplete}
        isLoading={isUpdating}
      />

      {/* Celebration Modal */}
      {achievements && (
        <CelebrationModal
          achievements={achievements}
          open={showCelebration}
          onClose={() => setShowCelebration(false)}
          userName={user.displayName}
        />
      )}

      {/* Save as Template dialog */}
      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workout</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{workout.name}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Create a reusable template from this workout. This workout can only be saved as a template once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Enter template name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeframe">Timeframe *</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger id="timeframe" className="w-full">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-week">1 Week</SelectItem>
                  <SelectItem value="2-weeks">2 Weeks</SelectItem>
                  <SelectItem value="3-weeks">3 Weeks</SelectItem>
                  <SelectItem value="4-weeks">4 Weeks</SelectItem>
                  <SelectItem value="6-weeks">6 Weeks</SelectItem>
                  <SelectItem value="8-weeks">8 Weeks</SelectItem>
                  <SelectItem value="10-weeks">10 Weeks</SelectItem>
                  <SelectItem value="12-weeks">12 Weeks</SelectItem>
                  <SelectItem value="16-weeks">16 Weeks</SelectItem>
                  <SelectItem value="20-weeks">20 Weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="frequency" className="w-full">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="2x-week">2x per week</SelectItem>
                  <SelectItem value="3x-week">3x per week</SelectItem>
                  <SelectItem value="4x-week">4x per week</SelectItem>
                  <SelectItem value="5x-week">5x per week</SelectItem>
                  <SelectItem value="6x-week">6x per week</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTemplateDialog(false)}
              disabled={isSavingTemplate}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={isSavingTemplate || !templateName.trim() || !timeframe || !frequency}
            >
              {isSavingTemplate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
