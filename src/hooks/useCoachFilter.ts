'use client';

import { useState, useCallback, useEffect } from 'react';
import { getCoachStudents } from '@/lib/firebase/firestore';

const STORAGE_KEY = 'coach_selected_athlete';

/**
 * Custom hook for coach athlete filter with sessionStorage persistence.
 * Validates stored athlete against current student list on mount.
 */
export function useCoachFilter(coachUsername?: string) {
  const [selectedAthlete, setSelectedAthleteState] = useState<string>('all');
  const [athletes, setAthletes] = useState<Array<{ uid: string; displayName: string }>>([]);
  const [athletesLoaded, setAthletesLoaded] = useState(false);

  // Hydrate from sessionStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedAthleteState(stored);
    }
  }, []);

  // Load athletes list for coaches
  useEffect(() => {
    if (!coachUsername) return;
    getCoachStudents(coachUsername).then((students) => {
      setAthletes(students.map((s: any) => ({
        uid: s.uid || s.id,
        displayName: s.displayName || s.uid || s.id,
      })));
      setAthletesLoaded(true);
    });
  }, [coachUsername]);

  // Validate stored athlete against current list
  useEffect(() => {
    if (!athletesLoaded || selectedAthlete === 'all') return;
    const isValid = athletes.some(a => a.uid === selectedAthlete);
    if (!isValid) {
      setSelectedAthleteState('all');
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [athletesLoaded, athletes, selectedAthlete]);

  const selectAthlete = useCallback((username: string) => {
    setSelectedAthleteState(username);
    if (typeof window !== 'undefined') {
      if (username === 'all') {
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, username);
      }
    }
  }, []);

  return { selectedAthlete, selectAthlete, athletes, athletesLoaded };
}
