'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Activity, Dumbbell, UserPlus, LogIn, Loader2, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/lib/stores/authStore';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

interface WorkoutPreviewProps {
  workout: {
    id: string;
    name: string;
    type: string;
    description: string;
    date: string;
    duration: number | null;
    completed: boolean;
    source: string;
    tags: string[];
    actualStats: {
      distance: number | null;
      duration: number | null;
      calories: number | null;
      avgHeartRate: number | null;
    } | null;
    run: { distance?: number; distanceUnit?: string; time?: number } | null;
    bike: { distance?: number; distanceUnit?: string; time?: number } | null;
    swim: { distance?: number; distanceUnit?: string; time?: number } | null;
    strength: { exercises?: { name: string; sets: number; reps: number; weight?: number; weightUnit?: string }[] } | null;
    other: { description?: string; duration?: number } | null;
    routeData: { polyline: string | null; startLatLng: [number, number] | null } | null;
    photos: string[];
  };
  workoutId: string;
}

const TYPE_ICONS: Record<string, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  other: '🏋️',
};

export function WorkoutPreview({ workout, workoutId }: WorkoutPreviewProps) {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [copying, setCopying] = useState(false);

  const handleCopyWorkout = async () => {
    if (!user) return;
    setCopying(true);
    try {
      const res = await fetch('/api/workouts/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId, userId: user.username }),
      });
      if (!res.ok) throw new Error('Failed to copy workout');
      toast.success('Workout added to your list!');
    } catch {
      toast.error('Failed to add workout');
    }
    setCopying(false);
  };

  const typeSpecific = workout.run || workout.bike || workout.swim;
  const distance = typeSpecific && 'distance' in typeSpecific ? typeSpecific.distance : null;
  const distanceUnit = typeSpecific && 'distanceUnit' in typeSpecific ? typeSpecific.distanceUnit : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-lg shadow-primary/30">
          <Dumbbell className="h-5 w-5 text-primary-foreground" />
        </div>
        <Link href="/" className="font-bold text-lg hover:opacity-80 transition-opacity">
          The Daily Athlete
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{TYPE_ICONS[workout.type] || '🏋️'}</span>
              <CardTitle className="text-2xl sm:text-3xl">{workout.name}</CardTitle>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="capitalize">{workout.type}</Badge>
              {workout.completed && (
                <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>
              )}
              {workout.source === 'strava' && (
                <Badge variant="outline" className="border-orange-500 text-orange-600">
                  <Activity className="h-3 w-3 mr-1" />
                  Strava
                </Badge>
              )}
              {workout.tags?.map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{format(new Date(workout.date), 'MMMM d, yyyy')}</p>
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
            {distance && (
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Distance</p>
                  <p className="font-medium">{distance} {distanceUnit}</p>
                </div>
              </div>
            )}
          </div>

          {workout.actualStats && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {workout.actualStats.distance && (
                  <div>
                    <p className="text-sm text-muted-foreground">Distance</p>
                    <p className="font-medium">{(workout.actualStats.distance / 1000).toFixed(2)} km</p>
                  </div>
                )}
                {workout.actualStats.duration && (
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-medium">{Math.round(workout.actualStats.duration / 60)} min</p>
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

          {workout.strength?.exercises && workout.strength.exercises.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Exercises</h3>
              <div className="space-y-2">
                {workout.strength.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{ex.name}</span>
                    <span className="text-muted-foreground">
                      {ex.sets}x{ex.reps}
                      {ex.weight ? ` @ ${ex.weight}${ex.weightUnit || 'kg'}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workout.photos && workout.photos.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-orange-500" />
                Photos ({workout.photos.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {workout.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Workout photo ${i + 1}`}
                    className="w-full aspect-square rounded-lg object-cover"
                  />
                ))}
              </div>
            </div>
          )}

          {workout.description && (
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{workout.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : user ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Want to try this workout?</p>
              <Button onClick={handleCopyWorkout} disabled={copying} className="w-full sm:w-auto">
                {copying ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adding...</>
                ) : (
                  <><UserPlus className="mr-2 h-4 w-4" />Add to My Workouts</>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Sign up to track workouts like this</p>
              <div className="flex justify-center gap-3">
                <Button asChild>
                  <Link href="/register"><UserPlus className="mr-2 h-4 w-4" />Sign Up</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/login"><LogIn className="mr-2 h-4 w-4" />Log In</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
