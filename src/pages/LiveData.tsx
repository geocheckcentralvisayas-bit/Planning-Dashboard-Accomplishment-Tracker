import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../live/live.css';
import { useWorkbook } from '../state/WorkbookContext';
import { STATUS_META } from '../lib/status';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileSpreadsheet,
  FileWarning,
  Layers,
  ListChecks,
  MessageSquareWarning,
  Radio,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { KpiCard } from '../components/KpiCard';
import { ProgressBar } from '../components/ProgressBar';
import type {
  LiveMeta,
  LiveMonthlyPoint,
  LiveRecord,
  LiveSection,
  LiveStatus,
} from '../live/types';

const PAGE_SIZE = 12;

type SortMode = 'attention' | 'section' | 'attainment' | 'target';

const STATUS_ORDER: Record<LiveStatus, number> = {
  Delayed: 0,
  'At Risk': 1,
  'Not Started': 2,
  'No Target': 3,
  Unplanned: 4,
  'On Track': 5,
  Completed: 6,
};

const STATUS_OPTIONS = Object.keys(STATUS_ORDER) as LiveStatus[];

const STATUS_STYLE = STATUS_META as Record<
  LiveStatus,
  { color: string; bg: string; border: string; chart: string }
>;

function formatCompact(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(absolute >= 10_000_000 ? 0 : 1)}M`;
  }
  if (absolute >= 10_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  if (!Number.isInteger(value)) {
    return value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-PH');
}

function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  const percent = rate * 100;
  if (percent >= 1000) {
    return `${Math.round(percent).toLocaleString('en-PH')}%`;
  }
  return `${Math.round(percent)}%`;
}

function formatFull(value: number): string {
  return value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function csvCell(value: string | number): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function downloadLiveCsv(records: LiveRecord[], meta: LiveMeta): void {
  const headers = [
    'Section',
    'Program / Project / Activity',
    'Indicator',
    'Focal',
    'Annual Target',
    'YTD Target',
    'YTD Actual',
    'YTD Attainment',
    'Annual Attainment',
    'Status',
    'Last Reported',
    'Remarks',
    'Means of Verification',
    'Data Flags',
    ...meta.monthLabels.flatMap((label) => [
      `${label} Target`,
      `${label} Actual`,
    ]),
  ];

  const rows = records.map((record) => [
    record.section,
    record.project,
    record.indicator,
    record.lead,
    record.annualTarget,
    record.ytdTarget,
    record.ytdActual,
    record.ytdRate === null ? '' : `${(record.ytdRate * 100).toFixed(1)}%`,
    record.annualRate === null
      ? ''
      : `${(record.annualRate * 100).toFixed(1)}%`,
    record.status,
    record.latestActualMonth,
    record.remarks,
    record.mov,
    record.flags.join('; '),
    ...record.targets.flatMap((target, index) => [
      target,
      record.actuals[index],
    ]),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  const blob = new Blob([`\ufeff${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `emb7-live-accomplishments-${meta.reportingYear}-${String(
    meta.reportingMonth,
  ).padStart(2, '0')}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function LiveStatusPill({ status, compact = true }: { status: LiveStatus; compact?: boolean }) {
  const meta = STATUS_STYLE[status];
  return (
    <span
      className={`status-pill ${compact ? 'status-pill-compact' : ''}`}
      style={{
        color: meta.color,
        backgroundColor: meta.bg,
        borderColor: meta.border,
      }}
    >
      <span className="status-dot" style={{ backgroundColor: meta.color }} />
      {status}
    </span>
  );
}

function SectionStatusMix({ item }: { item: LiveSection }) {
  const entries = [
    { tone: 'on', count: item.onTrack, label: 'on track' },
    { tone: 'risk', count: item.atRisk, label: 'at risk' },
    { tone: 'late', count: item.delayed, label: 'delayed' },
    { tone: 'done', count: item.completed, label: 'completed' },
  ].filter((entry) => entry.count > 0);

  if (!entries.length) {
    return <span className="muted">—</span>;
  }

  return (
    <div className="live-status-mix">
      {entries.map((entry) => (
        <span
          key={entry.tone}
          className={`live-mix ${entry.tone}`}
          title={`${entry.count} ${entry.label}`}
        >
          <i />
          {entry.count}
        </span>
      ))}
    </div>
  );
}

function LiveDetailDrawer({
  record,
  meta,
  onClose,
}: {
  record: LiveRecord;
  meta: LiveMeta;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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
      if (previousFocus.current?.isConnected) {
        previousFocus.current.focus();
      }
    };
  }, [onClose]);

  return createPortal(
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        ref={drawerRef}
        tabIndex={-1}
        className="drawer live-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="drawer-head">
          <div className="drawer-heading">
            <span className="eyebrow">{record.section}</span>
            <h2 id="live-drawer-title">{record.indicator}</h2>
            <div className="drawer-meta-line">
              <span className="mono">{record.id}</span>
              <LiveStatusPill status={record.status} />
              <span className="muted">Source row {record.row}</span>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close indicator details"
          >
            <X size={20} />
          </button>
        </header>

        <div className="drawer-body">
          <div className="drawer-stats live-drawer-stats">
            <div>
              <span>YTD attainment</span>
              <strong>{formatRate(record.ytdRate)}</strong>
              <ProgressBar
                value={(record.ytdRate ?? 0) * 100}
                color={STATUS_STYLE[record.status].chart}
              />
            </div>
            <div>
              <span>Annual target</span>
              <strong>{formatCompact(record.annualTarget)}</strong>
              <small title={formatFull(record.annualTarget)}>
                YTD target {formatCompact(record.ytdTarget)}
              </small>
            </div>
            <div>
              <span>Annual actual</span>
              <strong>{formatCompact(record.annualActual)}</strong>
              <small title={formatFull(record.annualActual)}>
                YTD actual {formatCompact(record.ytdActual)}
              </small>
            </div>
          </div>

          <section className="drawer-section">
            <h3>Indicator details</h3>
            <dl className="detail-grid">
              <div>
                <dt>
                  <Building2 size={14} /> Section / unit
                </dt>
                <dd>{record.section}</dd>
              </div>
              <div>
                <dt>
                  <UserRound size={14} /> Focal staff
                </dt>
                <dd>{record.lead || 'Not listed'}</dd>
              </div>
              <div>
                <dt>
                  <Layers size={14} /> Program / project
                </dt>
                <dd>{record.project || 'General indicator'}</dd>
              </div>
              <div>
                <dt>
                  <CalendarRange size={14} /> Reporting period
                </dt>
                <dd>{meta.reportingLabel}</dd>
              </div>
              <div>
                <dt>
                  <Clock3 size={14} /> Latest reported
                </dt>
                <dd>{record.latestActualMonth}</dd>
              </div>
              <div>
                <dt>
                  <FileSpreadsheet size={14} /> Source
                </dt>
                <dd>
                  {meta.sourceSheet} · row {record.row}
                </dd>
              </div>
            </dl>
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
                  {meta.monthLabels.map((label, index) => {
                    const target = record.targets[index];
                    const actual = record.actuals[index];
                    const future = index > meta.reportingIndex;
                    const rate = target > 0 ? actual / target : null;
                    return (
                      <tr
                        key={label}
                        className={
                          index === meta.reportingIndex
                            ? 'is-current-month'
                            : future
                              ? 'is-future-month'
                              : undefined
                        }
                      >
                        <td>
                          {label}
                          {index === meta.reportingIndex ? (
                            <span className="live-current-tag">Reported</span>
                          ) : null}
                        </td>
                        <td className="num">{formatCompact(target)}</td>
                        <td className="num">{future ? '—' : formatCompact(actual)}</td>
                        <td className="num">
                          {future || rate === null ? '—' : formatRate(rate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="drawer-section">
            <h3>Remarks</h3>
            <p className={record.remarks ? 'remarks' : 'remarks muted'}>
              {record.remarks ||
                'No remarks are recorded in the consolidated Main sheet for this indicator.'}
            </p>
          </section>

          <section className="drawer-section">
            <h3>Means of verification</h3>
            <p className={record.mov ? 'remarks' : 'remarks muted'}>
              {record.mov ||
                'No means of verification is recorded in the consolidated Main sheet. Check the section sheet or supporting folder.'}
            </p>
          </section>

          {record.flags.length ? (
            <section className="drawer-section">
              <h3>Completeness flags</h3>
              <div className="live-flag-list">
                {record.flags.map((flag) => (
                  <span key={flag} className="live-flag-chip">
                    <AlertTriangle size={11} />
                    {flag}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer className="drawer-foot">
          <span>
            Read-only workbook snapshot · {meta.sourceFile}
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export function LiveData() {
  const {
    records,
    sections,
    monthly,
    meta,
    status: loadStatus,
    error,
    refresh,
    refreshing,
  } = useWorkbook();
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [status, setStatus] = useState('');
  const [issueOnly, setIssueOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('attention');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<LiveRecord | null>(null);
  const [monthFocus, setMonthFocus] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const trackerRef = useRef<HTMLElement>(null);
  const monthCardRef = useRef<HTMLElement>(null);
  const monthTipRef = useRef<HTMLDivElement>(null);
  const [monthTip, setMonthTip] = useState<{
    x: number;
    y: number;
    title: string;
    rows: { label: string; value: string; color?: string }[];
  } | null>(null);

  useEffect(() => {
    setPage(0);
  }, [search, section, status, issueOnly, sortMode]);

  const sectionOptions = useMemo(() => {
    return sections.map((item) => item.section).sort((a, b) => a.localeCompare(b));
  }, [sections]);

  const filtered = useMemo(() => {
    if (!meta) return [];
    const term = search.trim().toLowerCase();
    const monthIndex = monthFocus
      ? (meta?.monthLabels.indexOf(monthFocus) ?? -1)
      : -1;
    const list = records.filter((record) => {
      if (section && record.section !== section) return false;
      if (status && record.status !== status) return false;
      if (issueOnly && record.flags.length === 0) return false;
      if (monthIndex >= 0) {
        // Keep only indicators that carried a target or an actual in the
        // focused month, so the tracker matches the chart selection.
        const target = record.targets[monthIndex] ?? 0;
        const actual = record.actuals[monthIndex] ?? 0;
        if (target <= 0.0001 && actual <= 0.0001) return false;
      }
      if (!term) return true;
      return [
        record.section,
        record.project,
        record.indicator,
        record.lead,
        record.remarks,
        record.mov,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });

    list.sort((a, b) => {
      switch (sortMode) {
        case 'section':
          return (
            a.section.localeCompare(b.section) ||
            a.indicator.localeCompare(b.indicator)
          );
        case 'attainment': {
          const left = a.ytdRate ?? -1;
          const right = b.ytdRate ?? -1;
          return right - left || a.section.localeCompare(b.section);
        }
        case 'target':
          return b.annualTarget - a.annualTarget;
        case 'attention':
        default:
          return (
            STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
            a.section.localeCompare(b.section) ||
            a.indicator.localeCompare(b.indicator)
          );
      }
    });

    return list;
  }, [records, meta, search, section, status, issueOnly, sortMode, monthFocus]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const pageRows = filtered.slice(start, start + PAGE_SIZE);

  if (loadStatus === 'loading') {
    return (
      <div className="page live-page">
        <section className="card live-loading">
          <div className="live-loading-mark">
            <RefreshCw size={20} className="spin" />
          </div>
          <div>
            <h2>Loading the live workbook snapshot</h2>
            <p>Reading the generated accomplishment dataset…</p>
          </div>
        </section>
      </div>
    );
  }

  if (loadStatus === 'error' || !meta) {
    return (
      <div className="page live-page">
        <section className="card live-error">
          <div className="live-error-icon">
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2>The live snapshot is unavailable</h2>
            <p>{error || 'No live data file was found.'}</p>
            <div className="live-error-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
                <RefreshCw size={16} />
                Try again
              </button>
              <code>npm run sync:live</code>
            </div>
            <p className="live-footnote">
              The browser reads <code>public/live-data.json</code>. Generate it from
              the shared workbook, then reload this page.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const counts = meta.statusCounts;
  const onTrackOrComplete =
    (counts['On Track'] ?? 0) + (counts.Completed ?? 0);
  const attention = (counts['At Risk'] ?? 0) + (counts.Delayed ?? 0);
  const unstarted = (counts['Not Started'] ?? 0) + (counts['No Target'] ?? 0);
  const deliveryRate = meta.recordCount
    ? Math.round((onTrackOrComplete / meta.recordCount) * 100)
    : 0;
  const reportedMonths = monthly.filter((month) => !month.isFuture);

  const selectSection = (name: string) => {
    setSection((previous) => (previous === name ? '' : name));
    setPage(0);
    window.setTimeout(() => {
      trackerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const showMonthTip = (
    event: { clientX: number; clientY: number },
    month: LiveMonthlyPoint,
    meta: LiveMeta,
  ) => {
    const card = monthCardRef.current;
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    setMonthTip({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      title: `${month.label} ${meta.reportingYear}`,
      rows: [
        {
          label: 'Target met',
          value:
            month.metRate === null
              ? '—'
              : `${Math.round(month.metRate * 100)}%`,
          color: month.isReportingMonth ? '#cc9424' : '#14a557',
        },
        { label: 'Met', value: String(month.met) },
        { label: 'Assessed', value: String(month.assessed) },
        {
          label: 'Median rate',
          value:
            month.medianRate === null
              ? '—'
              : `${Math.round(month.medianRate * 100)}%`,
        },
      ],
    });
  };

  const hideMonthTip = () => setMonthTip(null);

  return (
    <div className="page live-page">
      <section className="live-source">
        <div className="live-source-main">
          <div className="live-source-kicker">
            <span className="prototype-badge live-badge">
              <Radio size={11} />
              Live workbook
            </span>
            <span className="live-source-sheet">{meta.sourceSheet}</span>
          </div>
          <h2>2026 Accomplishment Report</h2>
          <p>
            {meta.recordCount} activity-level indicators across {meta.sectionCount}{' '}
            sections/units. Reporting through <strong>{meta.reportingLabel}</strong>.
          </p>
        </div>
        <div className="live-source-side">
          <div className="live-source-dates">
            <div>
              <span>Workbook updated</span>
              <strong>{formatTimestamp(meta.workbookModifiedAt)}</strong>
            </div>
            <div>
              <span>Snapshot generated</span>
              <strong>{formatTimestamp(meta.generatedAt)}</strong>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary live-refresh-btn"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Reloading…' : 'Reload snapshot'}
          </button>
        </div>
        <div className="live-source-foot">
          <span>
            <FileSpreadsheet size={13} />
            {meta.sourceFile}
          </span>
          <span>
            Read-only snapshot. Run <code>npm run sync:live</code> to pull the latest
            Excel changes, then reload.
          </span>
        </div>
      </section>

      {error ? (
        <div className="live-inline-alert" role="status">
          <AlertTriangle size={15} />
          {error}
        </div>
      ) : null}

      <div className="kpi-grid">
        <KpiCard
          icon={<Layers size={19} />}
          label="Sections / units"
          value={String(meta.sectionCount)}
          sub="Reporting groups in the consolidated sheet"
          tone="green"
        />
        <KpiCard
          icon={<ListChecks size={19} />}
          label="Indicators"
          value={String(meta.recordCount)}
          sub="Activity-level target lines"
          tone="teal"
        />
        <KpiCard
          icon={<TrendingUp size={19} />}
          label="On track or complete"
          value={String(onTrackOrComplete)}
          sub={`${deliveryRate}% of indicators`}
          tone="green"
        />
        <KpiCard
          icon={<AlertTriangle size={19} />}
          label="Needs attention"
          value={String(attention)}
          sub={`${counts['At Risk'] ?? 0} at risk · ${counts.Delayed ?? 0} delayed`}
          tone="amber"
        />
        <KpiCard
          icon={<CheckCircle2 size={19} />}
          label="Annual target met"
          value={String(counts.Completed ?? 0)}
          sub="Completed as of the reporting month"
          tone="teal"
        />
        <KpiCard
          icon={<Clock3 size={19} />}
          label="Not started / no target"
          value={String(unstarted)}
          sub={`${counts['Not Started'] ?? 0} future · ${counts['No Target'] ?? 0} no target`}
          tone="slate"
        />
      </div>

      <div className="grid-12">
        <section className="card span-7 live-section-card">
          <header className="card-head">
            <div>
              <h2>Section performance</h2>
              <p>Median YTD attainment by section/unit. Click a section to filter the tracker.</p>
            </div>
            <span className="card-badge">
              {meta.sectionCount} sections
            </span>
          </header>
          <div className="table-wrap">
            <table className="data-table compact live-section-table">
              <thead>
                <tr>
                  <th>Section / unit</th>
                  <th className="num">Indicators</th>
                  <th>Median YTD</th>
                  <th>Status mix</th>
                  <th className="live-lead-col">Focal</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((item) => (
                  <tr
                    key={item.section}
                    className={section === item.section ? 'is-selected' : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        className="table-link"
                        onClick={() => selectSection(item.section)}
                      >
                        {item.section}
                      </button>
                    </td>
                    <td className="num">{item.activities}</td>
                    <td>
                      <div className="live-rate-cell">
                        <span>{formatRate(item.medianRate)}</span>
                        <ProgressBar
                          value={(item.medianRate ?? 0) * 100}
                          color={
                            (item.medianRate ?? 0) >= 0.9
                              ? STATUS_STYLE['On Track'].chart
                              : (item.medianRate ?? 0) >= 0.7
                                ? STATUS_STYLE['At Risk'].chart
                                : STATUS_STYLE.Delayed.chart
                          }
                        />
                      </div>
                    </td>
                    <td>
                      <SectionStatusMix item={item} />
                    </td>
                    <td className="live-lead-col muted" title={item.lead}>
                      {item.lead || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="live-section-legend">
            <span>
              <i className="on" /> On track
            </span>
            <span>
              <i className="risk" /> At risk
            </span>
            <span>
              <i className="late" /> Delayed
            </span>
            <span>
              <i className="done" /> Completed
            </span>
          </div>
        </section>

        <section className="card span-5 live-month-card" ref={monthCardRef}>
          <header className="card-head">
            <div>
              <h2>Monthly delivery</h2>
              <p>Share of assessed indicators that met their monthly target.</p>
            </div>
            <span className="card-badge">Jan–Sep 2026</span>
          </header>
          <div
            className="live-month-chart"
            role="img"
            aria-label="Monthly target-met rates from January to September 2026"
          >
            {reportedMonths.map((month) => (
              <div
                key={month.label}
                className={`live-month-column ${
                  month.isReportingMonth ? 'is-current' : ''
                } ${monthFocus === month.label ? 'is-focused' : ''} ${
                  hoveredMonth && hoveredMonth !== month.label
                    ? 'is-dimmed'
                    : ''
                }`}
                tabIndex={0}
                role="button"
                aria-label={`${month.label}: ${
                  month.metRate === null
                    ? 'no assessed indicators'
                    : `${Math.round(
                        month.metRate * 100,
                      )} percent of ${month.assessed} indicators met target`
                }`}
                onMouseEnter={(event) => {
                  setHoveredMonth(month.label);
                  showMonthTip(event, month, meta);
                }}
                onMouseMove={(event) => showMonthTip(event, month, meta)}
                onMouseLeave={() => {
                  setHoveredMonth(null);
                  hideMonthTip();
                }}
                onFocus={() => setHoveredMonth(month.label)}
                onBlur={() => setHoveredMonth(null)}
                onClick={() =>
                  setMonthFocus(
                    monthFocus === month.label ? null : month.label,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setMonthFocus(
                      monthFocus === month.label ? null : month.label,
                    );
                  }
                }}
              >
                <span className="live-month-value">
                  {month.metRate === null
                    ? '—'
                    : `${Math.round(month.metRate * 100)}%`}
                </span>
                <div className="live-month-track">
                  <span
                    style={{
                      height: `${Math.max(4, (month.metRate ?? 0) * 100)}%`,
                    }}
                  />
                </div>
                <span className="live-month-label">{month.label}</span>
                <span className="live-month-count">
                  {month.met}/{month.assessed}
                </span>
              </div>
            ))}
          </div>
          <p className="live-chart-note">
            <strong>{meta.reportingLabel}</strong> is the latest reported month in the
            workbook. Monthly rates use only indicators with a target in that month.
          </p>
          {monthTip ? (
            <div
              className="chart-tip"
              role="tooltip"
              ref={monthTipRef}
              style={{
                left: monthTip.x,
                top: Math.min(
                  Math.max(monthTip.y, 56),
                  (monthCardRef.current?.clientHeight ?? 0) - 24,
                ),
                transform: `translate(${
                  monthTip.x > (monthCardRef.current?.clientWidth ?? 0) - 170
                    ? 'calc(-100% - 14px)'
                    : '14px'
                }, -50%)`,
              }}
            >
              <p className="chart-tip-title">{monthTip.title}</p>
              <div className="chart-tip-rows">
                {monthTip.rows.map((row) => (
                  <div className="chart-tip-row" key={row.label}>
                    <span className="chart-tip-key">
                      {row.color ? <i style={{ backgroundColor: row.color }} /> : null}
                      {row.label}
                    </span>
                    <span className="chart-tip-value">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="card live-quality-card">
        <header className="card-head">
          <div>
            <h2>Consolidated-sheet completeness</h2>
            <p>
              Checks on the <code>Main (for CO)</code> sheet only. Section sheets may
              contain the supporting evidence.
            </p>
          </div>
          <span className="card-badge">
            <FileWarning size={13} />
            Read-only checks
          </span>
        </header>
        <div className="live-quality-grid">
          <div className="live-quality-item">
            <span className="live-quality-icon amber">
              <FileWarning size={16} />
            </span>
            <div>
              <strong>{meta.dataQuality.missingMov}</strong>
              <span>Missing MOV</span>
              <small>No means of verification in the Main sheet</small>
            </div>
          </div>
          <div className="live-quality-item">
            <span className="live-quality-icon slate">
              <MessageSquareWarning size={16} />
            </span>
            <div>
              <strong>{meta.dataQuality.missingRemarks}</strong>
              <span>Missing remarks</span>
              <small>No status narrative recorded in the Main sheet</small>
            </div>
          </div>
          <div className="live-quality-item">
            <span className="live-quality-icon red">
              <Target size={16} />
            </span>
            <div>
              <strong>{meta.dataQuality.noTarget}</strong>
              <span>No target</span>
              <small>Indicators without an annual target</small>
            </div>
          </div>
          <div className="live-quality-item">
            <span className="live-quality-icon teal">
              <ListChecks size={16} />
            </span>
            <div>
              <strong>{meta.dataQuality.noAccomplishment}</strong>
              <span>No accomplishment</span>
              <small>Targets exist, but no actual is recorded</small>
            </div>
          </div>
        </div>
        <p className="live-footnote">
          These are completeness signals, not judgments on performance. The shared
          workbook uses “0” as a placeholder in several narrative columns.
        </p>
      </section>

      <section className="card live-tracker-card" ref={trackerRef} id="live-tracker">
        <header className="card-head live-tracker-head">
          <div>
            <h2>Live indicator tracker</h2>
            <p>
              {filtered.length === records.length
                ? `All ${records.length} indicators`
                : `${filtered.length} of ${records.length} indicators`}{' '}
              from {meta.reportingLabel}
            </p>
          </div>
          <div className="live-tracker-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => downloadLiveCsv(filtered, meta)}
            >
              <Download size={15} />
              Export filtered
            </button>
          </div>
        </header>

        <div className="live-toolbar">
          <label className="live-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search activities, indicators, focals…"
              aria-label="Search live indicators"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Clear live search"
              >
                <X size={13} />
              </button>
            ) : null}
          </label>

          <label className="live-select">
            <span>Section</span>
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
            >
              <option value="">All sections</option>
              {sectionOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="live-select">
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="live-select live-sort">
            <span>Sort by</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="attention">Needs attention</option>
              <option value="section">Section</option>
              <option value="attainment">Attainment</option>
              <option value="target">Annual target</option>
            </select>
          </label>

          <label className="live-check">
            <input
              type="checkbox"
              checked={issueOnly}
              onChange={(event) => setIssueOnly(event.target.checked)}
            />
            <span>Data flags only</span>
          </label>

          {monthFocus ? (
            <button
              type="button"
              className="live-month-chip"
              onClick={() => setMonthFocus(null)}
              title="Clear the month selected from the monthly delivery chart"
            >
              <CalendarRange size={13} />
              {monthFocus} {meta.reportingYear}
              <X size={12} />
            </button>
          ) : null}

          {search || section || status || issueOnly || monthFocus ? (
            <button
              type="button"
              className="btn btn-ghost live-clear"
              onClick={() => {
                setSearch('');
                setSection('');
                setStatus('');
                setIssueOnly(false);
                setMonthFocus(null);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="table-wrap">
          <table className="data-table live-table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Activity / indicator</th>
                <th className="num">Annual target</th>
                <th className="num">YTD target</th>
                <th className="num">YTD actual</th>
                <th>YTD attainment</th>
                <th>Status</th>
                <th>Latest report</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((record) => (
                <tr
                  key={record.id}
                  className="clickable-row"
                  onClick={() => setSelected(record)}
                >
                  <td>
                    <span className="program-tag">{record.section}</span>
                  </td>
                  <td>
                    <div className="project-cell live-indicator-cell">
                      <button
                        type="button"
                        className="project-name table-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(record);
                        }}
                      >
                        {record.indicator}
                      </button>
                      <span className="project-sub">
                        {record.project || 'General indicator'}
                        {record.lead ? ` · ${record.lead}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="num" title={formatFull(record.annualTarget)}>
                    {formatCompact(record.annualTarget)}
                  </td>
                  <td className="num" title={formatFull(record.ytdTarget)}>
                    {formatCompact(record.ytdTarget)}
                  </td>
                  <td className="num" title={formatFull(record.ytdActual)}>
                    {formatCompact(record.ytdActual)}
                  </td>
                  <td>
                    <div className="cell-progress live-attainment-cell">
                      <span>{formatRate(record.ytdRate)}</span>
                      <ProgressBar
                        value={(record.ytdRate ?? 0) * 100}
                        color={STATUS_STYLE[record.status].chart}
                      />
                    </div>
                  </td>
                  <td>
                    <LiveStatusPill status={record.status} />
                  </td>
                  <td>
                    <div className="cell-date">
                      <span>{record.latestActualMonth}</span>
                      {record.flags.length ? (
                        <small className="live-flag-note">
                          <AlertTriangle size={10} />
                          {record.flags.length} flag
                          {record.flags.length === 1 ? '' : 's'}
                        </small>
                      ) : (
                        <small>No flags</small>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pageRows.length === 0 ? (
          <EmptyState
            title="No matching indicators"
            message="Try a different search term or clear the section, status, or data-flag filters."
            action={
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setSearch('');
                  setSection('');
                  setStatus('');
                  setIssueOnly(false);
                }}
              >
                Clear all filters
              </button>
            }
          />
        ) : (
          <footer className="table-foot">
            <span>
              Showing {filtered.length ? start + 1 : 0}–{start + pageRows.length} of{' '}
              {filtered.length} indicators
            </span>
            <div className="pager">
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 0}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span>
                Page {currentPage + 1} of {pageCount}
              </span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage >= pageCount - 1}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        )}
      </section>

      <p className="live-footnote live-page-footnote">
        Source: {meta.sourceFile} · {meta.sourceSheet}. Read-only snapshot generated{' '}
        {formatTimestamp(meta.generatedAt)}. {meta.focalNote}
      </p>

      {selected ? (
        <LiveDetailDrawer
          record={selected}
          meta={meta}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
