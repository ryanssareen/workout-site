'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RunData } from '@/types/workout';

interface RunFormProps {
  data: Partial<RunData>;
  onChange: (data: Partial<RunData>) => void;
}

export function RunForm({ data, onChange }: RunFormProps) {
  const calculatePace = (distance: number, time: number, unit: 'km' | 'miles') => {
    if (!distance || !time) return '';
    const paceMinutes = time / distance;
    const mins = Math.floor(paceMinutes);
    const secs = Math.round((paceMinutes - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/${unit}`;
  };

  const handleDistanceOrTimeChange = (newData: Partial<RunData>) => {
    const updated = { ...data, ...newData };
    if (updated.distance && updated.time && updated.distanceUnit) {
      updated.pace = calculatePace(updated.distance, updated.time, updated.distanceUnit);
    }
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="distance">Distance *</Label>
          <Input
            id="distance"
            type="number"
            step="0.1"
            placeholder="10"
            value={data.distance || ''}
            onChange={(e) => handleDistanceOrTimeChange({ distance: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label htmlFor="distanceUnit">Unit *</Label>
          <Select
            value={data.distanceUnit || 'km'}
            onValueChange={(value) => handleDistanceOrTimeChange({ distanceUnit: value as 'km' | 'miles' })}
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
          placeholder="55"
          value={data.time || ''}
          onChange={(e) => handleDistanceOrTimeChange({ time: Number(e.target.value) })}
          required
        />
      </div>
      <div>
        <Label htmlFor="pace">Pace</Label>
        <Input
          id="pace"
          type="text"
          placeholder="5:30/km"
          value={data.pace || ''}
          readOnly
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground mt-1">Auto-calculated from distance & time</p>
      </div>
      <div>
        <Label htmlFor="terrain">Terrain</Label>
        <Select
          value={data.terrain || 'road'}
          onValueChange={(value) => onChange({ ...data, terrain: value as RunData['terrain'] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select terrain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="road">Road</SelectItem>
            <SelectItem value="trail">Trail</SelectItem>
            <SelectItem value="track">Track</SelectItem>
            <SelectItem value="treadmill">Treadmill</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="elevationGain">Elevation Gain (meters)</Label>
        <Input
          id="elevationGain"
          type="number"
          placeholder="150"
          value={data.elevationGain || ''}
          onChange={(e) => onChange({ ...data, elevationGain: Number(e.target.value) })}
        />
        <p className="text-xs text-muted-foreground mt-1">Optional - total climbing</p>
      </div>
    </div>
  );
}
