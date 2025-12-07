'use client';

import { Workout } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Calendar, Clock, Edit, Trash2 } from 'lucide-react';

interface WorkoutCardProps {
  workout: Workout;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onToggleComplete?: (id: string, completed: boolean) => void;
}

export function WorkoutCard({ workout, onEdit, onDelete, onToggleComplete }: WorkoutCardProps) {
  const hasActions = onEdit || onDelete || onToggleComplete;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{workout.name}</CardTitle>
          <Badge 
            variant={workout.type === 'swim' ? 'default' : workout.type === 'run' ? 'secondary' : workout.type === 'bike' ? 'outline' : 'destructive'} 
            className="capitalize"
          >
            {workout.type}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-4 mt-2">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {format(workout.date.toDate(), 'MMM d, yyyy')}
          </span>
          {workout.duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {workout.duration} min
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-3">{workout.description}</p>
        
        {workout.completed && (
          <Badge className="bg-green-500">Completed</Badge>
        )}
        
        {hasActions && (
          <div className="flex items-center gap-2">
            {onToggleComplete && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onToggleComplete(workout.id, !workout.completed)}
                className="flex-1"
              >
                {workout.completed ? 'Mark Incomplete' : 'Mark Complete'}
              </Button>
            )}
            {onEdit && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(workout.id)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => onDelete(workout.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
