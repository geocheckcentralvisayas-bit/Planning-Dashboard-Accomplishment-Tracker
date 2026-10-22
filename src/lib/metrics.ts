import type {
  Filters,
  Milestone,
  Project,
  RiskLevel,
  Status,
} from '../types';

export const EMPTY_FILTERS: Filters = {
  search: '',
  program: '',
  status: '',
  risk: '',
  phase: '',
};

export function applyFilters(list: Project[], filters: Filters): Project[] {
  const query = filters.search.trim().toLowerCase();
  return list.filter((project) => {
    if (filters.program && project.unit !== filters.program) return false;
    if (filters.status && project.status !== filters.status) return false;
    if (filters.risk && project.risk !== filters.risk) return false;
    if (query) {
      const haystack = [
        project.name,
        project.id,
        project.lead,
        project.unit,
        project.remarks,
        project.mov,
        ...project.indicators,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function countByStatus(list: Project[]): Record<Status, number> {
  const counts = {} as Record<Status, number>;
  for (const project of list) {
    counts[project.status] = (counts[project.status] ?? 0) + 1;
  }
  return counts;
}

export function countByRisk(list: Project[]): Record<RiskLevel, number> {
  const counts: Record<RiskLevel, number> = { Low: 0, Medium: 0, High: 0 };
  for (const project of list) counts[project.risk] += 1;
  return counts;
}

/** Indicators that still need work: behind target or still unstarted. */
export function attentionProjects(list: Project[]): Project[] {
  return list
    .filter(
      (project) =>
        project.status === 'Delayed' ||
        project.status === 'At Risk' ||
        project.status === 'Not Started',
    )
    .sort((a, b) => {
      const left = a.ytdRate ?? -1;
      const right = b.ytdRate ?? -1;
      return left - right;
    });
}

export interface PortfolioSummary {
  total: number;
  counts: Record<Status, number>;
  indicators: number;
  avgAttainment: number;
  medianAttainment: number;
  onTrackOrComplete: number;
  needsAttention: number;
  units: number;
  noTarget: number;
}

function ratesOf(list: Project[]): number[] {
  return list
    .map((project) => project.ytdRate)
    .filter((rate): rate is number => rate !== null);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function summarize(list: Project[]): PortfolioSummary {
  const counts = countByStatus(list);
  const rates = ratesOf(list);
  const onTrackOrComplete =
    (counts['On Track'] ?? 0) + (counts.Completed ?? 0);

  return {
    total: list.length,
    counts,
    indicators: list.reduce((sum, p) => sum + p.indicatorCount, 0),
    avgAttainment: rates.length
      ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      : 0,
    medianAttainment: median(rates),
    onTrackOrComplete,
    needsAttention:
      (counts['At Risk'] ?? 0) + (counts.Delayed ?? 0) + (counts['Not Started'] ?? 0),
    units: new Set(list.map((project) => project.unit)).size,
    noTarget: (counts['No Target'] ?? 0) + (counts.Unplanned ?? 0),
  };
}

export interface UnitBreakdown {
  unit: string;
  total: number;
  indicators: number;
  counts: Record<Status, number>;
  medianRate: number | null;
  lead: string;
}

export function unitBreakdown(list: Project[]): UnitBreakdown[] {
  const groups = new Map<string, Project[]>();
  for (const project of list) {
    const current = groups.get(project.unit);
    if (current) current.push(project);
    else groups.set(project.unit, [project]);
  }

  return [...groups.entries()]
    .map(([unit, items]) => {
      const rates = ratesOf(items);
      return {
        unit,
        total: items.length,
        indicators: items.reduce((sum, p) => sum + p.indicatorCount, 0),
        counts: countByStatus(items),
        medianRate: rates.length ? median(rates) : null,
        lead: items.find((item) => item.lead)?.lead ?? '',
      };
    })
    .sort((a, b) => {
      if (a.medianRate === null) return 1;
      if (b.medianRate === null) return -1;
      if (b.medianRate !== a.medianRate) return b.medianRate - a.medianRate;
      return a.unit.localeCompare(b.unit);
    });
}

/**
 * The monthly delivery series across the whole portfolio.
 *
 * `rate` is the median share of the **full-year** target achieved by the end
 * of each month — the classic cumulative S-curve. `planned` is the straight
 * line a unit would follow by spreading its annual target evenly across the
 * year. Both are derived from the workbook's monthly target and actual
 * columns; the plan line is the calendar, not an estimate.
 */
export interface MonthPoint {
  label: string;
  rate: number | null;
  planned: number;
  met: number;
  assessed: number;
}

export function monthlyAttainment(
  list: Project[],
  monthLabels: string[],
  monthsReported: number,
): MonthPoint[] {
  return monthLabels.slice(0, monthsReported).map((label, index) => {
    const rates: number[] = [];
    let met = 0;
    let assessed = 0;

    for (const project of list) {
      const month = project.months[index];
      if (!month) continue;

      // The month-level check drives the "met" count.
      if (month.target > 0.0001) {
        assessed += 1;
        if (month.actual >= month.target) met += 1;
      }

      // The cumulative curve is measured against the full-year target.
      if (project.annualTarget <= 0.0001) continue;
      let cumulative = 0;
      for (let m = 0; m <= index; m += 1) {
        cumulative += project.months[m]?.actual ?? 0;
      }
      rates.push(cumulative / project.annualTarget);
    }

    return {
      label,
      rate: rates.length ? median(rates) : null,
      planned: ((index + 1) / 12) * 100,
      met,
      assessed,
    };
  });
}

/** Every milestone in the portfolio, flattened for the timeline and quality views. */
export interface MilestoneWithProject {
  milestone: Milestone;
  project: Project;
  daysLeft: number;
}

export function allMilestones(list: Project[]): MilestoneWithProject[] {
  return list
    .flatMap((project) =>
      project.milestones.map((milestone) => ({
        milestone,
        project,
        daysLeft: daysBetweenISO(milestone.dueDate, TODAY_ISO),
      })),
    )
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function overdueMilestones(
  list: Project[],
): MilestoneWithProject[] {
  return allMilestones(list).filter(
    (entry) =>
      entry.milestone.status === 'Overdue' || entry.milestone.status === 'Pending',
  );
}

export interface IncompleteProject {
  project: Project;
  missing: string[];
}

/** Records missing the fields the reporting cycle depends on. */
export function incompleteProjects(list: Project[]): IncompleteProject[] {
  return list
    .map((project) => {
      const missing: string[] = [];
      if (!project.remarks.trim()) missing.push('Remarks');
      if (!project.mov.trim()) missing.push('Means of verification');
      if (project.annualTarget <= 0.0001) missing.push('Annual target');
      if (project.annualTarget > 0.0001 && project.annualActual <= 0.0001) {
        missing.push('Accomplishment');
      }
      if (!project.lead.trim()) missing.push('Focal staff');
      return { project, missing };
    })
    .filter((entry) => entry.missing.length > 0);
}

export interface HealthScore {
  score: number;
  completeness: number;
  attainment: number;
  timeliness: number;
  coverage: number;
}

/**
 * A data-health reading of the workbook. Every component is measured against
 * the fields and figures the workbook actually contains.
 */
export function healthScore(list: Project[]): HealthScore {
  const total = list.length;
  if (!total) {
    return {
      score: 0,
      completeness: 0,
      attainment: 0,
      timeliness: 0,
      coverage: 0,
    };
  }

  const withRemarks = list.filter((p) => p.remarks.trim()).length;
  const withMov = list.filter((p) => p.mov.trim()).length;
  const withLead = list.filter((p) => p.lead.trim()).length;
  const withTarget = list.filter((p) => p.annualTarget > 0.0001).length;
  const withActual = list.filter((p) => p.annualActual > 0.0001).length;

  const completeness = Math.round(
    ((withRemarks + withMov + withLead) / (total * 3)) * 100,
  );
  const coverage = Math.round(((withTarget + withActual) / (total * 2)) * 100);

  const rates = ratesOf(list);
  const attainment = rates.length
    ? Math.round(
        (rates.filter((rate) => rate >= 0.9).length / rates.length) * 100,
      )
    : 0;

  const milestones = allMilestones(list);
  const closed = milestones.filter(
    (entry) => entry.milestone.status === 'Completed',
  ).length;
  const timeliness = milestones.length
    ? Math.round((closed / milestones.length) * 100)
    : 100;

  const score = Math.round(
    completeness * 0.3 +
      coverage * 0.25 +
      attainment * 0.25 +
      timeliness * 0.2,
  );

  return { score, completeness, attainment, timeliness, coverage };
}

/** Today's date, used for milestone and reporting-window comparisons. */
export const TODAY_ISO = new Date().toISOString().slice(0, 10);

function daysBetweenISO(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function activeFilterCount(filters: Filters): number {
  return (
    (filters.program ? 1 : 0) +
    (filters.status ? 1 : 0) +
    (filters.risk ? 1 : 0) +
    (filters.search.trim() ? 1 : 0)
  );
}
