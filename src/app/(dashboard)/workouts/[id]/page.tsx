'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/authStore';
import { getWorkout, completeWorkout } from '@/lib/firebase/firestore';
import { Workout } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Edit, ArrowLeft, Calendar, Clock, CheckCircle2, Circle, Activity, BookmarkPlus, BookmarkX } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CommentSection } from '@/components/workouts/comments';
import { ShareWorkoutCard } from '@/components/workouts/ShareWorkoutCard';
import dynamic from 'next/dynamic';

// Dynamic import for map (no SSR)
const RouteMap = dynamic(
  () => import('@/components/workouts/RouteMap').then(mod => mod.RouteMap),
  { ssr: false, loading: () => <div className="h-[300px] bg-muted rounded-lg animate-pulse" /> }
);
import { CompletionDialog, UncompletionDialog } from '@/components/workouts/CompletionDialog';
import { WorkoutPhotos } from '@/components/workouts/WorkoutPhotos';
import { WorkoutRecommendations } from '@/components/ai/WorkoutRecommendations';
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    async function loadWorkout() {
      if (!params.id || typeof params.id !== 'string') return;

      setDataLoading(true);
      const data = await getWorkout(params.id);

      if (!data) {
        toast.error('Workout not found');
        router.push('/workouts');
        return;
      }

      setWorkout(data);
      setDataLoading(false);
    }

    if (user) {
      loadWorkout();
    }
  }, [user, loading, router, params.id]);

  const handleComplete = async (notes?: string) => {
    if (!workout) return;

    setIsUpdating(true);
    try {
      await completeWorkout(workout.id, true, notes);
      setWorkout({
        ...workout,
        completed: true,
        completedBy: 'manual',
        completionNotes: notes,
      });
      setShowCompletionDialog(false);
      toast.success('Workout marked as complete!');
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
      await completeWorkout(workout.id, false);
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
          createdBy: user.uid,
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
        `/api/templates?templateId=${workout.templateId}&userId=${user.uid}`,
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

  const canEdit = user.role === 'coach' && workout.createdBy === user.uid;
  const isPastWorkout = workout.date.toDate() < new Date();
  const isMissed = isPastWorkout && !workout.completed;
  const isAthlete = user.role === 'athlete' || user.role === 'student';
  const hasTemplate = !!(workout as any).templateId;

  return (
    <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Button variant="ghost" asChild>
          <Link href="/workouts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Workouts
          </Link>
        </Button>

        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/workouts/${workout.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            {hasTemplate ? (
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
            )}
          </div>
        )}
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
                <p className="text-sm text-muted-foreground">Scheduled Date</p>
                <p className="font-medium">
                  {format(workout.date.toDate(), 'MMMM d, yyyy')}
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

          {/* Route Map if available */}
          {workout.routeData?.polyline && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Route Map
              </h3>
              <RouteMap routeData={workout.routeData} height={450} workoutId={workout.id} />
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

          {/* Completion button - only show for athletes */}
          {isAthlete ? (
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

      {/* AI Recommendations */}
      <WorkoutRecommendations workout={workout} />

      {/* Comments section */}
      <CommentSection
        workoutId={workout.id}
        workoutName={workout.name}
        currentUserId={user.uid}
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

      {/* Save as Template dialog */}
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
