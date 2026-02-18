import { z } from 'zod';

export const SPORT_OPTIONS = [
  'Running',
  'Cycling',
  'Swimming',
  'Strength Training',
  'Triathlon',
  'CrossFit',
  'Yoga',
  'Hiking',
  'Rowing',
  'Other',
] as const;

export const FITNESS_GOAL_OPTIONS = [
  'Build Endurance',
  'Lose Weight',
  'Build Muscle',
  'Improve Speed',
  'Race Preparation',
  'General Fitness',
  'Injury Recovery',
  'Flexibility',
] as const;

export const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50),
  bio: z.string().max(300, 'Bio must be under 300 characters').optional(),
  timezone: z.string().optional(),
  sportPreferences: z.array(z.string()).optional(),
  fitnessGoals: z.array(z.string()).optional(),
  notificationPreferences: z.object({
    emailSummary: z.boolean(),
    workoutReminders: z.boolean(),
    coachMessages: z.boolean(),
  }).optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
