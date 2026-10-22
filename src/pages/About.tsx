import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  FolderKanban,
  History,
  LayoutDashboard,
  LineChart,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { APP_VERSION } from '../data/meta';

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Executive overview',
    text: 'Portfolio KPIs, status mix, performance by unit, median attainment, and a month-by-month attainment series.',
  },
  {
    icon: FolderKanban,
    title: 'Activity tracker',
    text: 'Searchable, sortable, paginated register of every activity group in the workbook with its targets, actuals, and flags.',
  },
  {
    icon: CalendarRange,
    title: 'Reporting schedule',
    text: 'The 2026 workbook year with quarterly target checkpoints taken from the monthly target columns.',
  },
  {
    icon: ShieldCheck,
    title: 'Data quality',
    text: 'Missing remarks, missing means of verification, uncovered targets, and overdue quarterly checkpoints.',
  },
];

export function About() {
  return (
    <div className="page about-page">
      <section className="about-hero">
        <span className="pill-badge">
          <Sparkles size={13} />
          Live workbook · read-only · {APP_VERSION}
        </span>
        <h2>A planning command center for EMB Region 7</h2>
        <p>
          One view of the 2026 accomplishment workbook: every activity group,
          its targets and actuals, and the completeness of what each unit has
          reported so far.
        </p>
        <div className="about-chips">
          <span>React + TypeScript</span>
          <span>Vite</span>
          <span>Responsive</span>
          <span>Live workbook snapshot</span>
        </div>
        <div className="about-status">
          <CheckCircle2 size={15} />
          Reading the shared workbook · updated on every sync
        </div>
      </section>

      <div className="about-grid">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <article className="about-feature" key={feature.title}>
              <span className="about-feature-icon">
                <Icon size={19} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.text}</p>
            </article>
          );
        })}
      </div>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>Production architecture</h2>
            <p>Four moving parts, all inside Microsoft 365</p>
          </div>
        </header>
        <div className="arch-flow">
          <div className="arch-step">
            <span className="arch-icon">
              <FileSpreadsheet size={20} />
            </span>
            <span className="arch-num">01</span>
            <strong>Excel source</strong>
            <small>One-time migration</small>
          </div>
          <ArrowRight size={18} className="arch-arrow" />
          <div className="arch-step">
            <span className="arch-icon">
              <Database size={20} />
            </span>
            <span className="arch-num">02</span>
            <strong>SharePoint lists</strong>
            <small>Tracker + history</small>
          </div>
          <ArrowRight size={18} className="arch-arrow" />
          <div className="arch-step">
            <span className="arch-icon">
              <LineChart size={20} />
            </span>
            <span className="arch-num">03</span>
            <strong>Power BI</strong>
            <small>Model + report</small>
          </div>
          <ArrowRight size={18} className="arch-arrow" />
          <div className="arch-step">
            <span className="arch-icon">
              <Share2 size={20} />
            </span>
            <span className="arch-num">04</span>
            <strong>SharePoint embed</strong>
            <small>One page for everyone</small>
          </div>
        </div>
      </section>

      <div className="grid grid-12">
        <section className="card span-6">
          <header className="card-head">
            <div>
              <h2>Data model</h2>
              <p>Three lists keep the dashboard fast and the tracker auditable</p>
            </div>
          </header>
          <ul className="model-list">
            <li>
              <span className="model-icon">
                <Database size={16} />
              </span>
              <div>
                <strong>Planning Projects</strong>
                <span>
                  Master register: program, owner, phase, status, schedule,
                  budget, remarks, last update.
                </span>
              </div>
            </li>
            <li>
              <span className="model-icon">
                <FolderKanban size={16} />
              </span>
              <div>
                <strong>Milestones</strong>
                <span>
                  Lookup to project with due date, milestone status, and
                  completion date.
                </span>
              </div>
            </li>
            <li>
              <span className="model-icon">
                <History size={16} />
              </span>
              <div>
                <strong>Updates Log</strong>
                <span>
                  Append-only history of status, percent complete, remarks, and
                  author.
                </span>
              </div>
            </li>
          </ul>
        </section>

        <section className="card span-6">
          <header className="card-head">
            <div>
              <h2>Delivery roadmap</h2>
              <p>Four weeks from workbook to embedded dashboard</p>
            </div>
          </header>
          <ol className="roadmap">
            <li>
              <span>1</span>
              <div>
                <strong>Discovery and migration</strong>
                <small>
                  Confirm the workbook mapping, create the SharePoint lists, and
                  migrate records. Week 1.
                </small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Power BI dataset</strong>
                <small>
                  Build the star schema, date table, measures, and report theme.
                  Week 2.
                </small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Report pages</strong>
                <small>
                  Ship executive and tracker pages first, then timeline, detail,
                  and data quality. Weeks 2–3.
                </small>
              </div>
            </li>
            <li>
              <span>4</span>
              <div>
                <strong>Publish and automate</strong>
                <small>
                  Embed in SharePoint, configure refresh and reminders, and
                  train users. Week 4.
                </small>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>To move from prototype to production</h2>
            <p>Four inputs unlock the tenant-side build</p>
          </div>
        </header>
        <ul className="checklist">
          <li>
            <span className="check-dot" />
            <div>
              <strong>Live workbook feed</strong>
              <span>
                A Microsoft Graph app registration so the dashboard can pull the
                workbook from SharePoint on a schedule instead of the local
                OneDrive copy.
              </span>
            </div>
          </li>
          <li>
            <span className="check-dot" />
            <div>
              <strong>Licensing</strong>
              <span>
                Power BI Pro, Premium Per User, Fabric capacity, or Microsoft
                365 E5.
              </span>
            </div>
          </li>
          <li>
            <span className="check-dot" />
            <div>
              <strong>Site ownership</strong>
              <span>
                Owner access to the r7planning SharePoint site for list creation
                and embedding.
              </span>
            </div>
          </li>
          <li>
            <span className="check-dot" />
            <div>
              <strong>Data ownership</strong>
              <span>
                Named data owners and a weekly update cadence for each program.
              </span>
            </div>
          </li>
        </ul>
      </section>

      <p className="about-footnote">
        Every figure on this site is read from the shared 2026 accomplishment
        workbook. Activity names, units, focal staff, targets, actuals, remarks,
        and means of verification come straight from the
        <code>Main (for CO)</code> sheet. Budgets, phases, and update logs are
        not present in the workbook, so they are not shown.
      </p>
    </div>
  );
}
