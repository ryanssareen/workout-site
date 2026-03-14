import admin from 'firebase-admin';
import type { DeepDiveReportType } from '@/types/reports-hub';
import { sportDeepDiveTemplate } from './sport-deep-dive';
import { trendReportTemplate } from './trend-report';
import { prTimelineTemplate } from './pr-timeline';
import { recoveryReportTemplate } from './recovery-report';

/** Workout document shape from Firestore Admin SDK */
export interface WorkoutDoc {
  type: string;
  completed: boolean;
  duration?: number;
  date: admin.firestore.Timestamp;
  tags?: string[];
  prs?: Array<{ exercise: string; value: string }>;
  actualStats?: {
    distance?: number;
    duration?: number;
    calories?: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    elevationGain?: number;
  };
  name?: string;
}

/** Report template definition */
export interface ReportTemplate {
  type: DeepDiveReportType;
  cacheTTL: number; // hours
  systemPrompt: string;
  buildContext: (workouts: WorkoutDoc[], params: Record<string, string>) => string;
}

/** Template registry */
const TEMPLATES: Partial<Record<DeepDiveReportType, ReportTemplate>> = {
  'sport-deep-dive': sportDeepDiveTemplate,
  'trend-report': trendReportTemplate,
  'pr-timeline': prTimelineTemplate,
  'recovery-report': recoveryReportTemplate,
};

/** Get a template by report type. Returns null for types without templates (e.g. training-analysis). */
export function getTemplate(type: DeepDiveReportType): ReportTemplate | null {
  return TEMPLATES[type] || null;
}

/** All available template types */
export const TEMPLATE_TYPES = Object.keys(TEMPLATES) as DeepDiveReportType[];
