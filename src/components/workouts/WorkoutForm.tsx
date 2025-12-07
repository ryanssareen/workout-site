'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workoutSchema, WorkoutSchema } from '@/lib/schemas/workout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkoutFormProps {
  onSubmit: (data: WorkoutSchema) => Promise<void>;
  defaultValues?: Partial<WorkoutSchema>;
  students: Array<{ uid: string; displayName: string }>;
  loading?: boolean;
}

export function WorkoutForm({ onSubmit, defaultValues, students, loading }: WorkoutFormProps) {
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<WorkoutSchema>({
    resolver: zodResolver(workoutSchema), defaultValues,
  });
  const selectedDate = watch('date');
  const selectedType = watch('type');
  const selectedStudent = watch('assignedTo');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2"><Label htmlFor="name">Workout Name</Label><Input id="name" placeholder="Morning Run" {...register('name')} />{errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}</div>
      <div className="space-y-2"><Label htmlFor="type">Workout Type</Label>
        <Select value={selectedType} onValueChange={(value) => setValue('type', value as any)}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent><SelectItem value="swim">Swim</SelectItem><SelectItem value="run">Run</SelectItem><SelectItem value="bike">Bike</SelectItem><SelectItem value="strength">Strength</SelectItem></SelectContent>
        </Select>
        {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" placeholder="5 sets of 100m freestyle with 30s rest..." rows={4} {...register('description')} />{errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}</div>
      <div className="space-y-2"><Label>Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={selectedDate} onSelect={(date) => setValue('date', date as Date)} initialFocus /></PopoverContent>
        </Popover>
        {errors.date && <p className="text-sm text-red-500">{errors.date.message}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="duration">Duration (minutes, optional)</Label><Input id="duration" type="number" placeholder="60" {...register('duration', { valueAsNumber: true })} />{errors.duration && <p className="text-sm text-red-500">{errors.duration.message}</p>}</div>
      <div className="space-y-2"><Label htmlFor="assignedTo">Assign to Student</Label>
        <Select value={selectedStudent} onValueChange={(value) => setValue('assignedTo', value)}>
          <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
          <SelectContent>{students.map((student) => (<SelectItem key={student.uid} value={student.uid}>{student.displayName}</SelectItem>))}</SelectContent>
        </Select>
        {errors.assignedTo && <p className="text-sm text-red-500">{errors.assignedTo.message}</p>}
      </div>
      <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Saving...' : 'Save Workout'}</Button>
    </form>
  );
}
