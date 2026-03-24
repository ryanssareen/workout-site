'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users } from 'lucide-react';

interface AthleteSelectorProps {
  selectedAthlete: string;
  onSelect: (username: string) => void;
  athletes: Array<{ uid: string; displayName: string }>;
}

export function AthleteSelector({ selectedAthlete, onSelect, athletes }: AthleteSelectorProps) {
  if (athletes.length === 0) return null;

  return (
    <Select value={selectedAthlete} onValueChange={onSelect}>
      <SelectTrigger className="w-[200px]">
        <Users className="h-4 w-4 mr-2" />
        <SelectValue placeholder="All Athletes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Athletes</SelectItem>
        {athletes.map((athlete) => (
          <SelectItem key={athlete.uid} value={athlete.uid}>
            {athlete.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
