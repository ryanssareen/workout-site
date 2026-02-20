// Structured Report Types for The Daily Athlete

export type ReportType = 'progress' | 'comparison' | 'summary' | 'prs' | 'insight' | 'analysis';

export type TrendDirection = 'up' | 'down' | 'neutral';

export type ChartType = 'line' | 'bar' | 'area' | 'pie';

export type IconType = 'trophy' | 'fire' | 'target' | 'alert' | 'info' | 'star' | 'trend';

// Section Types
export interface StatSection {
  type: 'stat';
  label: string;
  value: number | string;
  trend?: TrendDirection;
  change?: string;
  subtitle?: string;
}

export interface TableSection {
  type: 'table';
  headers: string[];
  rows: (string | number)[][];
  caption?: string;
}

export interface ChartSection {
  type: 'chart';
  chartType: ChartType;
  title?: string;
  data: ChartDataPoint[];
  xKey: string;
  yKey: string;
  label?: string;
}

export interface ChartDataPoint {
  [key: string]: string | number;
}

export interface TextSection {
  type: 'text';
  content: string;
  variant?: 'default' | 'muted' | 'emphasis';
}

export interface HighlightSection {
  type: 'highlight';
  icon?: IconType;
  content: string;
  variant?: 'success' | 'warning' | 'info' | 'achievement';
}

export interface PRBadgeSection {
  type: 'pr';
  exercise: string;
  value: string;
  date?: string;
  previous?: string;
}

export interface DividerSection {
  type: 'divider';
}

export type ReportSection =
  | StatSection
  | TableSection
  | ChartSection
  | TextSection
  | HighlightSection
  | PRBadgeSection
  | DividerSection;

// Complete Report Structure
export interface StructuredReport {
  reportType: ReportType;
  title: string;
  subtitle?: string;
  dateRange?: string;
  sections: ReportSection[];
  summary?: string;
  footer?: string;
}

// API Response
export interface ReportResponse {
  report: StructuredReport | null;
  isInsufficient: boolean;
  insufficientMessage?: string;
  hasData: boolean;
}
