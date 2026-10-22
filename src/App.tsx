import { useEffect, useState } from 'react';
import { FiltersProvider, useFilters } from './state/FiltersContext';
import { WorkbookProvider, useWorkbook } from './state/WorkbookContext';
import { Sidebar, Topbar } from './components/Layout';
import { ProjectDrawer } from './components/ProjectDrawer';
import { LoginGate } from './components/LoginGate';
import { LiveData } from './pages/LiveData';
import { Overview } from './pages/Overview';
import { Tracker } from './pages/Tracker';
import { Timeline } from './pages/Timeline';
import { DataQuality } from './pages/DataQuality';
import { About } from './pages/About';
import { clearSession, loadSession, type AuthUser } from './lib/auth';
import type { PageId, Project } from './types';

const PAGES: PageId[] = [
  'live',
  'overview',
  'tracker',
  'timeline',
  'quality',
  'about',
];

interface Route {
  page: PageId;
  projectId: string | null;
}

function routeFromHash(): Route {
  const [pagePart, projectId] = window.location.hash
    .replace(/^#\/?/, '')
    .split('/');
  const page = PAGES.includes(pagePart as PageId)
    ? (pagePart as PageId)
    : 'live';
  return { page, projectId: projectId || null };
}

function Dashboard({
  user,
  onSignOut,
}: {
  user: AuthUser;
  onSignOut: () => void;
}) {
  const [route, setRoute] = useState<Route>(routeFromHash);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { setFilter } = useFilters();
  const { meta, status, error, refresh, projects } = useWorkbook();

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route.page]);

  // The drawer project is resolved from the loaded workbook, so a deep link
  // such as #/tracker/PRG-014 opens the real activity.
  const selectedProject = route.projectId
    ? (projects.find((project) => project.id === route.projectId) ?? null)
    : null;

  const navigate = (next: PageId) => {
    setRoute({ page: next, projectId: null });
    if (window.location.hash !== `#/${next}`) {
      window.location.hash = `/${next}`;
    }
  };

  const openProject = (project: Project) => {
    setRoute({ page: route.page, projectId: project.id });
    window.location.hash = `/${route.page}/${project.id}`;
  };

  const closeProject = () => {
    setRoute({ page: route.page, projectId: null });
    window.location.hash = `/${route.page}`;
  };

  // Chart interactions hand off a status (and optionally a unit) and jump
  // straight to the tracker so the selected slice is immediately visible.
  const filterByStatus = (status: string) => {
    setFilter('status', status);
    navigate('tracker');
  };

  const filterByProgramStatus = (status: string, unit: string) => {
    setFilter('status', status);
    setFilter('program', unit);
    navigate('tracker');
  };

  const asOf = meta
    ? `${meta.reportingYear}-${String(meta.reportingMonth).padStart(2, '0')}-28`
    : new Date().toISOString().slice(0, 10);

  if (status === 'loading') {
    return (
      <div className="boot-screen">
        <div className="live-loading-mark">
          <div className="spin-ring" />
        </div>
        <p>Reading the shared workbook snapshot…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="boot-screen">
        <div className="live-error-icon">!</div>
        <p>{error}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void refresh()}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <div className="app-shell">
        <Sidebar
          page={route.page}
          onNavigate={navigate}
          mobileOpen={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
        />

        <div className="main-column">
          <Topbar
            page={route.page}
            user={user}
            onMenu={() => setMobileNavOpen(true)}
            onSignOut={onSignOut}
          />

          <main className="content" id="main-content">
            {route.page === 'live' ? <LiveData /> : null}
            {route.page === 'overview' ? (
              <Overview
                onSelectProject={openProject}
                onGoToTracker={() => navigate('tracker')}
                onFilterByStatus={filterByStatus}
                onFilterByProgramStatus={filterByProgramStatus}
              />
            ) : null}
            {route.page === 'tracker' ? (
              <Tracker onSelectProject={openProject} />
            ) : null}
            {route.page === 'timeline' ? (
              <Timeline onSelectProject={openProject} />
            ) : null}
            {route.page === 'quality' ? (
              <DataQuality onSelectProject={openProject} />
            ) : null}
            {route.page === 'about' ? <About /> : null}
          </main>
        </div>

        <ProjectDrawer
          project={selectedProject}
          asOf={asOf}
          onClose={closeProject}
        />
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => loadSession());

  const signOut = () => {
    clearSession();
    setUser(null);
  };

  if (!user) {
    return <LoginGate onAuthenticated={setUser} />;
  }

  return (
    <WorkbookProvider>
      <FiltersProvider>
        <Dashboard user={user} onSignOut={signOut} />
      </FiltersProvider>
    </WorkbookProvider>
  );
}
