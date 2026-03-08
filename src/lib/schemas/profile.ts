import { z } from 'zod';

export const SPORT_OPTIONS = [
  'Running',
  'Cycling',
  'Swimming',
  'Strength Training',
  'Triathlon',
] as const;

export const TRAINING_FOR_OPTIONS = [
  'Hyrox',
  'Ironman',
  'Half Ironman',
  'Marathon',
  'Half Marathon',
  'Triathlon',
  'Spartan Race',
  'CrossFit Competition',
  'Ultra Marathon',
  '5K / 10K',
  'Century Ride',
  'Open Water Swim',
  'Powerlifting Meet',
  'General Fitness',
  'Other',
] as const;

export const AGE_RANGE_OPTIONS = [
  'under-18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+',
] as const;

export const EXPERIENCE_LEVEL_OPTIONS = [
  'Beginner', 'Intermediate', 'Advanced', 'Elite',
] as const;

export const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50),
  bio: z.string().max(300, 'Bio must be under 300 characters').optional(),
  timezone: z.string().optional(),
  ageRange: z.string().optional(),
  experienceLevel: z.string().optional(),
  height: z.number().positive().optional().nullable(),
  heightUnit: z.enum(['cm', 'ft']).optional(),
  weight: z.number().positive().optional().nullable(),
  weightUnit: z.enum(['kg', 'lbs']).optional(),
  sportPreferences: z.array(z.string()).optional(),
  trainingFor: z.array(z.string()).optional(),
  notificationPreferences: z.object({
    emailSummary: z.boolean(),
    workoutReminders: z.boolean(),
    coachMessages: z.boolean(),
  }).optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
