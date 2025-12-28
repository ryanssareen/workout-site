'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BikeData } from '@/types/workout';

interface BikeFormProps {
  data: Partial<BikeData>;
  onChange: (data: Partial<BikeData>) => void;
}

export function BikeForm({ data, onChange }: BikeFormProps) {
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="avgPower">Avg Power (watts)</Label>
          <Input
            id="avgPower"
            type="number"
            placeholder="200"
            value={data.avgPower || ''}
            onChange={(e) => onChange({ ...data, avgPower: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground mt-1">Optional - from power meter</p>
        </div>
        <div>
          <Label htmlFor="avgCadence">Avg Cadence (RPM)</Label>
          <Input
            id="avgCadence"
            type="number"
            placeholder="85"
            value={data.avgCadence || ''}
            onChange={(e) => onChange({ ...data, avgCadence: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground mt-1">Optional</p>
        </div>
      </div>
      <div>
        <Label htmlFor="elevationGain">Elevation Gain (meters)</Label>
        <Input
          id="elevationGain"
          type="number"
          placeholder="500"
          value={data.elevationGain || ''}
          onChange={(e) => onChange({ ...data, elevationGain: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground mt-1">Optional - total climbing</p>
      </div>
    </div>
  );
}
