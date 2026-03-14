// Reports Hub Types for The Daily Athlete

import { StructuredReport } from './reports';

/** Deep-dive report types available in the Reports Hub */
export type DeepDiveReportType =
  | 'sport-deep-dive'
  | 'trend-report'
  | 'goal-tracker'
  | 'recovery-report'
  | 'pr-timeline'
  | 'training-analysis';

/** AI-generated daily insight stored in Firestore */
export interface AIInsight {
  text: string;
  detail?: string;
  reportType?: DeepDiveReportType;
  reportParams?: Record<string, string>;
  generatedAt: Date;
  expiresAt: Date;
}

/** A contextual deep-dive card shown in Zone 3 of the hub */
export interface DeepDiveCard {
  type: DeepDiveReportType;
  title: string;
  teaser: string;
  icon: string;
  color: string;
  href: string;
  minWorkouts: number;
}

/** Cached report stored in Firestore: users/{username}/cachedReports/{key} */
export interface CachedReport {
  reportType: DeepDiveReportType;
  params: Record<string, string>;
  report: StructuredReport;
  generatedAt: Date;
  expiresAt: Date;
}

/** Sport color mapping used across report cards */
export const SPORT_COLORS: Record<string, string> = {
  run: '#22c55e',
  bike: '#14b8a6',
  swim: '#3b82f6',
  strength: '#f97316',
  other: '#6b7280',
};

/** Sport emoji mapping */
export const SPORT_EMOJI: Record<string, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  other: '🏋️',
};

/** Sport display names */
export const SPORT_LABELS: Record<string, string> = {
  run: 'Running',
  bike: 'Cycling',
  swim: 'Swimming',
  strength: 'Strength',
  other: 'Other',
};
