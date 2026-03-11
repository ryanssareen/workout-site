'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workoutSchema, WorkoutSchema, RECURRING_FREQUENCIES } from '@/lib/schemas/workout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, addMonths } from 'date-fns';
import { CalendarIcon, X, Repeat, AlertCircle } from 'lucide-react';
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
  note: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
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
  athletes: Array<{ uid: string; displayName: string; email: string }>;
  loading?: boolean;
  hideAthleteSelector?: boolean;
  isEditing?: boolean;
}

export function WorkoutForm({ onSubmit, defaultValues, athletes, loading, hideAthleteSelector, isEditing }: WorkoutFormProps) {
  // Type-agnostic defaults (always applied)
  const BASE_DEFAULTS: Partial<WorkoutSchema> = {
    date: new Date(),
    tags: [],
    isRecurring: false,
  };

  // Only used when no type-specific data is provided
  const FALLBACK_TYPE_DEFAULTS: Partial<WorkoutSchema> = {
    type: 'run',
    run: {
      distanceUnit: 'km',
      time: 30,
    },
  };

  const buildDefaults = (overrides?: Partial<WorkoutSchema>) => {
    const base = { ...BASE_DEFAULTS, ...overrides };
    // Only inject fallback type/run if no type was provided
    if (!base.type) {
      return { ...FALLBACK_TYPE_DEFAULTS, ...base };
    }
    return base;
  };

  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, control, reset } = useForm<WorkoutSchema>({
    resolver: zodResolver(workoutSchema),
    defaultValues: buildDefaults(defaultValues),
  });

  // Reset form when defaultValues change (e.g., when AI data loads)
  useEffect(() => {
    if (defaultValues) {
      reset(buildDefaults(defaultValues));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValues, reset]);

  const selectedDate = watch('date');
  const selectedType = watch('type');
  const selectedStudent = watch('assignedTo');
  const rawTags = watch('tags');
  const selectedTags = Array.isArray(rawTags) ? rawTags : [];
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

  // Handle form submission with error logging
  const onFormSubmit = handleSubmit(
    (data) => {
      console.log('✅ Form valid, submitting:', data);
      return onSubmit(data);
    },
    (formErrors) => {
      console.error('❌ Form validation errors:', formErrors);
    }
  );

  // Get all error messages for display (including nested)
  const flattenErrors = (obj: any, prefix = ''): Array<[string, string]> => {
    const result: Array<[string, string]> = [];
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
        result.push([path, value.message]);
      } else if (value && typeof value === 'object') {
        result.push(...flattenErrors(value, path));
      }
    }
    return result;
  };
  const allErrors = flattenErrors(errors);

  return (
    <form onSubmit={onFormSubmit} className="space-y-6">
      {/* Show all validation errors at top */}
      {allErrors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium mb-2">
            <AlertCircle className="h-4 w-4" />
            Please fix the following errors:
          </div>
          <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-400 space-y-1">
            {allErrors.map(([path, message]) => (
              <li key={path}>{message}</li>
            ))}
          </ul>
        </div>
      )}

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
          value={selectedType ?? ''} 
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

      {/* Free-Text Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          placeholder="Add any notes, goals, cues, or context for this workout..."
          {...register('description')}
        />
        {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
      </div>

      {/* Type-Specific Forms */}
      {selectedType !== 'strength' ? (
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

          {selectedType === 'other' && (
            <OtherForm
              data={otherData || {}}
              onChange={(data) => setValue('other', data as any)}
            />
          )}
        </div>
      ) : (
        <StrengthForm
          data={strengthData || {}}
          onChange={(data) => setValue('strength', data as any)}
        />
      )}

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

      {/* Assign to Athlete - only show for coaches */}
      {!hideAthleteSelector && (
        <div className="space-y-2">
          <Label htmlFor="assignedTo">Assign to Athlete *</Label>
          <Select value={selectedStudent || ''} onValueChange={(value) => setValue('assignedTo', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select athlete" />
            </SelectTrigger>
            <SelectContent>
              {(Array.isArray(athletes) ? athletes : []).map((athlete) => (
                <SelectItem key={athlete.uid} value={athlete.uid}>
                  <div className="flex flex-col">
                    <span className="font-medium">{athlete.displayName || 'No Name'}</span>
                    <span className="text-xs text-muted-foreground">{athlete.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.assignedTo && <p className="text-sm text-red-500">{errors.assignedTo.message}</p>}
        </div>
      )}

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
      <Button type="submit" className="w-full" disabled={loading || isSubmitting}>
        {loading || isSubmitting ? 'Saving...' : isEditing ? 'Update Workout' : isRecurring ? 'Create Recurring Workout' : 'Create Workout'}
      </Button>
    </form>
  );
}

// Export TAG_COLORS for use in other components
export { TAG_COLORS };
