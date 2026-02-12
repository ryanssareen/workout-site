'use client';

import { useState } from 'react';
import { Workout } from '@/types';
import { DuplicateGroup, detectDuplicates } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Copy, Loader2, Trash2 } from 'lucide-react';
import { deleteWorkout } from '@/lib/firebase/firestore';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DuplicateRemoverProps {
  workouts: Workout[];
  onWorkoutsChanged: () => void;
}

function toDate(w: Workout): Date {
  return w.date?.toDate?.() ?? new Date(w.date as any);
}

export function DuplicateRemover({ workouts, onWorkoutsChanged }: DuplicateRemoverProps) {
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const groups = detectDuplicates(workouts);
  const visibleGroups = groups.filter((_, i) => !dismissed.has(i));

  const handleDelete = async (workoutId: string) => {
    setDeleting(prev => new Set(prev).add(workoutId));
    try {
      await deleteWorkout(workoutId);
      toast.success('Duplicate workout removed');
      onWorkoutsChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workout');
    } finally {
      setDeleting(prev => {
        const next = new Set(prev);
        next.delete(workoutId);
        return next;
      });
    }
  };

  const handleDeleteAll = async (group: DuplicateGroup) => {
    // Keep the first (oldest), delete the rest
    const toDelete = group.workouts.slice(1);
    for (const w of toDelete) {
      setDeleting(prev => new Set(prev).add(w.id));
    }
    try {
      await Promise.all(toDelete.map(w => deleteWorkout(w.id)));
      toast.success(`Removed ${toDelete.length} duplicate(s)`);
      onWorkoutsChanged();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete duplicates');
    } finally {
      setDeleting(new Set());
    }
  };

  if (groups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Check className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
        <p className="text-lg font-medium text-foreground">No duplicates detected</p>
        <p className="text-sm mt-1">All your workouts look unique. Nice and clean!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {visibleGroups.length} Potential Duplicate{visibleGroups.length !== 1 ? ' Groups' : ' Group'} Found
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Review each group — we keep the first and let you remove the rest.
          </p>
        </div>
      </div>

      {visibleGroups.map((group, groupIdx) => {
        const realIdx = groups.indexOf(group);
        return (
          <Card key={realIdx} className="border-amber-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Copy className="h-4 w-4 text-amber-500" />
                  {group.reason}
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDismissed(prev => new Set(prev).add(realIdx))}
                    className="text-xs"
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteAll(group)}
                    disabled={deleting.size > 0}
                  >
                    {deleting.size > 0 ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Remove Duplicates
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {group.workouts.map((w, i) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {i === 0 && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-600 shrink-0">
                          KEEP
                        </Badge>
                      )}
                      {i > 0 && (
                        <Badge variant="outline" className="text-red-500 border-red-500 shrink-0">
                          DUP
                        </Badge>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{w.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{format(toDate(w), 'MMM d, yyyy HH:mm')}</span>
                          <span>•</span>
                          <span className="capitalize">{w.type}</span>
                          {w.source === 'strava' && (
                            <>
                              <span>•</span>
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">Strava</Badge>
                            </>
                          )}
                          {w.actualStats?.distance && (
                            <>
                              <span>•</span>
                              <span>{(w.actualStats.distance / 1000).toFixed(1)} km</span>
                            </>
                          )}
                          {(w.actualStats?.duration || w.duration) && (
                            <>
                              <span>•</span>
                              <span>
                                {w.actualStats?.duration
                                  ? `${Math.round(w.actualStats.duration / 60)}m`
                                  : `${w.duration}m`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {i > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(w.id)}
                        disabled={deleting.has(w.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 shrink-0"
                      >
                        {deleting.has(w.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
