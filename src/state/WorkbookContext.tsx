import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loadLivePayload } from '../live/api';
import { setReportingAsOf } from '../lib/format';
import type {
  LiveMeta,
  LiveMonthlyPoint,
  LivePayload,
  LiveRecord,
  LiveSection,
} from '../live/types';
import type { Project } from '../types';

interface WorkbookValue {
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  meta: LiveMeta | null;
  records: LiveRecord[];
  sections: LiveSection[];
  monthly: LiveMonthlyPoint[];
  /** The real activity groups from the workbook. */
  projects: Project[];
  units: string[];
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const WorkbookContext = createContext<WorkbookValue | null>(null);

const EMPTY_PROJECTS: Project[] = [];

export function WorkbookProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [status, setStatus] = useState<WorkbookValue['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await loadLivePayload();
      setPayload(next);
      setError(null);
      setStatus('ready');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The live workbook snapshot could not be loaded.',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const value = useMemo<WorkbookValue>(() => {
    const raw = (payload as unknown as { projects?: Project[] } | null)?.projects;
    if (payload?.meta) {
      const month = String(payload.meta.reportingMonth).padStart(2, '0');
      setReportingAsOf(`${payload.meta.reportingYear}-${month}-28`);
    }
    return {
      status,
      error,
      meta: payload?.meta ?? null,
      records: payload?.records ?? [],
      sections: payload?.sections ?? [],
      monthly: payload?.monthly ?? [],
      projects: Array.isArray(raw) ? raw : EMPTY_PROJECTS,
      units:
        (payload as unknown as { units?: string[] } | null)?.units ?? [],
      refreshing,
      refresh,
    };
  }, [payload, status, error, refresh, refreshing]);

  return (
    <WorkbookContext.Provider value={value}>
      {children}
    </WorkbookContext.Provider>
  );
}

export function useWorkbook(): WorkbookValue {
  const context = useContext(WorkbookContext);
  if (!context) {
    throw new Error('useWorkbook must be used inside WorkbookProvider');
  }
  return context;
}

/** Convenience hook for pages that only need the real project portfolio. */
export function useProjects(): Project[] {
  return useWorkbook().projects;
}
