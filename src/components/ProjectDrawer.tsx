import { useEffect, useRef } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Target,
  UserRound,
  X,
} from 'lucide-react';
import type { Project } from '../types';
import { daysBetween, formatDate, pct } from '../lib/format';
import { MILESTONE_META, RISK_META, STATUS_META } from '../lib/status';
import { StatusPill } from './StatusPill';
import { ProgressBar } from './ProgressBar';

interface ProjectDrawerProps {
  project: Project | null;
  /** The reporting date taken from the workbook. */
  asOf: string;
  onClose: () => void;
}

export function ProjectDrawer({ project, asOf, onClose }: ProjectDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!project) return;

    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);

      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === drawerRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKey);
    drawerRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
    };
  }, [project, onClose]);

  if (!project) return null;

  const milestones = project.milestones;
  const updates = [...project.updates].reverse().slice(0, 6);
  const daysLeft = daysBetween(asOf, project.targetEndDate);
  const isClosed = project.status === 'Completed';
  const completedMilestones = milestones.filter(
    (milestone) => milestone.status === 'Completed',
  ).length;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div className="drawer-heading">
            <span className="eyebrow">{project.unit}</span>
            <h2 id="drawer-title">{project.name}</h2>
            <div className="drawer-meta-line">
              <span className="mono">{project.id}</span>
              <StatusPill status={project.status} />
              <span
                className="risk-pill"
                style={{
                  color: RISK_META[project.risk].color,
                  backgroundColor: RISK_META[project.risk].bg,
                }}
              >
                {project.risk} risk
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close activity details"
          >
            <X size={20} />
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-stats">
            <div>
              <span>YTD attainment</span>
              <strong>
                {project.ytdRate === null
                  ? '—'
                  : pct(project.ytdRate * 100, 1)}
              </strong>
              <ProgressBar
                value={project.percentComplete}
                color={STATUS_META[project.status]?.chart}
              />
            </div>
            <div>
              <span>YTD target</span>
              <strong>{project.ytdTarget}</strong>
              <small>Annual {project.annualTarget}</small>
            </div>
            <div>
              <span>YTD actual</span>
              <strong>{project.ytdActual}</strong>
              <small>Annual {project.annualActual}</small>
            </div>
          </div>

          <section className="drawer-section">
            <h3>Activity details</h3>
            <dl className="detail-grid">
              <div>
                <dt>
                  <Building2 size={14} /> Unit
                </dt>
                <dd>{project.unit}</dd>
              </div>
              <div>
                <dt>
                  <UserRound size={14} /> Focal staff
                </dt>
                <dd>{project.lead || 'Not listed'}</dd>
              </div>
              <div>
                <dt>
                  <ClipboardList size={14} /> Indicators
                </dt>
                <dd>{project.indicatorCount}</dd>
              </div>
              <div>
                <dt>
                  <Target size={14} /> Annual attainment
                </dt>
                <dd>
                  {project.annualRate === null
                    ? '—'
                    : pct(project.annualRate * 100, 1)}
                </dd>
              </div>
              <div>
                <dt>
                  <CalendarDays size={14} /> Reporting year
                </dt>
                <dd>
                  {formatDate(project.startDate)} –{' '}
                  {formatDate(project.targetEndDate)}
                </dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={14} /> Last reported
                </dt>
                <dd>
                  {project.lastReported}
                  {daysLeft < 0 && !isClosed ? (
                    <span className="muted">
                      {' '}
                      · {Math.abs(daysLeft)}d to year end
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </section>

          <section className="drawer-section">
            <h3>Performance indicators</h3>
            <ul className="indicator-list">
              {project.indicators.map((indicator) => (
                <li key={indicator}>{indicator}</li>
              ))}
            </ul>
          </section>

          <section className="drawer-section">
            <h3>Monthly target vs accomplishment</h3>
            <div className="table-wrap">
              <table className="data-table compact live-month-detail">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th className="num">Target</th>
                    <th className="num">Actual</th>
                    <th className="num">Attainment</th>
                  </tr>
                </thead>
                <tbody>
                  {project.months.map((month) => {
                    const rate =
                      month.target > 0 ? month.actual / month.target : null;
                    return (
                      <tr key={month.label}>
                        <td>{month.label}</td>
                        <td className="num">{month.target}</td>
                        <td className="num">
                          {month.future ? '—' : month.actual}
                        </td>
                        <td className="num">
                          {month.future || rate === null
                            ? '—'
                            : pct(rate * 100, 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="drawer-section">
            <div className="section-row">
              <h3>Quarterly checkpoints</h3>
              <span className="section-count">
                {completedMilestones}/{milestones.length} met
              </span>
            </div>
            {milestones.length ? (
              <ul className="milestone-list">
                {milestones.map((milestone) => (
                  <li key={milestone.id} className="milestone-item">
                    <span
                      className="milestone-status-dot"
                      style={{
                        backgroundColor: MILESTONE_META[milestone.status].color,
                      }}
                    />
                    <div className="milestone-copy">
                      <span>{milestone.name}</span>
                      <small>
                        Due {formatDate(milestone.dueDate)} · target{' '}
                        {milestone.target} · actual {milestone.actual}
                      </small>
                    </div>
                    <span
                      className="milestone-status"
                      style={{
                        color: MILESTONE_META[milestone.status].color,
                        backgroundColor: MILESTONE_META[milestone.status].bg,
                      }}
                    >
                      {milestone.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="drawer-note">
                No quarterly checkpoints are set for this activity.
              </p>
            )}
          </section>

          <section className="drawer-section">
            <h3>Reporting progress</h3>
            {updates.length ? (
              <ol className="update-list">
                {updates.map((update) => (
                  <li key={update.id} className="update-item">
                    <span
                      className="update-marker"
                      style={{
                        backgroundColor: STATUS_META[update.status]?.chart,
                      }}
                    />
                    <div className="update-copy">
                      <div className="update-top">
                        <strong>{update.percent}%</strong>
                        <StatusPill status={update.status} compact />
                        <span className="muted">
                          {formatDate(update.date)}
                        </span>
                      </div>
                      <p>{update.remarks}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="drawer-note">
                No monthly accomplishment has been logged yet.
              </p>
            )}
          </section>

          <section className="drawer-section">
            <h3>Remarks</h3>
            <p className={project.remarks ? 'remarks' : 'remarks muted'}>
              {project.remarks ||
                'No remarks recorded. This activity appears in the Data Quality report.'}
            </p>
          </section>

          <section className="drawer-section">
            <h3>Means of verification</h3>
            <p className={project.mov ? 'remarks' : 'remarks muted'}>
              {project.mov ||
                'No means of verification recorded on the Main sheet. Check the unit sheet or supporting folder.'}
            </p>
          </section>

          {project.flags.length ? (
            <section className="drawer-section">
              <h3>Completeness flags</h3>
              <div className="live-flag-list">
                {project.flags.map((flag) => (
                  <span key={flag} className="live-flag-chip">
                    {flag}
                  </span>
                ))}
              </div>
            </section>
          ) : (
            <section className="drawer-section">
              <h3>Completeness</h3>
              <p className="drawer-note">
                <CheckCircle2 size={14} /> All reporting fields are complete.
              </p>
            </section>
          )}
        </div>

        <footer className="drawer-foot">
          <span>Read-only view of the shared workbook.</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}
