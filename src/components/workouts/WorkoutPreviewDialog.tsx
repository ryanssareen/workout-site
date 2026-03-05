'use client';

import { WorkoutSchema } from '@/lib/schemas/workout';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ArrowLeft, Calendar, Clock, MapPin, Dumbbell, Waves, Bike, Footprints } from 'lucide-react';
import { format } from 'date-fns';

interface WorkoutPreviewProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: WorkoutSchema | null;
  athleteName?: string;
  loading?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; emoji: string }> = {
  run: { icon: <Footprints className="h-5 w-5" />, label: 'Running', emoji: '🏃' },
  swim: { icon: <Waves className="h-5 w-5" />, label: 'Swimming', emoji: '🏊' },
  bike: { icon: <Bike className="h-5 w-5" />, label: 'Cycling', emoji: '🚴' },
  strength: { icon: <Dumbbell className="h-5 w-5" />, label: 'Strength', emoji: '💪' },
};

function StatRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export function WorkoutPreviewDialog({ open, onClose, onConfirm, data, athleteName, loading }: WorkoutPreviewProps) {
  if (!data) return null;

  const typeInfo = TYPE_CONFIG[data.type] || TYPE_CONFIG.run;
  const dateStr = data.date ? format(new Date(data.date), 'EEEE, MMM d, yyyy') : '—';

  // Extract type-specific stats
  const typeData = data[data.type as keyof WorkoutSchema] as any;
  const stats: Array<{ label: string; value: string }> = [];

  if (data.type === 'run' && typeData) {
    if (typeData.distance) stats.push({ label: 'Distance', value: `${typeData.distance} ${typeData.distanceUnit || 'km'}` });
    if (typeData.time) stats.push({ label: 'Duration', value: `${typeData.time} min` });
    if (typeData.pace) stats.push({ label: 'Target Pace', value: `${typeData.pace} /km` });
    if (typeData.terrain) stats.push({ label: 'Terrain', value: typeData.terrain });
    if (typeData.elevationGain) stats.push({ label: 'Elevation', value: `${typeData.elevationGain}m` });
  } else if (data.type === 'swim' && typeData) {
    if (typeData.distance) stats.push({ label: 'Distance', value: `${typeData.distance} m` });
    if (typeData.time) stats.push({ label: 'Duration', value: `${typeData.time} min` });
    if (typeData.stroke) stats.push({ label: 'Stroke', value: typeData.stroke });
    if (typeData.laps) stats.push({ label: 'Laps', value: String(typeData.laps) });
  } else if (data.type === 'bike' && typeData) {
    if (typeData.distance) stats.push({ label: 'Distance', value: `${typeData.distance} ${typeData.distanceUnit || 'km'}` });
    if (typeData.time) stats.push({ label: 'Duration', value: `${typeData.time} min` });
    if (typeData.terrain) stats.push({ label: 'Terrain', value: typeData.terrain });
    if (typeData.elevationGain) stats.push({ label: 'Elevation', value: `${typeData.elevationGain}m` });
  } else if (data.type === 'strength' && typeData) {
    if (Array.isArray(typeData.exercises) && typeData.exercises.length > 0) {
      stats.push({ label: 'Exercises', value: `${typeData.exercises.length} exercises` });
      const totalSets = typeData.exercises.reduce((s: number, e: any) => s + (e.sets || 0), 0);
      if (totalSets > 0) stats.push({ label: 'Total Sets', value: String(totalSets) });
    }
    if (typeData.totalTime) stats.push({ label: 'Duration', value: `${typeData.totalTime} min` });
    if (typeData.rpe) stats.push({ label: 'RPE', value: `${typeData.rpe}/10` });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{typeInfo.emoji}</span>
            Preview Workout
          </DialogTitle>
          <DialogDescription>Review before {athleteName ? 'sending' : 'creating'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title + type */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg leading-tight">{data.name || 'Untitled Workout'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{typeInfo.label}</Badge>
                  {athleteName && (
                    <span className="text-xs text-muted-foreground">→ {athleteName}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {dateStr}
            </div>

            {/* Description */}
            {data.description && (
              <p className="text-sm text-muted-foreground border-t pt-3 whitespace-pre-line">{data.description}</p>
            )}
          </div>

          {/* Stats */}
          {stats.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Details</p>
              {stats.map(s => <StatRow key={s.label} label={s.label} value={s.value} />)}
            </div>
          )}

          {/* Strength Exercises List */}
          {data.type === 'strength' && typeData?.exercises && Array.isArray(typeData.exercises) && typeData.exercises.length > 0 && (
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Exercises</p>
              {typeData.exercises.map((ex: any, i: number) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm font-medium">{ex.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {ex.sets}×{ex.reps}{ex.weight ? ` @ ${ex.weight}${ex.weightUnit || 'kg'}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Tags */}
          {data.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map(tag => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}

          {/* Recurring */}
          {data.isRecurring && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              🔁 Repeats {data.recurringFrequency}{data.recurringEndDate ? ` until ${format(new Date(data.recurringEndDate), 'MMM d')}` : ''}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button onClick={onConfirm} disabled={loading}
            className="bg-gradient-to-r from-primary to-orange-500 text-white">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Creating...</> : <><Send className="h-4 w-4 mr-1" />{athleteName ? 'Send Workout' : 'Create Workout'}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
