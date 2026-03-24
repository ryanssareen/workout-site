'use client';

import { useState, useCallback, useEffect } from 'react';
import { getCoachStudents } from '@/lib/firebase/firestore';

const STORAGE_KEY = 'coach_selected_athlete';

/**
 * Custom hook for coach athlete filter with sessionStorage persistence.
 * Auto-selects first athlete if none stored. No "All Athletes" option.
 */
export function useCoachFilter(coachUsername?: string) {
  const [selectedAthlete, setSelectedAthleteState] = useState<string>('');
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
      const list = students.map((s: any) => ({
        uid: s.uid || s.id,
        displayName: s.displayName || s.uid || s.id,
      }));
      setAthletes(list);
      setAthletesLoaded(true);
    });
  }, [coachUsername]);

  // Auto-select first athlete if none selected or stored value is invalid
  useEffect(() => {
    if (!athletesLoaded || athletes.length === 0) return;
    const isValid = selectedAthlete && athletes.some(a => a.uid === selectedAthlete);
    if (!isValid) {
      const first = athletes[0].uid;
      setSelectedAthleteState(first);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, first);
      }
    }
  }, [athletesLoaded, athletes, selectedAthlete]);

  const selectAthlete = useCallback((username: string) => {
    setSelectedAthleteState(username);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, username);
    }
  }, []);

  return { selectedAthlete, selectAthlete, athletes, athletesLoaded };
}
