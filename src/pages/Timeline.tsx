import { CalendarRange } from 'lucide-react';
import { useFilters } from '../state/FiltersContext';
import { useWorkbook } from '../state/WorkbookContext';
import { allMilestones, summarize } from '../lib/metrics';
import type { Project } from '../types';
import { FilterBar } from '../components/FilterBar';
import { GanttChart } from '../components/charts/GanttChart';

interface TimelineProps {
  onSelectProject: (project: Project) => void;
}

export function Timeline({ onSelectProject }: TimelineProps) {
  const { filteredProjects } = useFilters();
  const { meta } = useWorkbook();
  const summary = summarize(filteredProjects);
  const milestones = allMilestones(filteredProjects);
  const metCheckpoints = milestones.filter(
    (entry) => entry.milestone.status === 'Completed',
  ).length;

  const asOf = meta
    ? `${meta.reportingYear}-${String(meta.reportingMonth).padStart(2, '0')}-28`
    : new Date().toISOString().slice(0, 10);

  return (
    <div className="page">
      <FilterBar />

      <div className="timeline-stats">
        <div>
          <span>Activities</span>
          <strong>{summary.total}</strong>
        </div>
        <div>
          <span>Units</span>
          <strong>{summary.units}</strong>
        </div>
        <div>
          <span>Quarterly checkpoints</span>
          <strong>{milestones.length}</strong>
        </div>
        <div>
          <span>Checkpoints met</span>
          <strong>{metCheckpoints}</strong>
        </div>
        <div>
          <span>Reporting period</span>
          <strong className="timeline-date">
            {meta?.reportingLabel ?? '—'}
          </strong>
        </div>
      </div>

      <section className="card gantt-card">
        <header className="card-head">
          <div>
            <h2>Reporting schedule</h2>
            <p>
              Every activity runs the 2026 workbook year. Diamonds mark the
              quarterly target checkpoints; select a row for the full record.
            </p>
          </div>
          <span className="card-badge">
            <CalendarRange size={14} />
            {summary.total}
          </span>
        </header>
        <GanttChart
          projects={filteredProjects}
          asOf={asOf}
          onSelect={onSelectProject}
        />
      </section>
    </div>
  );
}
