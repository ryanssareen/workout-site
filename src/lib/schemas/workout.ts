import { z } from 'zod';
import { WORKOUT_TAGS } from '@/types/workout';

// Type-specific schemas
const swimDataSchema = z.object({
  distance: z.number().min(0, 'Distance is required'),
  distanceUnit: z.enum(['meters', 'yards']),
  time: z.number().min(0, 'Time is required'),
  strokes: z.number().optional(),
  strokeType: z.enum(['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'mixed']).optional(),
  poolLength: z.number().min(10).max(100).optional(),
});

const bikeDataSchema = z.object({
  distance: z.number().min(0, 'Distance is required'),
  distanceUnit: z.enum(['km', 'miles']),
  time: z.number().min(0, 'Time is required'),
  avgPower: z.number().optional(),
  avgCadence: z.number().optional(),
  elevationGain: z.number().optional(),
});

const runDataSchema = z.object({
  distance: z.number().min(0).optional(),
  distanceUnit: z.enum(['km', 'miles']),
  time: z.number().min(0, 'Time is required'),
  pace: z.string().optional(),
  elevationGain: z.number().optional(),
  terrain: z.enum(['road', 'trail', 'track', 'treadmill']).optional(),
});

const strengthExerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required'),
  sets: z.number().min(1, 'At least 1 set required'),
  reps: z.number().min(1, 'At least 1 rep required'),
  weight: z.number().optional(),
  weightUnit: z.enum(['kg', 'lbs']),
  restSeconds: z.number().optional(),
  notes: z.string().optional(),
});

const strengthDataSchema = z.object({
  exercises: z.array(strengthExerciseSchema).optional(),
  totalTime: z.number().optional(),
  rpe: z.number().min(1).max(10).optional(),
});

const otherDataSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  duration: z.number().optional(),
  notes: z.string().optional(),
});

// Tags schema using the predefined tags
const workoutTagSchema = z.enum(WORKOUT_TAGS);

// Recurring frequency options
export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
export type RecurringFrequency = typeof RECURRING_FREQUENCIES[number];

// Main workout schema with type-specific data
export const workoutSchema = z.object({
  name: z.string().min(1, 'Workout name is required').max(100),
  type: z.enum(['swim', 'run', 'walk', 'bike', 'strength', 'other'], {
    message: 'Please select a workout type',
  }),
  date: z.date({
    message: 'Please select a date',
  }),
  assignedTo: z.string().optional(),
  
  // Tags (optional, 0-5 tags)
  tags: z.array(workoutTagSchema).max(5, 'Maximum 5 tags allowed').optional(),
  
  // Recurring workout settings
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.enum(RECURRING_FREQUENCIES).optional(),
  recurringEndDate: z.date().optional(),
  
  // Legacy fields (for backward compatibility)
  description: z.string().optional(),
  duration: z.number().min(1).max(1440).optional(),
  
  // Type-specific data
  swim: swimDataSchema.optional(),
  bike: bikeDataSchema.optional(),
  run: runDataSchema.optional(),
  strength: strengthDataSchema.optional(),
  other: otherDataSchema.optional(),
}).refine(
  (data) => {
    // Ensure type-specific data is provided based on type
    if (data.type === 'swim') return !!data.swim;
    if (data.type === 'bike') return !!data.bike;
    if (data.type === 'run') return !!data.run;
    if (data.type === 'strength') return !!data.strength;
    if (data.type === 'other') return !!data.other;
    return true;
  },
  {
    message: 'Please fill in the workout details',
    path: ['type'],
  }
).refine(
  (data) => {
    // If recurring is enabled, frequency and end date must be set
    if (data.isRecurring) {
      return !!data.recurringFrequency && !!data.recurringEndDate;
    }
    return true;
  },
  {
    message: 'Please select frequency and end date for recurring workout',
    path: ['isRecurring'],
  }
);

export type WorkoutSchema = z.infer<typeof workoutSchema>;
