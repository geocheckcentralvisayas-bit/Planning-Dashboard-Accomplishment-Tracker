import type { Project } from '../types';

const HEADERS = [
  'Activity ID',
  'Activity',
  'Unit',
  'Focal staff',
  'Status',
  'Risk',
  'Indicators',
  'Annual target',
  'Annual actual',
  'YTD target',
  'YTD actual',
  'YTD attainment %',
  'Annual attainment %',
  'Last reported',
  'Reporting period',
  'Remarks',
  'Means of verification',
  'Completeness flags',
];

function escapeCell(value: string | number): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadProjectsCsv(
  list: Project[],
  reportingPeriod = '',
): void {
  const rows = list.map((project) =>
    [
      project.id,
      project.name,
      project.unit,
      project.lead,
      project.status,
      project.risk,
      project.indicatorCount,
      project.annualTarget,
      project.annualActual,
      project.ytdTarget,
      project.ytdActual,
      project.ytdRate === null ? '' : (project.ytdRate * 100).toFixed(1),
      project.annualRate === null ? '' : (project.annualRate * 100).toFixed(1),
      project.lastReported,
      reportingPeriod,
      project.remarks,
      project.mov,
      project.flags.join('; '),
    ].map(escapeCell),
  );

  const csv = [HEADERS.map(escapeCell), ...rows]
    .map((row) => row.join(','))
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `EMB-R7-planning-activities-${reportingPeriod || 'snapshot'}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
