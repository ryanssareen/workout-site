import { z } from 'zod';

export const SPORT_OPTIONS = [
  'Running',
  'Cycling',
  'Swimming',
  'Strength Training',
] as const;

export const TRAINING_FOR_OPTIONS = [
  'Hyrox',
  'Ironman',
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

export const profileSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters').max(50),
  bio: z.string().max(300, 'Bio must be under 300 characters').optional(),
  timezone: z.string().optional(),
  sportPreferences: z.array(z.string()).optional(),
  trainingFor: z.array(z.string()).optional(),
  notificationPreferences: z.object({
    emailSummary: z.boolean(),
    workoutReminders: z.boolean(),
    coachMessages: z.boolean(),
  }).optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
