import { z } from 'zod';

export const workoutSchema = z.object({
  name: z.string().min(1, 'Workout name is required').max(100),
  type: z.enum(['swim', 'run', 'bike', 'strength'], {
    required_error: 'Please select a workout type',
  }),
  description: z.string().min(1, 'Description is required').max(1000),
  date: z.date({
    required_error: 'Please select a date',
  }),
  duration: z.number().min(1).max(1440).optional(),
  assignedTo: z.string().min(1, 'Please select a student'),
});

export type WorkoutSchema = z.infer<typeof workoutSchema>;
