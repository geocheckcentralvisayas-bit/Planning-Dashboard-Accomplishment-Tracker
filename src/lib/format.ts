const MS_PER_DAY = 86_400_000;

/**
 * The reporting date used for relative labels. Set once from the workbook's
 * own reporting month so every "days ago" figure matches the snapshot.
 */
let reportingAsOf = '2026-10-22';

export function setReportingAsOf(iso: string): void {
  if (iso) reportingAsOf = iso;
}

export function getReportingAsOf(): string {
  return reportingAsOf;
}

export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function daysBetween(fromISO: string, toISOValue: string): number {
  const from = parseDate(fromISO);
  const to = parseDate(toISOValue);
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

export function formatDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatMonth(iso: string): string {
  return parseDate(iso).toLocaleDateString('en-PH', {
    month: 'short',
    year: 'numeric',
  });
}

/** Relative to the reporting date recorded in the workbook. */
export function relativeDays(iso: string): string {
  const diff = daysBetween(iso, reportingAsOf);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1) return `${diff} days ago`;
  if (diff === -1) return 'Tomorrow';
  return `in ${Math.abs(diff)} days`;
}

export function formatMoney(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `₱${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `₱${Math.round(value / 1_000)}K`;
  }
  return `₱${value.toLocaleString('en-PH')}`;
}

export function formatPesoFull(value: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-PH');
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function daysLeftLabel(targetISO: string): string {
  const diff = daysBetween(reportingAsOf, targetISO);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  return `${diff}d left`;
}
