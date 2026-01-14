'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workoutSchema, WorkoutSchema, RECURRING_FREQUENCIES } from '@/lib/schemas/workout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addMonths } from 'date-fns';
import { CalendarIcon, X, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SwimForm } from './SwimForm';
import { BikeForm } from './BikeForm';
import { RunForm } from './RunForm';
import { StrengthForm } from './StrengthForm';
import { OtherForm } from './OtherForm';
import { WORKOUT_TAGS, WorkoutTag } from '@/types/workout';

// Tag colors for visual distinction
const TAG_COLORS: Record<WorkoutTag, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  recovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  speed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  endurance: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  intervals: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  tempo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  long: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  strength: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  technique: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  race: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
};

// Frequency labels for display
const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Every Day',
  weekly: 'Every Week',
  biweekly: 'Every 2 Weeks',
  monthly: 'Every Month',
};

interface WorkoutFormProps {
  onSubmit: (data: WorkoutSchema) => Promise<void>;
  defaultValues?: Partial<WorkoutSchema>;
  students: Array<{ uid: string; displayName: string; email: string }>;
  loading?: boolean;
}

export function WorkoutForm({ onSubmit, defaultValues, students, loading }: WorkoutFormProps) {
  const { register, handleSubmit, formState: { errors }, setValue, watch, control, reset } = useForm<WorkoutSchema>({
    resolver: zodResolver(workoutSchema),
    defaultValues: defaultValues || {
      type: 'strength',
      date: new Date(),
      tags: [],
      isRecurring: false,
    },
  });

  // Reset form when defaultValues change (e.g., when AI data loads)
  useEffect(() => {
    if (defaultValues) {
      reset(defaultValues);
    }
  }, [defaultValues, reset]);

  const selectedDate = watch('date');
  const selectedType = watch('type');
  const selectedStudent = watch('assignedTo');
  const selectedTags = watch('tags') || [];
  const isRecurring = watch('isRecurring');
  const recurringFrequency = watch('recurringFrequency');
  const recurringEndDate = watch('recurringEndDate');

  // Watch type-specific data
  const swimData = useWatch({ control, name: 'swim' });
  const bikeData = useWatch({ control, name: 'bike' });
  const runData = useWatch({ control, name: 'run' });
  const strengthData = useWatch({ control, name: 'strength' });
  const otherData = useWatch({ control, name: 'other' });

  const handleTagToggle = (tag: WorkoutTag) => {
    const currentTags = selectedTags || [];
    if (currentTags.includes(tag)) {
      setValue('tags', currentTags.filter((t) => t !== tag));
    } else {
      setValue('tags', [...currentTags, tag]);
    }
  };

  const handleRecurringToggle = (checked: boolean) => {
    setValue('isRecurring', checked);
    if (checked) {
      // Set default end date to 1 month from start date
      setValue('recurringEndDate', addMonths(selectedDate || new Date(), 1));
      setValue('recurringFrequency', 'weekly');
    } else {
      setValue('recurringEndDate', undefined);
      setValue('recurringFrequency', undefined);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Workout Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Workout Name *</Label>
        <Input id="name" placeholder="Morning Run" {...register('name')} />
        {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
      </div>

      {/* Workout Type */}
      <div className="space-y-2">
        <Label htmlFor="type">Workout Type *</Label>
        <Select 
          value={selectedType} 
          onValueChange={(value: any) => {
            setValue('type', value);
            // Clear type-specific data when changing types
            setValue('swim', undefined);
            setValue('bike', undefined);
            setValue('run', undefined);
            setValue('strength', undefined);
            setValue('other', undefined);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="swim">🏊 Swim</SelectItem>
            <SelectItem value="bike">🚴 Bike</SelectItem>
            <SelectItem value="run">🏃 Run</SelectItem>
            <SelectItem value="strength">💪 Strength</SelectItem>
            <SelectItem value="other">📋 Other</SelectItem>
          </SelectContent>
        </Select>
        {errors.type && <p className="text-sm text-red-500">{errors.type.message}</p>}
      </div>

      {/* Workout Tags */}
      <div className="space-y-3">
        <Label>Tags (optional)</Label>
        <div className="flex flex-wrap gap-2">
          {WORKOUT_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleTagToggle(tag)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 capitalize',
                  isSelected
                    ? `${TAG_COLORS[tag]} ring-2 ring-offset-2 ring-primary`
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                )}
              >
                {tag}
                {isSelected && <X className="inline-block ml-1 h-3 w-3" />}
              </button>
            );
          })}
        </div>
        {selectedTags.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedTags.length} tag{selectedTags.length > 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      {/* Type-Specific Forms */}
      <div className="border rounded-lg p-4 bg-muted/30">
        <Label className="text-base font-semibold mb-4 block">Workout Details *</Label>
        
        {selectedType === 'swim' && (
          <SwimForm
            data={swimData || {}}
            onChange={(data) => setValue('swim', data as any)}
          />
        )}

        {selectedType === 'bike' && (
          <BikeForm
            data={bikeData || {}}
            onChange={(data) => setValue('bike', data as any)}
          />
        )}

        {selectedType === 'run' && (
          <RunForm
            data={runData || {}}
            onChange={(data) => setValue('run', data as any)}
          />
        )}

        {selectedType === 'strength' && (
          <StrengthForm
            data={strengthData || {}}
            onChange={(data) => setValue('strength', data as any)}
          />
        )}

        {selectedType === 'other' && (
          <OtherForm
            data={otherData || {}}
            onChange={(data) => setValue('other', data as any)}
          />
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <Label>Start Date *</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !selectedDate && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => setValue('date', date as Date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && <p className="text-sm text-red-500">{errors.date.message}</p>}
      </div>

      {/* Assign to Student */}
      <div className="space-y-2">
        <Label htmlFor="assignedTo">Assign to Student *</Label>
        <Select value={selectedStudent} onValueChange={(value) => setValue('assignedTo', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((student) => (
              <SelectItem key={student.uid} value={student.uid}>
                <div className="flex flex-col">
                  <span className="font-medium">{student.displayName || 'No Name'}</span>
                  <span className="text-xs text-muted-foreground">{student.email}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.assignedTo && <p className="text-sm text-red-500">{errors.assignedTo.message}</p>}
      </div>

      {/* Recurring Workout Toggle */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Repeat className={cn(
              "h-5 w-5 transition-colors",
              isRecurring ? "text-primary" : "text-muted-foreground"
            )} />
            <div>
              <Label htmlFor="recurring-toggle" className="text-base font-medium cursor-pointer">
                Make this recurring
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically create this workout on a schedule
              </p>
            </div>
          </div>
          <Switch
            id="recurring-toggle"
            checked={isRecurring || false}
            onCheckedChange={handleRecurringToggle}
          />
        </div>

        {/* Recurring Options - shown when toggle is on */}
        {isRecurring && (
          <div className="pt-4 border-t space-y-4">
            {/* Frequency */}
            <div className="space-y-2">
              <Label>Repeat Frequency</Label>
              <Select 
                value={recurringFrequency} 
                onValueChange={(value: any) => setValue('recurringFrequency', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq} value={freq}>
                      {FREQUENCY_LABELS[freq]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !recurringEndDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recurringEndDate ? format(recurringEndDate, 'PPP') : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={recurringEndDate}
                    onSelect={(date) => setValue('recurringEndDate', date as Date)}
                    disabled={(date) => date <= (selectedDate || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Workouts will be created from {selectedDate ? format(selectedDate, 'MMM d') : 'start date'} until this date
              </p>
            </div>

            {errors.isRecurring && (
              <p className="text-sm text-red-500">{errors.isRecurring.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving...' : isRecurring ? 'Create Recurring Workout' : 'Create Workout'}
      </Button>
    </form>
  );
}

// Export TAG_COLORS for use in other components
export { TAG_COLORS };
