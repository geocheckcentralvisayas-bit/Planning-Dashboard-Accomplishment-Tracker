export type LiveStatus =
  | 'On Track'
  | 'At Risk'
  | 'Delayed'
  | 'Completed'
  | 'Not Started'
  | 'No Target'
  | 'Unplanned';

export interface LiveMonthlyPoint {
  index: number;
  label: string;
  assessed: number;
  met: number;
  metRate: number | null;
  medianRate: number | null;
  isReportingMonth: boolean;
  isFuture: boolean;
}

export interface LiveRecord {
  id: string;
  row: number;
  section: string;
  project: string;
  indicator: string;
  lead: string;
  targets: number[];
  actuals: number[];
  annualTarget: number;
  annualActual: number;
  ytdTarget: number;
  ytdActual: number;
  ytdRate: number | null;
  annualRate: number | null;
  status: LiveStatus;
  latestActualMonth: string;
  remarks: string;
  mov: string;
  flags: string[];
}

export interface LiveSection {
  section: string;
  activities: number;
  medianRate: number | null;
  onTrack: number;
  atRisk: number;
  delayed: number;
  completed: number;
  notStarted: number;
  unplanned: number;
  noTarget: number;
  lead: string;
}

export interface LiveMeta {
  sourceFile: string;
  sourceFolder: string;
  sourceSheet: string;
  reportingYear: number;
  reportingMonth: number;
  reportingIndex: number;
  reportingLabel: string;
  monthsReported: number;
  monthLabels: string[];
  monthLabelsLong: string[];
  generatedAt: string;
  workbookModifiedAt: string;
  recordCount: number;
  sectionCount: number;
  medianYtdRate: number | null;
  averageYtdRate: number | null;
  statusCounts: Partial<Record<LiveStatus, number>>;
  dataQuality: {
    missingRemarks: number;
    missingMov: number;
    noTarget: number;
    noAccomplishment: number;
  };
  focalNote: string;
  snapshotNote: string;
}

export interface LivePayload {
  meta: LiveMeta;
  monthly: LiveMonthlyPoint[];
  sections: LiveSection[];
  records: LiveRecord[];
}
