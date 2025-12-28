'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OtherData } from '@/types/workout';

interface OtherFormProps {
  data: Partial<OtherData>;
  onChange: (data: Partial<OtherData>) => void;
}

export function OtherForm({ data, onChange }: OtherFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          placeholder="e.g., Yoga session, stretching routine, mobility work..."
          value={data.description || ''}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          required
          rows={4}
        />
        <p className="text-xs text-muted-foreground mt-1">Describe the workout in detail</p>
      </div>
      <div>
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Input
          id="duration"
          type="number"
          placeholder="30"
          value={data.duration || ''}
          onChange={(e) => onChange({ ...data, duration: Number(e.target.value) })}
        />
      </div>
      <div>
        <Label htmlFor="notes">Additional Notes</Label>
        <Textarea
          id="notes"
          placeholder="Any additional details, goals, or instructions..."
          value={data.notes || ''}
          onChange={(e) => onChange({ ...data, notes: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
