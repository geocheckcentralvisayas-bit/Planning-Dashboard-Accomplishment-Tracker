import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project, Status } from '../../types';
import {
  addDays,
  daysBetween,
  formatMonth,
  parseDate,
  toISO,
} from '../../lib/format';
import { MILESTONE_META, STATUS_META } from '../../lib/status';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

interface GanttChartProps {
  projects: Project[];
  /** The reporting date taken from the workbook. */
  asOf: string;
  onSelect: (project: Project) => void;
}

export function GanttChart({ projects, asOf, onSelect }: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const projectKey = projects.map((project) => project.id).join('|');
  const [hovered, setHovered] = useState<string | null>(null);
  const { tooltip, show, hide, containerRef } = useChartTooltip();

  const range = useMemo(() => {
    if (projects.length === 0) return null;

    let minimum = projects[0].startDate;
    let maximum = projects[0].targetEndDate;
    for (const project of projects) {
      if (project.startDate < minimum) minimum = project.startDate;
      if (project.targetEndDate > maximum) maximum = project.targetEndDate;
    }

    const start = addDays(parseDate(minimum), -7);
    const end = addDays(parseDate(maximum), 7);
    const months: { key: string; label: string; year: string; days: number }[] =
      [];

    const cursor = startOfMonth(start);
    while (cursor <= end) {
      const monthStart = new Date(cursor);
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const clippedStart = monthStart < start ? start : monthStart;
      const clippedEnd = next > end ? end : next;
      months.push({
        key: toISO(monthStart),
        label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        year: String(monthStart.getFullYear()).slice(2),
        days: Math.max(1, daysBetween(toISO(clippedStart), toISO(clippedEnd))),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return {
      start: toISO(start),
      end: toISO(end),
      months,
      totalDays: Math.max(1, daysBetween(toISO(start), toISO(end))),
    };
  }, [projects]);

  const labelWidth = 250;
  const todayOffset = range
    ? (daysBetween(range.start, asOf) / range.totalDays) * 100
    : 0;
  const trackWidth = range ? Math.max(780, range.months.length * 82) : 0;

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !range) return;
    if (todayOffset < 0 || todayOffset > 100) return;
    const target =
      labelWidth + (todayOffset / 100) * trackWidth - element.clientWidth * 0.42;
    element.scrollLeft = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey, todayOffset, trackWidth]);

  if (!range) {
    return (
      <div className="chart-empty">No activity matches the current filters.</div>
    );
  }

  const { start, months, totalDays } = range;
  const offset = (iso: string) =>
    (daysBetween(start, iso) / totalDays) * 100;
  const showToday = todayOffset >= 0 && todayOffset <= 100;

  // Group by the workbook's own SECTION / UNIT headings.
  const unitOrder: string[] = [];
  const grouped = new Map<string, Project[]>();
  for (const project of projects) {
    const bucket = grouped.get(project.unit);
    if (bucket) bucket.push(project);
    else {
      grouped.set(project.unit, [project]);
      unitOrder.push(project.unit);
    }
  }
  const groups = unitOrder
    .map((unit) => ({
      unit,
      items: grouped
        .get(unit)!
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((group) => group.items.length > 0);

  const totalWidth = labelWidth + trackWidth;
  const todayX = labelWidth + (todayOffset / 100) * trackWidth;

  return (
    <div className="gantt" ref={containerRef}>
      <div className="gantt-legend">
        {(Object.keys(STATUS_META) as Status[])
          .filter((status) => projects.some((p) => p.status === status))
          .map((status) => (
            <span key={status} className="gantt-legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: STATUS_META[status].chart }}
              />
              {status}
            </span>
          ))}
        <span className="gantt-legend-item gantt-legend-milestone">
          <span className="milestone-diamond" />
          Quarterly checkpoint
        </span>
        <span className="gantt-legend-item gantt-legend-milestone">
          <span className="today-line-key" />
          Reporting month
        </span>
      </div>

      <div className="gantt-meta">
        <span>
          <strong>{formatMonth(range.start)}</strong> to{' '}
          <strong>{formatMonth(range.end)}</strong>
        </span>
        <span>
          Scroll horizontally · checkpoints are the quarterly targets in the
          workbook
        </span>
      </div>

      <div className="gantt-scroll" ref={scrollRef}>
        <div className="gantt-inner" style={{ width: totalWidth }}>
          <div className="gantt-head">
            <div className="gantt-head-label" style={{ width: labelWidth }}>
              Activity
            </div>
            <div className="gantt-month-row" style={{ width: trackWidth }}>
              {months.map((month, index) => (
                <span
                  key={month.key}
                  className="gantt-month"
                  style={{ width: `${(month.days / totalDays) * 100}%` }}
                >
                  {month.label}
                  {month.label === 'Jan' || index === 0 ? (
                    <small>{month.year}</small>
                  ) : null}
                </span>
              ))}
            </div>
          </div>

          <div className="gantt-body">
            {showToday ? (
              <span className="gantt-today" style={{ left: todayX }}>
                <span>Reporting</span>
              </span>
            ) : null}

            {groups.map((group) => (
              <div className="gantt-group" key={group.unit}>
                <div className="gantt-group-head" style={{ width: totalWidth }}>
                  <span
                    className="gantt-group-label"
                    style={{ width: labelWidth }}
                  >
                    {group.unit}
                    <span className="gantt-group-count">
                      {group.items.length}
                    </span>
                  </span>
                </div>

                {group.items.map((project) => {
                  const barLeft = offset(project.startDate);
                  const barWidth = Math.max(
                    1.2,
                    offset(project.targetEndDate) - barLeft,
                  );
                  const isHovered = hovered === project.id;

                  const ganttTip = (event: {
                    clientX: number;
                    clientY: number;
                  }) => {
                    const meta = STATUS_META[project.status];
                    const checkpoints = project.milestones.filter(
                      (milestone) => milestone.status === 'Completed',
                    ).length;
                    show(event, {
                      title: project.name,
                      subtitle: `${project.unit} · ${project.lead || 'No focal listed'}`,
                      rows: [
                        {
                          label: 'Status',
                          value: project.status,
                          color: meta.chart,
                        },
                        {
                          label: 'Attainment',
                          value:
                            project.ytdRate === null
                              ? '—'
                              : `${Math.round(project.ytdRate * 100)}%`,
                        },
                        {
                          label: 'YTD target / actual',
                          value: `${project.ytdTarget} / ${project.ytdActual}`,
                        },
                        {
                          label: 'Checkpoints met',
                          value: `${checkpoints} of ${project.milestones.length}`,
                        },
                        {
                          label: 'Indicators',
                          value: String(project.indicatorCount),
                        },
                        {
                          label: 'Last reported',
                          value: project.lastReported,
                        },
                      ],
                    });
                  };

                  return (
                    <div
                      key={project.id}
                      className={`gantt-row${isHovered ? ' is-hovered' : ''}`}
                      style={{ width: totalWidth }}
                      role="button"
                      tabIndex={0}
                      onMouseEnter={(event) => {
                        setHovered(project.id);
                        ganttTip(event);
                      }}
                      onMouseMove={ganttTip}
                      onMouseLeave={() => {
                        setHovered(null);
                        hide();
                      }}
                      onClick={() => onSelect(project)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect(project);
                        }
                      }}
                    >
                      <div
                        className="gantt-label"
                        style={{ width: labelWidth }}
                      >
                        <span className="gantt-name" title={project.name}>
                          {project.name}
                        </span>
                        <span className="gantt-lead">
                          {project.ytdRate === null
                            ? '—'
                            : `${Math.round(project.ytdRate * 100)}%`}{' '}
                          · {project.lead || 'No focal'}
                        </span>
                      </div>

                      <div
                        className="gantt-track"
                        style={{ width: trackWidth }}
                      >
                        {months.map((month) => (
                          <span
                            key={month.key}
                            className="gantt-cell"
                            style={{
                              width: `${(month.days / totalDays) * 100}%`,
                            }}
                          />
                        ))}

                        <span
                          className="gantt-bar"
                          style={{
                            left: `${barLeft}%`,
                            width: `${barWidth}%`,
                            backgroundColor: STATUS_META[project.status].chart,
                          }}
                        >
                          <span
                            className="gantt-bar-progress"
                            style={{
                              width: `${project.percentComplete}%`,
                              backgroundColor:
                                STATUS_META[project.status].chart,
                            }}
                          />
                        </span>

                        {project.milestones.map((milestone) => (
                          <span
                            key={milestone.id}
                            className="gantt-milestone"
                            style={{
                              left: `${offset(milestone.dueDate)}%`,
                              backgroundColor:
                                MILESTONE_META[milestone.status].color,
                            }}
                            title={`${milestone.name}: ${milestone.target} target, ${milestone.actual} actual`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ChartTooltip payload={tooltip} surfaceRef={containerRef} />
    </div>
  );
}
