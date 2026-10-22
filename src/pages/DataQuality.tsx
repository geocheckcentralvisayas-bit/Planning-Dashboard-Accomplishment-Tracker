import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  MessageSquareWarning,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { useFilters } from '../state/FiltersContext';
import { useWorkbook } from '../state/WorkbookContext';
import {
  allMilestones,
  healthScore,
  incompleteProjects,
  summarize,
} from '../lib/metrics';
import { formatDate } from '../lib/format';
import type { Project } from '../types';
import { FilterBar } from '../components/FilterBar';
import { KpiCard } from '../components/KpiCard';
import { StatusPill } from '../components/StatusPill';
import { EmptyState } from '../components/EmptyState';

interface DataQualityProps {
  onSelectProject: (project: Project) => void;
}

export function DataQuality({ onSelectProject }: DataQualityProps) {
  const { filteredProjects } = useFilters();
  const { meta } = useWorkbook();
  const summary = summarize(filteredProjects);
  const health = healthScore(filteredProjects);
  const incomplete = incompleteProjects(filteredProjects);
  const milestones = allMilestones(filteredProjects);
  const overdue = milestones.filter(
    (entry) => entry.milestone.status === 'Overdue',
  );
  const pending = milestones.filter(
    (entry) => entry.milestone.status === 'Pending',
  );

  const missingRemarks = filteredProjects.filter(
    (project) => !project.remarks.trim(),
  ).length;
  const missingMov = filteredProjects.filter(
    (project) => !project.mov.trim(),
  ).length;
  const noTarget = filteredProjects.filter(
    (project) => project.annualTarget <= 0.0001,
  ).length;
  const noActual = filteredProjects.filter(
    (project) => project.annualTarget > 0.0001 && project.annualActual <= 0.0001,
  ).length;

  const label =
    health.score >= 85
      ? 'Healthy'
      : health.score >= 70
        ? 'Needs attention'
        : 'At risk';
  const healthClass =
    health.score >= 85
      ? 'is-good'
      : health.score >= 70
        ? 'is-warn'
        : 'is-bad';
  const ringColor =
    health.score >= 85
      ? 'var(--green-600)'
      : health.score >= 70
        ? 'var(--gold-500)'
        : 'var(--red-500)';

  const metrics = [
    {
      label: 'Record completeness',
      value: health.completeness,
      hint: `${missingRemarks} missing remarks · ${missingMov} missing MOV`,
    },
    {
      label: 'Target coverage',
      value: health.coverage,
      hint: `${noTarget} without a target · ${noActual} without actuals`,
    },
    {
      label: 'On-track attainment',
      value: health.attainment,
      hint: 'Activities at 90% or better',
    },
    {
      label: 'Checkpoint timeliness',
      value: health.timeliness,
      hint: `${overdue.length} overdue · ${pending.length} pending`,
    },
  ];

  return (
    <div className="page">
      <FilterBar />

      <section className="card health-card">
        <div
          className="health-ring"
          style={{
            background: `conic-gradient(${ringColor} ${
              health.score * 3.6
            }deg, var(--slate-100) 0deg)`,
          }}
        >
          <div className="health-ring-inner">
            <strong>{health.score}</strong>
            <span>health score</span>
          </div>
        </div>

        <div className="health-copy">
          <span className={`health-badge ${healthClass}`}>
            <ShieldCheck size={13} />
            {label}
          </span>
          <h2>Workbook data health</h2>
          <p>
            Composite of record completeness, target coverage, on-track
            attainment, and quarterly checkpoint timeliness — all measured on
            the {meta?.sourceSheet ?? 'Main (for CO)'} sheet.
          </p>
        </div>

        <div className="health-breakdown">
          {metrics.map((metric) => (
            <div className="health-metric" key={metric.label}>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}%</strong>
              </div>
              <div className="health-bar">
                <span
                  style={{
                    width: `${metric.value}%`,
                    backgroundColor:
                      metric.value >= 80
                        ? 'var(--green-500)'
                        : metric.value >= 60
                          ? 'var(--gold-500)'
                          : 'var(--red-500)',
                  }}
                />
              </div>
              <small>{metric.hint}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="kpi-grid kpi-grid-4">
        <KpiCard
          icon={<MessageSquareWarning size={20} />}
          label="Missing remarks"
          value={String(missingRemarks)}
          sub="Activities with no status narrative"
          tone="amber"
        />
        <KpiCard
          icon={<FileWarning size={20} />}
          label="Missing MOV"
          value={String(missingMov)}
          sub="No means of verification recorded"
          tone="amber"
        />
        <KpiCard
          icon={<Target size={20} />}
          label="No target"
          value={String(noTarget)}
          sub="Activities without an annual target"
          tone="red"
        />
        <KpiCard
          icon={<AlertTriangle size={20} />}
          label="Overdue checkpoints"
          value={String(overdue.length)}
          sub={`${pending.length} quarterly checkpoints still pending`}
          tone="red"
        />
      </div>

      <div className="grid grid-12">
        <section className="card span-6">
          <header className="card-head">
            <div>
              <h2>Activities missing reporting fields</h2>
              <p>Remarks and means of verification are still blank</p>
            </div>
            <span className="card-badge">{incomplete.length}</span>
          </header>

          {incomplete.length ? (
            <div className="table-wrap quality-table">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Unit</th>
                    <th>Missing fields</th>
                  </tr>
                </thead>
                <tbody>
                  {incomplete.slice(0, 12).map((entry) => (
                    <tr key={entry.project.id}>
                      <td>
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => onSelectProject(entry.project)}
                        >
                          {entry.project.name}
                        </button>
                      </td>
                      <td className="muted">{entry.project.unit}</td>
                      <td>
                        <span className="missing-list">
                          {entry.missing.map((field) => (
                            <span className="missing-chip" key={field}>
                              {field}
                            </span>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="All records are complete"
              message="Every activity has remarks and a means of verification."
            />
          )}
        </section>

        <section className="card span-6">
          <header className="card-head">
            <div>
              <h2>Overdue quarterly checkpoints</h2>
              <p>Quarterly targets that were not met by their due date</p>
            </div>
            <span className="card-badge">{overdue.length}</span>
          </header>

          {overdue.length ? (
            <div className="table-wrap quality-table">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Checkpoint</th>
                    <th>Activity</th>
                    <th>Due date</th>
                    <th className="num">Target</th>
                    <th className="num">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {overdue.slice(0, 12).map((entry) => (
                    <tr key={entry.milestone.id}>
                      <td>{entry.milestone.name}</td>
                      <td>
                        <button
                          type="button"
                          className="table-link"
                          onClick={() => onSelectProject(entry.project)}
                        >
                          {entry.project.name}
                        </button>
                      </td>
                      <td>{formatDate(entry.milestone.dueDate)}</td>
                      <td className="num">{entry.milestone.target}</td>
                      <td className="num">{entry.milestone.actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No overdue checkpoints"
              message="Every quarterly target that has come due was met."
            />
          )}
        </section>
      </div>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>Activity register</h2>
            <p>
              Every activity group in the workbook with its reporting status
              and completeness flags
            </p>
          </div>
          <span className="card-badge">
            <CheckCircle2 size={13} />
            {summary.total} activities
          </span>
        </header>

        {filteredProjects.length ? (
          <div className="table-wrap">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.slice(0, 40).map((project) => (
                  <tr key={project.id}>
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        onClick={() => onSelectProject(project)}
                      >
                        {project.name}
                      </button>
                    </td>
                    <td className="muted">{project.unit}</td>
                    <td>
                      <StatusPill status={project.status} compact />
                    </td>
                    <td>
                      {project.flags.length ? (
                        <span className="missing-list">
                          {project.flags.map((flag) => (
                            <span className="missing-chip" key={flag}>
                              {flag}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="Nothing to report"
            message="No activity matches the current filters."
          />
        )}
      </section>
    </div>
  );
}
