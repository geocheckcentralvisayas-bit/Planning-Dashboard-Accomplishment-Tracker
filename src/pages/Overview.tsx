import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  Layers,
  TrendingUp,
} from 'lucide-react';
import { useFilters } from '../state/FiltersContext';
import { useWorkbook } from '../state/WorkbookContext';
import {
  attentionProjects,
  countByStatus,
  monthlyAttainment,
  summarize,
  unitBreakdown,
} from '../lib/metrics';
import type { Project, Status } from '../types';
import { STATUS_META } from '../lib/status';
import { pct } from '../lib/format';
import { FilterBar } from '../components/FilterBar';
import { KpiCard } from '../components/KpiCard';
import { StatusPill } from '../components/StatusPill';
import { ProgressBar } from '../components/ProgressBar';
import { EmptyState } from '../components/EmptyState';
import { DonutChart } from '../components/charts/DonutChart';
import { StackedBars } from '../components/charts/StackedBars';
import { TrendChart } from '../components/charts/TrendChart';

interface OverviewProps {
  onSelectProject: (project: Project) => void;
  onGoToTracker: () => void;
  onFilterByStatus?: (status: string) => void;
  onFilterByProgramStatus?: (status: string, unit: string) => void;
}

export function Overview({
  onSelectProject,
  onGoToTracker,
  onFilterByStatus,
  onFilterByProgramStatus,
}: OverviewProps) {
  const { filteredProjects, filters } = useFilters();
  const { meta } = useWorkbook();
  const summary = summarize(filteredProjects);
  const counts = countByStatus(filteredProjects);
  const breakdown = unitBreakdown(filteredProjects);
  const attention = attentionProjects(filteredProjects).slice(0, 5);
  const trend = monthlyAttainment(
    filteredProjects,
    meta?.monthLabels ?? [],
    meta?.monthsReported ?? 0,
  );

  const donutData = (Object.keys(counts) as Status[])
    .map((status) => ({
      label: status,
      value: counts[status] ?? 0,
      color: STATUS_META[status]?.chart ?? '#94a3b8',
    }))
    .filter((item) => item.value > 0);

  const medianAttainment = summary.medianAttainment;
  const deliveryRate = summary.total
    ? Math.round((summary.onTrackOrComplete / summary.total) * 100)
    : 0;

  const trendPoints = trend.map((point) => ({
    month: point.label,
    label: point.label,
    planned: Math.round(point.planned),
    actual: point.rate === null ? 0 : Math.round(point.rate * 100),
  }));

  return (
    <div className="page">
      <FilterBar />

      <div className="kpi-grid">
        <KpiCard
          icon={<Layers size={20} />}
          label="Activities"
          value={String(summary.total)}
          sub={`${summary.indicators} performance indicators`}
          tone="green"
        />
        <KpiCard
          icon={<CircleCheckBig size={20} />}
          label="On track or complete"
          value={String(summary.onTrackOrComplete)}
          sub={`${deliveryRate}% of activities`}
          tone="green"
        />
        <KpiCard
          icon={<AlertTriangle size={20} />}
          label="Needs attention"
          value={String(summary.needsAttention)}
          sub={`${counts['At Risk'] ?? 0} at risk · ${counts.Delayed ?? 0} delayed`}
          tone="amber"
        />
        <KpiCard
          icon={<BadgeCheck size={20} />}
          label="Completed"
          value={String(counts.Completed ?? 0)}
          sub="Full-year target already met"
          tone="teal"
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="Median attainment"
          value={pct(medianAttainment * 100, 0)}
          sub="Year-to-date, median across activities"
          tone="gold"
        />
        <KpiCard
          icon={<Clock3 size={20} />}
          label="Units reporting"
          value={String(summary.units)}
          sub={`${summary.noTarget} without an annual target`}
          tone="slate"
        />
      </div>

      <div className="grid grid-12">
        <section className="card span-4">
          <header className="card-head">
            <div>
              <h2>Activity status</h2>
              <p>Distribution across {summary.total} activities</p>
            </div>
            <span className="card-badge chart-hint">Hover to inspect</span>
          </header>
          <DonutChart
            data={donutData}
            total={summary.total}
            centerLabel="activities"
            activeLabel={filters.status}
            onSelect={(label) => {
              if (!onFilterByStatus) return;
              onFilterByStatus(filters.status === label ? '' : label);
            }}
          />
        </section>

        <section className="card span-5">
          <header className="card-head">
            <div>
              <h2>Performance by unit</h2>
              <p>Activities by status in each EMB Region 7 unit</p>
            </div>
            <span className="card-badge chart-hint">Click to filter</span>
          </header>
          <div className="mini-legend">
            {(Object.keys(counts) as Status[])
              .filter((status) => (counts[status] ?? 0) > 0)
              .map((status) => (
                <span key={status}>
                  <span
                    className="legend-dot"
                    style={{ backgroundColor: STATUS_META[status]?.chart }}
                  />
                  {status}
                </span>
              ))}
          </div>
          <StackedBars
            rows={breakdown.map((group) => ({
              label: group.unit,
              total: group.total,
              segments: (Object.keys(counts) as Status[]).map((status) => ({
                status,
                count: group.counts[status] ?? 0,
              })),
            }))}
            activeStatus={(filters.status as Status) || null}
            onSelect={(status, unit) => {
              if (!onFilterByProgramStatus) return;
              const sameStatus = filters.status === status;
              const sameUnit = filters.program === unit;
              onFilterByProgramStatus(
                sameStatus ? '' : status,
                sameUnit ? '' : unit,
              );
            }}
          />
        </section>

        <section className="card span-3 attainment-card">
          <header className="card-head">
            <div>
              <h2>Median attainment</h2>
              <p>Year-to-date against target</p>
            </div>
          </header>
          <div className="budget-figure">{pct(medianAttainment * 100, 1)}</div>
          <p className="budget-caption">
            of the year-to-date target across {summary.total} activities
          </p>
          <ProgressBar
            value={medianAttainment * 100}
            color="var(--gold-500)"
            className="budget-progress"
          />
          <div className="budget-metrics">
            <div>
              <span>On track or done</span>
              <strong>{summary.onTrackOrComplete}</strong>
            </div>
            <div>
              <span>Needs attention</span>
              <strong>{summary.needsAttention}</strong>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-12">
        <section className="card span-7">
          <header className="card-head">
            <div>
              <h2>Delivery against plan</h2>
              <p>
                Cumulative share of the full-year target achieved, against a
                straight-line plan
              </p>
            </div>
            <div className="chart-legend">
              <span>
                <i className="key-line key-planned" />
                Plan
              </span>
              <span>
                <i className="key-line key-actual" />
                Achieved
              </span>
              <span className="chart-hint-text">Hover to inspect</span>
            </div>
          </header>
          {trendPoints.length > 1 ? (
            <TrendChart points={trendPoints} />
          ) : (
            <div className="chart-empty">
              Not enough reporting months for the current filters.
            </div>
          )}
        </section>

        <section className="card span-5">
          <header className="card-head">
            <div>
              <h2>Attention required</h2>
              <p>Delayed, at risk, or not yet started</p>
            </div>
          </header>
          {attention.length ? (
            <>
              <ul className="attention-list">
                {attention.map((project) => (
                  <li key={project.id}>
                    <button
                      type="button"
                      className="attention-item"
                      onClick={() => onSelectProject(project)}
                    >
                      <span
                        className="attention-bar"
                        style={{
                          backgroundColor:
                            STATUS_META[project.status]?.chart,
                        }}
                      />
                      <span className="attention-copy">
                        <span className="attention-name">{project.name}</span>
                        <span className="attention-meta">
                          {project.unit} · {project.lead || 'No focal listed'}
                        </span>
                      </span>
                      <StatusPill status={project.status} compact />
                      <ChevronRight size={16} className="attention-chevron" />
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="card-link"
                onClick={onGoToTracker}
              >
                Open full tracker
                <ChevronRight size={14} />
              </button>
            </>
          ) : (
            <EmptyState
              title="No delivery risks"
              message="No activity is delayed, at risk, or unstarted under the current filters."
            />
          )}
        </section>
      </div>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>Reporting checkpoints</h2>
            <p>Quarterly targets taken from the workbook's monthly target columns</p>
          </div>
          <span className="card-badge">
            <CalendarClock size={14} />
            {meta?.reportingLabel ?? '—'}
          </span>
        </header>

        {breakdown.length ? (
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Activities</th>
                  <th>Indicators</th>
                  <th>Median YTD</th>
                  <th>Status mix</th>
                  <th className="live-lead-col">Focal</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.map((group) => (
                  <tr key={group.unit}>
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        onClick={() => {
                          if (!onFilterByProgramStatus) return;
                          onFilterByProgramStatus(
                            filters.status,
                            filters.program === group.unit
                              ? ''
                              : group.unit,
                          );
                        }}
                      >
                        {group.unit}
                      </button>
                    </td>
                    <td className="num">{group.total}</td>
                    <td className="num">{group.indicators}</td>
                    <td>
                      <div className="cell-progress">
                        <span>
                          {group.medianRate === null
                            ? '—'
                            : pct(group.medianRate * 100, 0)}
                        </span>
                        <ProgressBar
                          value={(group.medianRate ?? 0) * 100}
                          color={
                            (group.medianRate ?? 0) >= 0.9
                              ? STATUS_META['On Track'].chart
                              : (group.medianRate ?? 0) >= 0.7
                                ? STATUS_META['At Risk'].chart
                                : STATUS_META.Delayed.chart
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <span className="live-status-mix">
                        {(Object.keys(group.counts) as Status[])
                          .filter((status) => (group.counts[status] ?? 0) > 0)
                          .map((status) => (
                            <span key={status} className="status-pill status-pill-compact">
                              <span
                                className="status-dot"
                                style={{
                                  backgroundColor:
                                    STATUS_META[status]?.chart,
                                }}
                              />
                              {group.counts[status]}
                            </span>
                          ))}
                      </span>
                    </td>
                    <td className="live-lead-col muted" title={group.lead}>
                      {group.lead || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No activities to report"
            message="No activity groups match the current filters."
          />
        )}
      </section>
    </div>
  );
}
