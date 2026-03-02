'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SwimData } from '@/types/workout';

const POOL_PRESETS = [20, 25, 30, 50];

interface SwimFormProps {
  data: Partial<SwimData>;
  onChange: (data: Partial<SwimData>) => void;
}

export function SwimForm({ data, onChange }: SwimFormProps) {
  const [isCustomPool, setIsCustomPool] = useState(
    data.poolLength ? !POOL_PRESETS.includes(data.poolLength) : false
  );

  // Initialize defaults for fields that display a default but never fire onChange
  useEffect(() => {
    if (!data.distanceUnit || !data.strokeType) {
      onChange({
        ...data,
        distanceUnit: data.distanceUnit || 'meters',
        strokeType: data.strokeType || 'freestyle',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePoolChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomPool(true);
      onChange({ ...data, poolLength: undefined });
    } else {
      setIsCustomPool(false);
      onChange({ ...data, poolLength: Number(value) });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="distance">Distance *</Label>
          <Input
            id="distance"
            type="number"
            placeholder="2000"
            value={data.distance || ''}
            onChange={(e) => onChange({ ...data, distance: Number(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label htmlFor="distanceUnit">Unit *</Label>
          <Select
            value={data.distanceUnit || 'meters'}
            onValueChange={(value) => onChange({ ...data, distanceUnit: value as 'meters' | 'yards' })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meters">Meters</SelectItem>
              <SelectItem value="yards">Yards</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="time">Time (minutes) *</Label>
        <Input
          id="time"
          type="number"
          placeholder="45"
          value={data.time || ''}
          onChange={(e) => onChange({ ...data, time: Number(e.target.value) })}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="strokes">Number of Strokes</Label>
          <Input
            id="strokes"
            type="number"
            placeholder="1500"
            value={data.strokes || ''}
            onChange={(e) => onChange({ ...data, strokes: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="poolLength">Pool Length</Label>
          <Select
            value={isCustomPool ? 'custom' : (data.poolLength?.toString() || '25')}
            onValueChange={handlePoolChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pool length" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20m</SelectItem>
              <SelectItem value="25">25m</SelectItem>
              <SelectItem value="30">30m</SelectItem>
              <SelectItem value="50">50m</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          {isCustomPool && (
            <Input
              type="number"
              placeholder="Pool length in meters"
              min={10}
              max={100}
              className="mt-2"
              value={data.poolLength || ''}
              onChange={(e) => onChange({ ...data, poolLength: Number(e.target.value) })}
            />
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="strokeType">Stroke Type</Label>
        <Select
          value={data.strokeType || 'freestyle'}
          onValueChange={(value) => onChange({ ...data, strokeType: value as SwimData['strokeType'] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select stroke" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="freestyle">Freestyle</SelectItem>
            <SelectItem value="backstroke">Backstroke</SelectItem>
            <SelectItem value="breaststroke">Breaststroke</SelectItem>
            <SelectItem value="butterfly">Butterfly</SelectItem>
            <SelectItem value="mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
