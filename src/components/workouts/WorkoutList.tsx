'use client';

import { Workout } from '@/types';
import { WorkoutCard } from './WorkoutCard';

interface WorkoutListProps {
  workouts: Workout[];
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string, completed: boolean) => void;
  isCoach?: boolean;
}

export function WorkoutList({ workouts, onEdit, onDelete, onToggleComplete, isCoach }: WorkoutListProps) {
  if (workouts.length === 0) {
    return <div className="text-center py-12 text-muted-foreground">No workouts found</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {workouts.map((workout) => (
        <WorkoutCard 
          key={workout.id} 
          workout={workout} 
          onEdit={onEdit} 
          onDelete={onDelete} 
          onToggleComplete={onToggleComplete}
        />
      ))}
    </div>
  );
}
