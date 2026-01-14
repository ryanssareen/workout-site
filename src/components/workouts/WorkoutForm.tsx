'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { workoutSchema, WorkoutSchema } from '@/lib/schemas/workout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { format } from 'date-fns';
import { CalendarIcon, X } from 'lucide-react';
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

export interface RecurringConfig {
  intervalDays: number;
  endConditionType: 'date' | 'count' | 'none';
  endDate?: Date;
  repeatCount?: number;
}

interface WorkoutFormProps {
  onSubmit: (data: WorkoutSchema, recurringConfig?: RecurringConfig) => Promise<void>;
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
    },
  });

  // Recurring workout state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringConfig, setRecurringConfig] = useState<RecurringConfig>({
    intervalDays: 7,
    endConditionType: 'none',
    endDate: undefined,
    repeatCount: undefined,
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

  const handleFormSubmit = async (data: WorkoutSchema) => {
    if (isRecurring) {
      await onSubmit(data, recurringConfig);
    } else {
      await onSubmit(data);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
        <Label>Date *</Label>
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

      {/* Recurring Workout Section */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="recurring-toggle" className="text-base font-semibold cursor-pointer">
              Make this recurring?
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Automatically send this workout at regular intervals
            </p>
          </div>
          <Switch
            id="recurring-toggle"
            checked={isRecurring}
            onCheckedChange={setIsRecurring}
          />
        </div>

        {isRecurring && (
          <div className="pl-4 border-l-2 border-primary space-y-4 animate-in fade-in duration-200">
            {/* Interval selector */}
            <div className="space-y-2">
              <Label>Send every</Label>
              <Select
                value={recurringConfig.intervalDays.toString()}
                onValueChange={(v) => setRecurringConfig({
                  ...recurringConfig,
                  intervalDays: parseInt(v)
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days (weekly)</SelectItem>
                  <SelectItem value="14">14 days (bi-weekly)</SelectItem>
                  <SelectItem value="21">21 days (every 3 weeks)</SelectItem>
                  <SelectItem value="28">28 days (monthly)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* End condition selector */}
            <div className="space-y-3">
              <Label>End condition</Label>
              <RadioGroup
                value={recurringConfig.endConditionType}
                onValueChange={(v: any) => setRecurringConfig({
                  ...recurringConfig,
                  endConditionType: v,
                  endDate: undefined,
                  repeatCount: undefined,
                })}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="none" id="end-none" />
                  <Label htmlFor="end-none" className="font-normal cursor-pointer">
                    Never (continue indefinitely)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="date" id="end-date" />
                  <Label htmlFor="end-date" className="font-normal cursor-pointer">
                    Until a specific date
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="count" id="end-count" />
                  <Label htmlFor="end-count" className="font-normal cursor-pointer">
                    After N repetitions
                  </Label>
                </div>
              </RadioGroup>

              {recurringConfig.endConditionType === 'date' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !recurringConfig.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {recurringConfig.endDate
                        ? format(recurringConfig.endDate, 'PPP')
                        : 'Pick end date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={recurringConfig.endDate}
                      onSelect={(date) => setRecurringConfig({
                        ...recurringConfig,
                        endDate: date as Date
                      })}
                      initialFocus
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              )}

              {recurringConfig.endConditionType === 'count' && (
                <Input
                  type="number"
                  min="1"
                  placeholder="Number of times to repeat"
                  value={recurringConfig.repeatCount || ''}
                  onChange={(e) => setRecurringConfig({
                    ...recurringConfig,
                    repeatCount: parseInt(e.target.value) || undefined
                  })}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving...' : isRecurring ? 'Create Recurring Schedule' : 'Create Workout'}
      </Button>
    </form>
  );
}

// Export TAG_COLORS for use in other components
export { TAG_COLORS };
