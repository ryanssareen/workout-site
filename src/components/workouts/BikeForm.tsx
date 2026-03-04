'use client';

import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BikeData } from '@/types/workout';

interface BikeFormProps {
  data: Partial<BikeData>;
  onChange: (data: Partial<BikeData>) => void;
}

export function BikeForm({ data, onChange }: BikeFormProps) {
  // Initialize defaults for fields that display a default but never fire onChange
  useEffect(() => {
    if (!data.distanceUnit) {
      onChange({
        ...data,
        distanceUnit: data.distanceUnit || 'km',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="distance">Distance *</Label>
          <Input
            id="distance"
            type="number"
            step="0.1"
            placeholder="50"
            value={data.distance || ''}
            onChange={(e) => onChange({ ...data, distance: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label htmlFor="distanceUnit">Unit *</Label>
          <Select
            value={data.distanceUnit || 'km'}
            onValueChange={(value) => onChange({ ...data, distanceUnit: value as 'km' | 'miles' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km">Kilometers</SelectItem>
              <SelectItem value="miles">Miles</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="time">Time (minutes) *</Label>
        <Input
          id="time"
          type="number"
          placeholder="120"
          value={data.time || ''}
          onChange={(e) => onChange({ ...data, time: Number(e.target.value) })}
          required
        />
      </div>
    </div>
  );
}
