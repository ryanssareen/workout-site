'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StrengthData } from '@/types/workout';

interface StrengthFormProps {
  data: Partial<StrengthData>;
  onChange: (data: Partial<StrengthData>) => void;
}

export function StrengthForm({ data, onChange }: StrengthFormProps) {
  return (
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
  );
}
