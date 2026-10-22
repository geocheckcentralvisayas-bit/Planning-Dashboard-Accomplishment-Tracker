export const PROGRAMS = [
  'Air Quality Management',
  'Water Quality Management',
  'Solid Waste Management',
  'Climate Change Adaptation',
  'Environmental Education',
  'Land & Coastal Resources',
  'Compliance & Enforcement',
] as const;
export type Program = (typeof PROGRAMS)[number];

/**
 * Status vocabulary shared by the live workbook view and the planning
 * portfolio. Every value is derived from the workbook's own targets and
 * actuals.
 */
export const STATUSES = [
  'On Track',
  'At Risk',
  'Delayed',
  'Completed',
  'Not Started',
  'No Target',
  'Unplanned',
] as const;
export type Status = (typeof STATUSES)[number];

export const PHASES = [
  'Planning',
  'Procurement',
  'Implementation',
  'Monitoring',
  'Completed',
] as const;
export type Phase = (typeof PHASES)[number];

export const RISK_LEVELS = ['Low', 'Medium', 'High'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const FUNDING_SOURCES = [
  'GAA',
  'Locally Funded',
  'Grant',
  'Special Account',
  'Donor Funded',
] as const;
export type FundingSource = (typeof FUNDING_SOURCES)[number];

/**
 * One activity group from the shared workbook's `Main (for CO)` sheet.
 *
 * A project groups the workbook's performance-indicator lines that sit under
 * the same PROGRAM / PROJECTS / ACTIVITIES heading. Everything on this object
 * is read from the workbook — nothing here is illustrative.
 */
export interface Project {
  id: string;
  /** The workbook's PROGRAM / PROJECTS / ACTIVITIES heading. */
  name: string;
  /** The workbook's SECTION / UNIT heading (one of 15 EMB Region 7 units). */
  unit: string;
  /** Focal staff from the workbook's Focals sheet. */
  lead: string;
  status: Status;
  /** Derived from the recorded attainment. */
  risk: RiskLevel;
  /** The fiscal year the workbook matrix covers. */
  startDate: string;
  targetEndDate: string;
  /** Share of the year-to-date target achieved, capped at 100. */
  percentComplete: number;
  /** How many performance-indicator lines sit under this activity. */
  indicatorCount: number;
  indicators: string[];
  annualTarget: number;
  annualActual: number;
  ytdTarget: number;
  ytdActual: number;
  ytdRate: number | null;
  annualRate: number | null;
  lastReported: string;
  lastUpdated: string;
  remarks: string;
  mov: string;
  flags: string[];
  months: ProjectMonth[];
  milestones: Milestone[];
  updates: UpdateEntry[];
}

export interface ProjectMonth {
  label: string;
  target: number;
  actual: number;
  met: boolean;
  future: boolean;
}

export type MilestoneStatus = 'Completed' | 'In Progress' | 'Pending' | 'Overdue';

export interface Milestone {
  id: string;
  projectId?: string;
  name: string;
  dueDate: string;
  status: MilestoneStatus;
  /** The quarterly target taken from the workbook's monthly target columns. */
  target?: number;
  /** The quarterly actual taken from the workbook's monthly actual columns. */
  actual?: number;
  completionDate?: string;
}

export interface UpdateEntry {
  id: string;
  projectId?: string;
  date: string;
  status: Status;
  percent: number;
  remarks: string;
  by?: string;
}

export interface Filters {
  search: string;
  /** Unit (the workbook's SECTION / UNIT). */
  program: string;
  status: string;
  risk: string;
  phase: string;
}

export type PageId =
  | 'live'
  | 'overview'
  | 'tracker'
  | 'timeline'
  | 'quality'
  | 'about';

export interface TrendPoint {
  month: string;
  label: string;
  planned: number;
  actual: number;
}
