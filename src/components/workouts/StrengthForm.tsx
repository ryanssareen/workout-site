'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StrengthData, StrengthExercise } from '@/types/workout';
import { Plus, Trash2 } from 'lucide-react';

interface StrengthFormProps {
  data: Partial<StrengthData>;
  onChange: (data: Partial<StrengthData>) => void;
}

export function StrengthForm({ data, onChange }: StrengthFormProps) {
  const exercises = Array.isArray(data.exercises) ? data.exercises : [];

  const addExercise = () => {
    onChange({
      ...data,
      exercises: [...exercises, { name: '', sets: 3, reps: 10, weightUnit: 'kg' }],
    });
  };

  const removeExercise = (index: number) => {
    const updated = exercises.filter((_, i) => i !== index);
    onChange({ ...data, exercises: updated });
  };

  const updateExercise = (index: number, updates: Partial<StrengthExercise>) => {
    const updated = exercises.map((ex, i) => (i === index ? { ...ex, ...updates } : ex));
    onChange({ ...data, exercises: updated });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Exercises *</Label>
          <Button type="button" variant="outline" size="sm" onClick={addExercise}>
            <Plus className="h-4 w-4 mr-1" />
            Add Exercise
          </Button>
        </div>
        {exercises.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
            Click "Add Exercise" to start building your workout
          </p>
        )}
        {exercises.map((exercise, index) => (
          <div key={index} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <Label htmlFor={`exercise-name-${index}`}>Exercise Name *</Label>
                <Input
                  id={`exercise-name-${index}`}
                  type="text"
                  placeholder="Bench Press"
                  value={exercise.name}
                  onChange={(e) => updateExercise(index, { name: e.target.value })}
                  required
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeExercise(index)}
                className="mt-6"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`sets-${index}`}>Sets *</Label>
                <Input
                  id={`sets-${index}`}
                  type="number"
                  min="1"
                  value={exercise.sets}
                  onChange={(e) => updateExercise(index, { sets: Number(e.target.value) })}
                  required
                />
              </div>
              <div>
                <Label htmlFor={`reps-${index}`}>Reps *</Label>
                <Input
                  id={`reps-${index}`}
                  type="number"
                  min="1"
                  value={exercise.reps}
                  onChange={(e) => updateExercise(index, { reps: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`weight-${index}`}>Weight</Label>
                <Input
                  id={`weight-${index}`}
                  type="number"
                  step="0.5"
                  placeholder="100"
                  value={exercise.weight || ''}
                  onChange={(e) => updateExercise(index, { weight: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor={`weightUnit-${index}`}>Unit</Label>
                <Select
                  value={exercise.weightUnit}
                  onValueChange={(value) => updateExercise(index, { weightUnit: value as 'kg' | 'lbs' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lbs">lbs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`rest-${index}`}>Rest (seconds)</Label>
                <Input
                  id={`rest-${index}`}
                  type="number"
                  placeholder="90"
                  value={exercise.restSeconds || ''}
                  onChange={(e) => updateExercise(index, { restSeconds: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor={`notes-${index}`}>Notes</Label>
                <Input
                  id={`notes-${index}`}
                  type="text"
                  placeholder="Tempo: 3-0-1"
                  value={exercise.notes || ''}
                  onChange={(e) => updateExercise(index, { notes: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="totalTime">Total Time (minutes)</Label>
          <Input
            id="totalTime"
            type="number"
            placeholder="60"
            value={data.totalTime || ''}
            onChange={(e) => onChange({ ...data, totalTime: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="rpe">RPE (1-10)</Label>
          <Input
            id="rpe"
            type="number"
            min="1"
            max="10"
            placeholder="7"
            value={data.rpe || ''}
            onChange={(e) => onChange({ ...data, rpe: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground mt-1">Rate of Perceived Exertion</p>
        </div>
      </div>
    </div>
  );
}
