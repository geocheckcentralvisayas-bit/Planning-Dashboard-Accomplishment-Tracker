import {
  CalendarRange,
  Download,
  FileSpreadsheet,
  FolderKanban,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { PageId } from '../types';
import { APP_VERSION } from '../data/meta';
import { useFilters } from '../state/FiltersContext';
import { useWorkbook } from '../state/WorkbookContext';
import { downloadProjectsCsv } from '../lib/csv';
import { DenrLogo } from './DenrLogo';
import type { AuthUser } from '../lib/auth';

export const PAGE_META: Record<PageId, { title: string; subtitle: string }> = {
  live: {
    title: 'Live Accomplishment Dashboard',
    subtitle: 'Indicator-level targets and accomplishments from the shared workbook',
  },
  overview: {
    title: 'Executive Overview',
    subtitle: 'Portfolio health, unit performance, and monthly attainment',
  },
  tracker: {
    title: 'Activity Tracker',
    subtitle: 'Search and inspect every activity group in the 2026 workbook',
  },
  timeline: {
    title: 'Reporting Schedule',
    subtitle: 'The 2026 workbook year with quarterly target checkpoints',
  },
  quality: {
    title: 'Data Quality',
    subtitle: 'Completeness, coverage, attainment, and checkpoint timeliness',
  },
  about: {
    title: 'About This Dashboard',
    subtitle: 'What the dashboard reads and how to keep it live',
  },
};

const NAV = [
  {
    id: 'live',
    label: 'Live Accomplishments',
    description: 'Workbook snapshot',
    icon: FileSpreadsheet,
  },
  {
    id: 'overview',
    label: 'Overview',
    description: 'Portfolio health',
    icon: LayoutDashboard,
  },
  {
    id: 'tracker',
    label: 'Activity Tracker',
    description: 'All activities',
    icon: FolderKanban,
  },
  {
    id: 'timeline',
    label: 'Reporting Schedule',
    description: 'Quarterly checkpoints',
    icon: CalendarRange,
  },
  {
    id: 'quality',
    label: 'Data Quality',
    description: 'Completeness checks',
    icon: ShieldCheck,
  },
  {
    id: 'about',
    label: 'About',
    description: 'Data and refresh',
    icon: Info,
  },
] as const;

interface SidebarProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  page,
  onNavigate,
  mobileOpen,
  onClose,
}: SidebarProps) {
  const { meta } = useWorkbook();
  const reportingLabel = meta?.reportingLabel ?? '—';

  return (
    <>
      <div
        className={`sidebar-scrim ${mobileOpen ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`sidebar ${mobileOpen ? 'is-open' : ''}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <DenrLogo size="md" className="brand-logo" />
          <div className="brand-copy">
            <span className="brand-name">EMB Region 7</span>
            <span className="brand-sub">Planning Command Center</span>
          </div>
          <button
            type="button"
            className="icon-btn sidebar-close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="nav-label">Workspace</div>
        <nav className="nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${page === item.id ? 'is-active' : ''}`}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                aria-current={page === item.id ? 'page' : undefined}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span className="nav-text">
                  <span className="nav-label-text">{item.label}</span>
                  <span className="nav-desc">{item.description}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-card">
            <span className="sidebar-card-label">Reporting period</span>
            <span className="sidebar-card-value">
              {reportingLabel}
            </span>
            <span className="sidebar-card-note">
              Shared workbook · {APP_VERSION}
            </span>
          </div>
          <p className="sidebar-copy">
            Environmental Management Bureau
            <br />
            Region 7 · Philippines
          </p>
        </div>
      </aside>
    </>
  );
}

interface TopbarProps {
  page: PageId;
  user: AuthUser;
  onMenu: () => void;
  onSignOut: () => void;
}

export function Topbar({ page, user, onMenu, onSignOut }: TopbarProps) {
  const { filters, setFilter, filteredProjects } = useFilters();
  const { meta: workbookMeta } = useWorkbook();
  const meta = PAGE_META[page];
  const reportingLabel = workbookMeta?.reportingLabel ?? '—';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-btn menu-btn"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div className="topbar-title">
          <div className="topbar-heading">
            <h1>{meta.title}</h1>
            <span className="prototype-badge live-badge">
              <FileSpreadsheet size={11} />
              Live workbook
            </span>
          </div>
          <p>{meta.subtitle}</p>
        </div>
      </div>

      <div className="topbar-right">
        {page !== 'live' ? (
          <>
            <div className="search-box">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilter('search', event.target.value)}
                placeholder="Search activities, units, focals…"
                aria-label="Search activities"
              />
              {filters.search ? (
                <button
                  type="button"
                  onClick={() => setFilter('search', '')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              className="btn btn-secondary export-btn"
              onClick={() => downloadProjectsCsv(filteredProjects, reportingLabel)}
              aria-label="Export activities as CSV"
            >
              <Download size={16} />
              <span>Export</span>
            </button>
          </>
        ) : (
          <div className="live-topbar-chip">
            <FileSpreadsheet size={14} />
            <span>Workbook snapshot</span>
          </div>
        )}

        <div
          className="sync-pill"
          title="Reporting period recorded in the shared workbook"
        >
          <span className="sync-dot" />
          Reporting through {reportingLabel}
        </div>

        <div className="avatar" title={`${user.displayName} · ${user.roleLabel}`}>
          <span className="avatar-chip">{user.initials}</span>
          <span className="avatar-copy">
            <span className="avatar-name">{user.displayName}</span>
            <span className="avatar-role">{user.roleLabel}</span>
          </span>
        </div>

        <button
          type="button"
          className="icon-btn topbar-signout"
          onClick={onSignOut}
          title={`Sign out ${user.displayName}`}
          aria-label={`Sign out ${user.displayName}`}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
