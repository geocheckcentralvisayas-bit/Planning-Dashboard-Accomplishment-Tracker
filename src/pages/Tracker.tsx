import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { useFilters } from '../state/FiltersContext';
import { attentionProjects } from '../lib/metrics';
import type { Project, Status } from '../types';
import { relativeDays } from '../lib/format';
import { STATUS_META } from '../lib/status';
import { StatusPill } from '../components/StatusPill';
import { ProgressBar } from '../components/ProgressBar';
import { FilterBar } from '../components/FilterBar';
import { EmptyState } from '../components/EmptyState';
import { downloadProjectsCsv } from '../lib/csv';

const PAGE_SIZE = 12;

type SortKey = 'name' | 'unit' | 'status' | 'percent' | 'target' | 'updated';

const STATUS_RANK: Record<Status, number> = {
  Delayed: 0,
  'At Risk': 1,
  'Not Started': 2,
  'On Track': 3,
  Completed: 4,
  'No Target': 5,
  Unplanned: 6,
};

interface TrackerProps {
  onSelectProject: (project: Project) => void;
}

export function Tracker({ onSelectProject }: TrackerProps) {
  const { filteredProjects, clearFilters } = useFilters();
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [filteredProjects]);

  const sorted = useMemo(() => {
    const list = [...filteredProjects];
    list.sort((a, b) => {
      let result = 0;
      switch (sortKey) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'unit':
          result = a.unit.localeCompare(b.unit);
          break;
        case 'status':
          result = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          break;
        case 'percent':
          result = a.percentComplete - b.percentComplete;
          break;
        case 'target':
          result = (a.ytdTarget ?? 0) - (b.ytdTarget ?? 0);
          break;
        case 'updated':
          result = a.lastUpdated.localeCompare(b.lastUpdated);
          break;
        default:
          result = 0;
      }
      return sortDirection === 'asc' ? result : -result;
    });
    return list;
  }, [filteredProjects, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  const rows = sorted.slice(start, start + PAGE_SIZE);
  const needsAttention = attentionProjects(filteredProjects).length;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return <ArrowUpDown size={13} />;
    return sortDirection === 'asc' ? (
      <ArrowUp size={13} />
    ) : (
      <ArrowDown size={13} />
    );
  };

  return (
    <div className="page">
      <FilterBar />

      <div className="tracker-toolbar">
        <p>
          <strong>{filteredProjects.length}</strong> activit
          {filteredProjects.length === 1 ? 'y' : 'ies'} in view
          {needsAttention > 0 ? (
            <span className="toolbar-alert">
              {' '}
              · {needsAttention} need attention
            </span>
          ) : null}
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => downloadProjectsCsv(sorted)}
        >
          <Download size={16} />
          Export filtered
        </button>
      </div>

      <section className="card tracker-card">
        <div className="table-wrap">
          <table className="data-table tracker-table">
            <thead>
              <tr>
                <th className="col-project">
                  <button
                    type="button"
                    className={`th-sort ${
                      sortKey === 'name' ? 'is-active' : ''
                    }`}
                    onClick={() => handleSort('name')}
                  >
                    Activity {sortIcon('name')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort ${
                      sortKey === 'unit' ? 'is-active' : ''
                    }`}
                    onClick={() => handleSort('unit')}
                  >
                    Unit {sortIcon('unit')}
                  </button>
                </th>
                <th className="col-lead">Focal</th>
                <th>
                  <button
                    type="button"
                    className={`th-sort ${
                      sortKey === 'status' ? 'is-active' : ''
                    }`}
                    onClick={() => handleSort('status')}
                  >
                    Status {sortIcon('status')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort ${
                      sortKey === 'percent' ? 'is-active' : ''
                    }`}
                    onClick={() => handleSort('percent')}
                  >
                    Attainment {sortIcon('percent')}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className={`th-sort ${
                      sortKey === 'target' ? 'is-active' : ''
                    }`}
                    onClick={() => handleSort('target')}
                  >
                    YTD target {sortIcon('target')}
                  </button>
                </th>
                <th className="num">YTD actual</th>
                <th>
                  <button
                    type="button"
                    className={`th-sort ${
                      sortKey === 'updated' ? 'is-active' : ''
                    }`}
                    onClick={() => handleSort('updated')}
                  >
                    Reported {sortIcon('updated')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => (
                <tr
                  key={project.id}
                  className="clickable-row"
                  onClick={() => onSelectProject(project)}
                >
                  <td>
                    <div className="project-cell">
                      <button
                        type="button"
                        className="project-name table-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectProject(project);
                        }}
                      >
                        {project.name}
                      </button>
                      <span className="project-sub">
                        <span className="mono">{project.id}</span> ·{' '}
                        {project.indicatorCount} indicator
                        {project.indicatorCount === 1 ? '' : 's'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="program-tag">{project.unit}</span>
                  </td>
                  <td className="col-lead">{project.lead || '—'}</td>
                  <td>
                    <StatusPill status={project.status} compact />
                  </td>
                  <td>
                    <div className="cell-progress">
                      <span>
                        {project.ytdRate === null
                          ? '—'
                          : `${Math.round(project.ytdRate * 100)}%`}
                      </span>
                      <ProgressBar
                        value={project.percentComplete}
                        color={STATUS_META[project.status]?.chart}
                      />
                    </div>
                  </td>
                  <td className="num">{project.ytdTarget}</td>
                  <td className="num">{project.ytdActual}</td>
                  <td>
                    <div className="cell-date">
                      <span>{project.lastReported}</span>
                      <small>
                        {project.lastReported === 'No accomplishment'
                          ? 'Not yet reported'
                          : relativeDays(project.lastUpdated)}
                      </small>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No matching activities"
            message="Try a different search term or relax the filters to see more of the workbook."
            action={
              <button
                type="button"
                className="btn btn-secondary"
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            }
          />
        ) : null}

        <footer className="table-foot">
          <span>
            Showing {rows.length ? start + 1 : 0}–{start + rows.length} of{' '}
            {sorted.length}
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
      </section>
    </div>
  );
}
