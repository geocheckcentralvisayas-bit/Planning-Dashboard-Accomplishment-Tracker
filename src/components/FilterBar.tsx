import { SlidersHorizontal, X } from 'lucide-react';
import { RISK_LEVELS, STATUSES } from '../types';
import { useFilters } from '../state/FiltersContext';

export function FilterBar() {
  const {
    filters,
    setFilter,
    clearFilters,
    activeCount,
    filteredProjects,
    allProjects,
  } = useFilters();

  const units = [...new Set(allProjects.map((project) => project.unit))].sort(
    (a, b) => a.localeCompare(b),
  );
  const statuses = STATUSES.filter((status) =>
    allProjects.some((project) => project.status === status),
  );
  const risks = RISK_LEVELS.filter((risk) =>
    allProjects.some((project) => project.risk === risk),
  );

  return (
    <section className="filter-bar" aria-label="Portfolio filters">
      <div className="filter-heading">
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>Filters</span>
        {activeCount > 0 ? (
          <span className="filter-count">{activeCount}</span>
        ) : null}
        <span className="filter-result">
          {filteredProjects.length} of {allProjects.length} activit
          {allProjects.length === 1 ? 'y' : 'ies'}
        </span>
      </div>

      <div className="filter-controls">
        <label className="field">
          <span>Unit</span>
          <select
            value={filters.program}
            onChange={(event) => setFilter('program', event.target.value)}
          >
            <option value="">All units</option>
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select
            value={filters.status}
            onChange={(event) => setFilter('status', event.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Risk</span>
          <select
            value={filters.risk}
            onChange={(event) => setFilter('risk', event.target.value)}
          >
            <option value="">All risk levels</option>
            {risks.map((risk) => (
              <option key={risk} value={risk}>
                {risk}
              </option>
            ))}
          </select>
        </label>

        {activeCount > 0 ? (
          <button
            type="button"
            className="btn btn-ghost clear-filters"
            onClick={clearFilters}
          >
            <X size={14} />
            Clear all
          </button>
        ) : null}
      </div>
    </section>
  );
}
