import type { Status } from '../../types';
import { STATUS_META } from '../../lib/status';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';

export interface StackedBarRow {
  label: string;
  total: number;
  segments: { status: Status; count: number }[];
}

interface StackedBarsProps {
  rows: StackedBarRow[];
  onSelect?: (status: Status, program: string) => void;
  activeStatus?: Status | null;
}

export function StackedBars({
  rows,
  onSelect,
  activeStatus = null,
}: StackedBarsProps) {
  const maximum = Math.max(1, ...rows.map((row) => row.total));
  const { tooltip, show, hide, containerRef } = useChartTooltip();

  return (
    <div className="stacked-chart" ref={containerRef}>
      {rows.map((row) => (
        <div className="stacked-row" key={row.label}>
          <span className="stacked-label" title={row.label}>
            {row.label}
          </span>
          <div className="stacked-track">
            <div
              className="stacked-fill"
              style={{ width: `${(row.total / maximum) * 100}%` }}
            >
              {row.segments
                .filter((segment) => segment.count > 0)
                .map((segment) => {
                  const meta = STATUS_META[segment.status];
                  const dim =
                    activeStatus !== null && activeStatus !== segment.status;
                  return (
                    <span
                      key={segment.status}
                      className={`stacked-seg${dim ? ' is-dimmed' : ''}`}
                      style={{
                        flexGrow: segment.count,
                        backgroundColor: meta.chart,
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${row.label}, ${segment.status}: ${segment.count} projects`}
                      onMouseEnter={(event) =>
                        show(event, {
                          title: segment.status,
                          subtitle: row.label,
                          rows: [
                            {
                              label: 'Projects',
                              value: String(segment.count),
                              color: meta.chart,
                            },
                            {
                              label: 'Share of program',
                              value: `${Math.round(
                                (segment.count / row.total) * 100,
                              )}%`,
                            },
                            { label: 'Program total', value: String(row.total) },
                          ],
                        })
                      }
                      onMouseMove={(event) =>
                        show(event, {
                          title: segment.status,
                          subtitle: row.label,
                          rows: [
                            {
                              label: 'Projects',
                              value: String(segment.count),
                              color: meta.chart,
                            },
                            {
                              label: 'Share of program',
                              value: `${Math.round(
                                (segment.count / row.total) * 100,
                              )}%`,
                            },
                            { label: 'Program total', value: String(row.total) },
                          ],
                        })
                      }
                      onMouseLeave={hide}
                      onClick={() => onSelect?.(segment.status, row.label)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          onSelect?.(segment.status, row.label);
                        }
                      }}
                    />
                  );
                })}
            </div>
          </div>
          <span className="stacked-total">{row.total}</span>
        </div>
      ))}
      <ChartTooltip payload={tooltip} surfaceRef={containerRef} />
    </div>
  );
}
