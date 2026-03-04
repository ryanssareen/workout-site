'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Activity,
  Dumbbell,
  UserPlus,
  LogIn,
  Loader2,
  Camera,
  MapPin,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '@/lib/stores/authStore';
import { useState } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';

interface PreviewWorkout {
  id: string;
  name: string;
  type: string;
  description: string;
  date: string;
  duration: number | null;
  completed: boolean;
  source: string;
  tags: string[];
  photos: string[];
  coachName: string | null;
  run: { distance?: number; distanceUnit?: string; time?: number; pace?: string; elevationGain?: number; terrain?: string } | null;
  bike: { distance?: number; distanceUnit?: string; time?: number; avgPower?: number; elevationGain?: number } | null;
  swim: { distance?: number; distanceUnit?: string; time?: number; strokes?: number; strokeType?: string } | null;
  strength: { exercises?: { name: string; sets: number; reps: number; weight?: number; weightUnit?: string; restPeriod?: number }[] } | null;
  other: { description?: string; duration?: number } | null;
  actualStats: {
    distance: number | null;
    duration: number | null;
    calories: number | null;
    avgHeartRate: number | null;
  } | null;
  routeData: {
    polyline: string | null;
    startLatLng: [number, number] | null;
    aiComment: string | null;
  } | null;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  run: { icon: '🏃', color: 'text-green-600', bg: 'bg-green-500/10' },
  bike: { icon: '🚴', color: 'text-orange-600', bg: 'bg-orange-500/10' },
  swim: { icon: '🏊', color: 'text-blue-600', bg: 'bg-blue-500/10' },
  strength: { icon: '💪', color: 'text-purple-600', bg: 'bg-purple-500/10' },
  other: { icon: '⚡', color: 'text-gray-600', bg: 'bg-gray-500/10' },
};

export function PreviewClient({ workout }: { workout: PreviewWorkout }) {
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const [copying, setCopying] = useState(false);

  const config = TYPE_CONFIG[workout.type] || TYPE_CONFIG.other;
  const typeSpecific = workout.run || workout.bike || workout.swim;
  const distance = typeSpecific && 'distance' in typeSpecific ? typeSpecific.distance : null;
  const distanceUnit = typeSpecific && 'distanceUnit' in typeSpecific ? typeSpecific.distanceUnit : null;

  const handleCopyWorkout = async () => {
    if (!user) return;
    setCopying(true);
    try {
      const res = await fetch('/api/workouts/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workoutId: workout.id, userId: user.uid }),
      });
      if (!res.ok) throw new Error('Failed to copy workout');
      toast.success('Workout added to your list!');
    } catch {
      toast.error('Failed to add workout');
    }
    setCopying(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-lg shadow-primary/30">
            <Dumbbell className="h-5 w-5 text-primary-foreground" />
          </div>
          <Link href="/" className="font-bold text-lg hover:opacity-80 transition-opacity">
            The Daily Athlete
          </Link>
        </div>

        {/* Main Workout Card */}
        <Card className="overflow-hidden">
          {/* Hero photo if available */}
          {workout.photos.length > 0 && (
            <div className="relative">
              <img
                src={workout.photos[0]}
                alt={workout.name}
                className="w-full h-48 sm:h-64 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{config.icon}</span>
                  <h1 className="text-xl sm:text-2xl font-bold text-white drop-shadow-lg">{workout.name}</h1>
                </div>
              </div>
            </div>
          )}

          <CardHeader className={workout.photos.length > 0 ? 'pt-4' : ''}>
            {workout.photos.length === 0 && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl">{config.icon}</span>
                <CardTitle className="text-2xl sm:text-3xl">{workout.name}</CardTitle>
              </div>
            )}
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
                <Badge key={tag} variant="secondary" className="capitalize">{tag}</Badge>
              ))}
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Key info grid */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Date</p>
                  <p className="font-semibold">{format(new Date(workout.date), 'MMM d, yyyy')}</p>
                </div>
              </div>
              {workout.duration && (
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                    <p className="font-semibold">{workout.duration} min</p>
                  </div>
                </div>
              )}
              {distance && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Distance</p>
                    <p className="font-semibold">{distance} {distanceUnit}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Coach info */}
            {workout.coachName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Created by <span className="font-medium text-foreground">{workout.coachName}</span></span>
              </div>
            )}

            {/* Sport-specific details */}
            {workout.run && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Run Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {workout.run.pace && <Stat label="Pace" value={workout.run.pace} />}
                  {workout.run.elevationGain && <Stat label="Elevation" value={`${workout.run.elevationGain}m`} />}
                  {workout.run.terrain && <Stat label="Terrain" value={workout.run.terrain} />}
                </div>
              </div>
            )}

            {workout.bike && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Ride Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {workout.bike.avgPower && <Stat label="Avg Power" value={`${workout.bike.avgPower}W`} />}
                  {workout.bike.elevationGain && <Stat label="Elevation" value={`${workout.bike.elevationGain}m`} />}
                </div>
              </div>
            )}

            {workout.swim && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Swim Details</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {workout.swim.strokes && <Stat label="Strokes" value={String(workout.swim.strokes)} />}
                  {workout.swim.strokeType && <Stat label="Stroke Type" value={workout.swim.strokeType} />}
                </div>
              </div>
            )}

            {/* Strength exercises */}
            {workout.strength?.exercises && workout.strength.exercises.length > 0 && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Exercises</h3>
                <div className="space-y-2">
                  {workout.strength.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-muted-foreground text-sm">
                        {ex.sets}x{ex.reps}
                        {ex.weight ? ` @ ${ex.weight}${ex.weightUnit || 'kg'}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strava stats */}
            {workout.actualStats && (
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-4 w-4 text-orange-500" />
                  Recorded Stats
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {workout.actualStats.distance && <Stat label="Distance" value={`${(workout.actualStats.distance / 1000).toFixed(2)} km`} />}
                  {workout.actualStats.duration && <Stat label="Time" value={`${Math.round(workout.actualStats.duration / 60)} min`} />}
                  {workout.actualStats.calories && <Stat label="Calories" value={String(workout.actualStats.calories)} />}
                  {workout.actualStats.avgHeartRate && <Stat label="Avg HR" value={`${workout.actualStats.avgHeartRate} bpm`} />}
                </div>
              </div>
            )}

            {/* AI route comment */}
            {workout.routeData?.aiComment && (
              <div className="bg-orange-50 dark:bg-orange-950/20 rounded-lg p-4 text-sm">
                <p className="italic text-orange-700 dark:text-orange-400">{workout.routeData.aiComment}</p>
              </div>
            )}

            {/* Additional photos gallery */}
            {workout.photos.length > 1 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Camera className="h-4 w-4 text-orange-500" />
                  Photos ({workout.photos.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {workout.photos.slice(1).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Workout photo ${i + 2}`}
                      className="w-full aspect-square rounded-lg object-cover"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {workout.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{workout.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CTA Card */}
        <Card className="mt-4">
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

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by The Daily Athlete — Train Harder. Track Smarter.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold capitalize">{value}</p>
    </div>
  );
}
