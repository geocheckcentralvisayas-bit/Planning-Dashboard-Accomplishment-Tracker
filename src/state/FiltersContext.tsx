import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useWorkbook } from './WorkbookContext';
import {
  activeFilterCount,
  applyFilters,
  EMPTY_FILTERS,
} from '../lib/metrics';
import type { Filters, Project } from '../types';

interface FiltersContextValue {
  filters: Filters;
  setFilter: (key: keyof Filters, value: string) => void;
  clearFilters: () => void;
  activeCount: number;
  filteredProjects: Project[];
  /** Every real project in the workbook snapshot. */
  allProjects: Project[];
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const { projects } = useWorkbook();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const filteredProjects = useMemo(
    () => applyFilters(projects, filters),
    [projects, filters],
  );

  const value = useMemo<FiltersContextValue>(
    () => ({
      filters,
      setFilter: (key, next) =>
        setFilters((previous) => ({ ...previous, [key]: next })),
      clearFilters: () => setFilters(EMPTY_FILTERS),
      activeCount: activeFilterCount(filters),
      filteredProjects,
      allProjects: projects,
    }),
    [filters, filteredProjects, projects],
  );

  return (
    <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
  );
}

export function useFilters(): FiltersContextValue {
  const context = useContext(FiltersContext);
  if (!context) {
    throw new Error('useFilters must be used inside FiltersProvider');
  }
  return context;
}
