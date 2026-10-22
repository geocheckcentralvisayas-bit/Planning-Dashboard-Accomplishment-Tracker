# Power BI Build Guide

This guide turns the React prototype into a production Power BI report. It covers
the semantic model, theme, page layout, visual specifications, publishing, and
embedding.

> **Scope note:** the default React **Live Accomplishments** page is an interim
> read-only snapshot of a monthly accomplishment matrix, not the project
> portfolio. The five-page project model below is still the production design
> contract. If the accomplishment view must also go to production, model an
> activity-targets fact table and do not force its mixed-unit indicators into the
> project fields. See the live-workbook section in
> [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md).

The target is a five-page report:

1. **Executive Overview**
2. **Project Tracker**
3. **Timeline**
4. **Project Detail** (drillthrough)
5. **Data Quality**

An optional sixth page, **About & Definitions**, explains status rules, update
cadence, and data ownership.

---

## 1. Prerequisites

| Item | Requirement |
| --- | --- |
| **Authoring** | Power BI Desktop (latest version) on Windows. |
| **Publishing** | Power BI Pro, Premium Per User, or Fabric capacity. Publishing to a shared workspace requires a Pro or PPU license. |
| **Viewing** | Viewers need Power BI Pro/PPU, or the report must be in a Premium/Fabric capacity workspace. |
| **SharePoint** | Read access to the `r7planning` site and the three lists for the account used by the dataset. |
| **Embedding** | Power BI web part in SharePoint Online, or a link/Teams tab. Licensing still applies. |
| **Custom visuals** | A certified Gantt visual may require tenant admin approval. Check the tenant's custom visual policy before designing the Timeline page. |

Do not use **Publish to web** for this report. It creates a publicly accessible
link and is not appropriate for internal project, budget, or personnel data.

---

## 2. Semantic model

### 2.1 Tables and relationships

Load the four queries from [`POWER_QUERY_M.md`](POWER_QUERY_M.md):

- `Projects`
- `Milestones`
- `Updates`
- `Date`

Create these relationships:

| From | To | Cardinality | Direction | Active |
| --- | --- | --- | --- | --- |
| `Milestones[ProjectItemID]` | `Projects[ProjectItemID]` | Many-to-one | Single | Yes |
| `Updates[ProjectItemID]` | `Projects[ProjectItemID]` | Many-to-one | Single | Yes |
| `Date[Date]` | `Projects[TargetEndDate]` | One-to-many | Single | Yes |
| `Date[Date]` | `Milestones[DueDate]` | One-to-many | Single | Yes |
| `Date[Date]` | `Updates[UpdateDate]` | One-to-many | Single | Yes |
| `Date[Date]` | `Projects[StartDate]` | One-to-many | Single | **No** |
| `Date[Date]` | `Projects[ActualEndDate]` | One-to-many | Single | **No** |
| `Date[Date]` | `Milestones[CompletionDate]` | One-to-many | Single | **No** |

> **Date-slicer behavior:** with active relationships from `Date` to three
> different fact tables, a single Date slicer filters Projects by target end date,
> Milestones by due date, and Updates by update date. That is useful on the
> Timeline page but surprising on the Executive page. Do not put a generic Date
> slicer on the Executive page. Use Program/Office/Status slicers and the
> `[Reporting Date]` measure. Use the Date table for the trend axis and for
> time-intelligence cards only.

If the model becomes confusing, an alternative is to keep `Date` related only to
`Updates[UpdateDate]` and use direct date filters for Projects and Milestones.
Choose one pattern and document it.

### 2.2 Model settings

- **Mark `Date` as a date table** (`Date[Date]`).
- **Disable Auto date/time** for the file: File → Options → Data load → Time
  intelligence → Auto date/time off.
- Hide technical keys: `ProjectItemID`, `MilestoneItemID`, `UpdateItemID`.
- Set data categories:
  - `ProjectURL`, `MilestoneURL`, `UpdateURL` → Web URL.
  - `ProjectID`, `MilestoneID` → Uncategorized (text).
- Format:
  - Budgets → Currency, locale Philippines, 0 decimals, symbol `₱`.
  - `PercentComplete`, `PercentAtUpdate` → Whole number, 0 decimals (the source
    is 0–100).
  - Dates → `mmm d, yyyy`.
- Sort:
  - `Date[Month]` by `Date[Month Number]`.
  - `Date[Month Name]` by `Date[Month Number]`.
  - `Date[Month Year]` by `Date[Month Start]` or `Date[Year Month]`.
- Create a `_Measures` table and add the measures from
  [`DAX_MEASURES.md`](DAX_MEASURES.md). Use display folders:
  - 01 Portfolio
  - 02 Budget
  - 03 Schedule
  - 04 Milestones
  - 05 Data Quality
  - 06 RAG & Labels
  - 07 Trend
  - 08 Time Intelligence
  - 09 Security

### 2.3 Why a star schema

- `Projects` is the project dimension/current-state table.
- `Milestones` and `Updates` are fact tables at different grains.
- `Date` is the shared calendar dimension.
- Budget and progress measures aggregate from `Projects`; milestone measures
  aggregate from `Milestones`; history and trend measures aggregate from `Updates`.
- Do not create a single flat table by joining everything. It multiplies budget
  values by milestone counts and produces incorrect totals.

---

## 3. Theme and canvas

### 3.1 Import the theme

1. Open Power BI Desktop → **View** → **Themes** → **Browse for themes**.
2. Select [`../powerbi/EMB-R7-Theme.json`](../powerbi/EMB-R7-Theme.json).
3. Check that the status colors and fonts applied to a test card and table.

The theme uses:

| Token | Color | Use |
| --- | --- | --- |
| Deep green | `#0F3D2E` | Sidebar, headings, primary series |
| Forest | `#14563F` | Buttons, accents |
| Leaf | `#1F7A55` | Positive trend |
| Gold | `#C9992E` | Budget accent |
| Canvas | `#F3F7F5` | Page background |
| Card | `#FFFFFF` | Visual background |
| Border | `#DCE7E1` | Card borders and gridlines |
| Ink | `#17211D` | Primary text |
| Muted | `#6B7F77` | Secondary text |
| Green | `#16A34A` | On Track |
| Amber | `#D97706` | At Risk |
| Red | `#DC2626` | Delayed / Overdue |
| Teal | `#0891B2` | Completed |
| Slate | `#94A3B8` | Not Started / Cancelled |

Do not rely on color alone. Every status visual should also show the status text
or an icon.

### 3.2 Canvas

- Canvas size: **1440 × 810** (16:9). This gives more room than 1280 × 720 and
  matches the prototype's proportions.
- Page background: `#F3F7F5`.
- Outer margin: 24 px.
- Left navigation rail: 210 px, deep green, full height.
- Content area: x = 234, width = 1182.
- Header: x = 234, y = 20, width = 1182, height = 60.
- Visual gap: 12 px.
- Card corner radius: 8 px, border `#DCE7E1`, no shadow.

### 3.3 Navigation

Build a left rail with:

- A small "EMB R7" wordmark or leaf icon.
- Five text buttons: Overview, Tracker, Timeline, Data Quality, About.
- A reporting-date label at the bottom.
- A subtle "Sample data" tag only in the prototype; remove it in production.

Implementation options:

1. **Page navigator** visual, styled with the theme, placed in the rail. This is
   the fastest and most accessible.
2. **Buttons + bookmarks**, one per page, with a selected-state fill. More work but
   closer to the prototype.
3. **Top tab strip** if the left rail feels cramped on mobile. Keep page names
   visible.

For a quick build, use a page navigator with vertical orientation. For a polished
build, use buttons with the active page shown in gold.

---

## 4. Page specifications

### 4.1 Executive Overview

**Purpose:** Answer "How is the portfolio doing, and where do I need to act?"

**Layout**

| Region | Position (x, y, w, h) | Visual |
| --- | --- | --- |
| Header | 234, 20, 1182, 60 | Text: "Planning Portfolio" + `[Reporting Date Label]`; a small "Refresh" timestamp. |
| KPI row | 234, 96, 1182, 96 | Six cards, 187 px wide, 12 px gaps. |
| Row 2 left | 234, 208, 340, 230 | Status mix donut. |
| Row 2 center | 586, 208, 476, 230 | Program performance stacked bar. |
| Row 2 right | 1074, 208, 342, 230 | Budget position card/table. |
| Row 3 left | 234, 450, 700, 200 | Planned vs actual trend. |
| Row 3 right | 946, 450, 470, 200 | Projects needing attention. |
| Row 4 | 234, 662, 1182, 128 | Upcoming milestones. |

**KPI cards** (left to right)

1. **Active Projects** — `[Active Projects]`, subtitle "of [Total Projects] total".
2. **On Track** — `[On Track Projects]`, subtitle `[% of Portfolio]` for the
   On Track filter. A small green accent.
3. **At Risk / Delayed** — `[At Risk Projects] + [Delayed Projects]`, subtitle
   "require attention". Amber/red accent.
4. **Budget Utilization** — `[Budget Utilization %]`, subtitle
   `[Budget Utilized] of [Budget Approved]`. Gold accent.
5. **Overdue Projects** — `[Overdue Projects]`, subtitle `[Overdue Project %]` of
   active. Red accent.
6. **Portfolio Health** — `[Portfolio Health Score]` / 100, subtitle
   `[Portfolio RAG]`. Use a small colored dot or label.

Card styling: white fill, 8 px radius, 1 px border, 20 px padding, label 9 pt
muted, value 26 pt semibold, subtitle 9 pt.

**Status mix donut**

- Legend: `Projects[Status]`.
- Values: `[Total Projects]`.
- Colors: set the six status colors explicitly in **Data colors**, or use the
  `Status Color` measure. Do not rely on the theme's `dataColors` order; it is
  meant for general series, not the status legend.
- Detail labels: category + value + percent, outside end or in tooltip.
- Center label: `[Total Projects]` and "projects".
- Keep all six statuses visible, including Cancelled, so the portfolio reconciles.

**Program performance stacked bar**

- Y-axis: `Projects[Program]`.
- X-axis: `[Total Projects]`.
- Legend: `Projects[Status]`.
- Sort descending by total projects.
- Data labels: off; use tooltips.
- This is a composition view, not a ranking of performance. Title it
  "Portfolio composition by program".
- Optional: a second measure `[Average Completion %]` as a tooltip.

**Budget position**

Use a small table or card cluster:

- `[Budget Approved]`
- `[Budget Utilized]`
- `[Budget Utilization %]` with a thin progress bar (use a bar visual or a card
  with a data-driven title).
- `[Budget Remaining]`
- A note: "Excludes cancelled projects."

A single card with a large utilization number and three small lines is cleaner
than a gauge. Avoid gauges unless the office specifically asks for one.

**Planned vs actual trend**

- X-axis: `Date[Month Year]` (last 12 months, or a date range slicer).
- Lines: `[Planned % at Date]` (dashed, muted gold) and `[Actual % at Date]`
  (solid, deep green).
- Y-axis: 0–100%.
- Title: "Completion trend".
- Add a text note: "Actual = latest update per project at month end."
- If the actual measure is too slow, replace the line chart with an actual-only
  trend from `Updates` and label it clearly as "Update history", not "portfolio
  completion".

**Projects needing attention**

- Table:
  - Project Name
  - Program
  - Status (RAG field)
  - Target End Date
  - `[Project Schedule Variance]` (percentage points)
  - `[Days to Target]`
- Filter: Active projects where Status is At Risk or Delayed, or TargetEndDate is
  before the reporting date. For a top-5 view, add a visual-level Top N filter on
  a `[Risk Score]` measure:

```dax
Risk Score =
VAR StatusRank =
    SWITCH (
        MAX ( Projects[Status] ),
        "Delayed", 4,
        "At Risk", 3,
        "On Track", 2,
        "Not Started", 1,
        0
    )
VAR OverdueRank =
    IF (
        MAX ( Projects[TargetEndDate] ) < [Reporting Date]
            && NOT ( MAX ( Projects[Status] ) IN { "Completed", "Cancelled" } ),
        2,
        0
    )
RETURN
    StatusRank + OverdueRank
```

- Sort by `[Risk Score]` descending, then `[Days to Target]` ascending.
- Conditional formatting: red for overdue, amber for at risk.
- A row click can drill through to Project Detail.

**Upcoming milestones**

- Table: Milestone, Project, Due Date, Days Left, Owner.
- Filter: Due within 45 days, status not Completed/Cancelled.
- Sort by Due Date ascending.
- This table is compact; show 3–4 rows and let the user scroll.

**Slicers**

- Program, Office, Status, Phase.
- Put them in a collapsible filter panel or a top row. On the Executive page, a
  compact top row of four dropdowns is enough; avoid a large filter panel that
  pushes the content down.
- Do not include a generic date slicer. The reporting date is fixed by the measure.

---

### 4.2 Project Tracker

**Purpose:** A complete, filterable register for day-to-day portfolio management.

**Layout**

| Region | Position | Visual |
| --- | --- | --- |
| Header | 234, 20, 1182, 60 | Title + "N projects in view". |
| Filter row | 234, 92, 1182, 64 | Program, Office, Status, Phase, Lead, search box. |
| Table | 234, 168, 1182, 590 | Project register. |
| Footer | 234, 770, 1182, 24 | Data refresh note / row count. |

Power BI does not have a native free-text search box for a table without a
custom visual. Options:

1. Use a slicer on `ProjectName` with **Search** enabled. This is the simplest
   native search.
2. Add a text input custom visual (requires tenant approval).
3. Use a filter pane with "Contains" on Project Name.

Use option 1: a slicer styled as a search box, with "Search" in the slicer header.

**Table columns**

| Column | Field / measure | Formatting |
| --- | --- | --- |
| Project | `Projects[ProjectName]` | Bold; add `ProjectID` as a secondary line using a custom label or a separate column. |
| Program | `Projects[Program]` | Text, 9 pt. |
| Office | `Projects[Office]` | Optional; hide on narrow screens. |
| Lead | `Projects[ProjectLead]` | Text. |
| Status | `[Project RAG]` | Conditional background from `RAG Color`; white or dark text. |
| Progress | `[Project Completion %]` | Data bar + percentage label. |
| Target End | `Projects[TargetEndDate]` | Date; red font if `[Days to Target] < 0` and active. |
| Budget Used | `[Budget Utilized]` / `[Budget Approved]` | Two lines or a single "utilized of approved" text measure. |
| Last Update | `[Last Status Update]` or `Projects[Modified]` | Date + "N days ago" tooltip. |
| Open | `Projects[ProjectURL]` | Web URL icon or "Open" button. |

**Conditional formatting**

- Status background: `RAG Color`, with a pale tint. If the text becomes hard to
  read, use a separate pale background measure and keep the text dark.
- Progress data bar: deep green; show the value.
- Target End: red font for overdue, not a red fill across the whole row.
- Budget: amber if utilization > 90% or utilized > approved; include a tooltip
  explaining the variance.

**Interactions**

- Program/Office/Status/Phase slicers filter the table and the header count.
- Right-click a row → **Drill through** → Project Detail (if configured).
- Add a "Reset filters" button using a bookmark that clears all slicers. Test the
  bookmark's **Data** checkbox so it actually clears the selections.
- Add an "Export" note if the workspace allows export; do not promise it in the
  report if the tenant disables export.

**Sorting**

- Default sort: Status severity (Delayed → At Risk → On Track → Not Started →
  Completed → Cancelled), then Target End Date ascending.
- Create a numeric `Status Sort` column in Power Query or a calculated column to
  control the order; Power BI sorts text alphabetically otherwise.

---

### 4.3 Timeline

**Purpose:** See project durations, overlaps, and milestones across the portfolio.

**Recommended visual**

Use a certified Gantt custom visual. In AppSource, search for a current certified
Gantt visual from a reputable publisher. Confirm:

- It is certified or approved by the tenant's Power BI admin.
- It supports a start date, end date, category, progress, and today line.
- It supports tooltips and a milestone field, or you can pair it with a milestone
  table.
- It renders acceptably in the Power BI service and mobile app.

If custom visuals are blocked, use one of these fallbacks:

1. **Stacked bar chart**: one row per project, a transparent "before start"
   segment and a colored "duration" segment, with a date axis. This is a
   workaround; labels and today lines are harder.
2. **Matrix/table timeline**: project rows, month columns, conditional formatting
   for active months. Less intuitive but fully native.
3. **A table with Start, Target, % Complete, and Days to Target**, sorted by start
   date. Not a true Gantt, but useful.

**Fields for a Gantt visual**

| Setting | Field |
| --- | --- |
| Task / Category | `Projects[ProjectName]` |
| Start | `Projects[StartDate]` |
| End | `Projects[TargetEndDate]` |
| Progress | `[Project Completion %]` |
| Legend / Group | `Projects[Program]` or `[Project RAG]` |
| Tooltip | Status, lead, target, completion, budget utilized |
| Milestones | If supported: `Milestones[MilestoneName]` and `Milestones[DueDate]` |

**Layout**

- Header + Program/Status/Phase slicers.
- Gantt: full width, 520–560 px tall.
- Milestone table below: milestone, project, due date, status, days left.
- A small legend for status colors.
- Enable the today line and label it "Reporting date: [date]".
- Set the axis to a sensible range: one quarter before the earliest start to one
  quarter after the latest target. Do not show a 10-year axis with tiny bars.

**Milestones**

If the Gantt visual does not support multiple milestones per project:

- Keep the Gantt for project bars.
- Add a "Next milestone" column to the project tooltip.
- Put a milestone table below, filtered to the next 90 days or to the selected
  projects.
- Optionally use a scatter chart overlay for milestones, but this is fragile and
  usually not worth the maintenance.

**Filters**

- Program, Status, Phase.
- Avoid a date range slicer that also filters the Gantt's start/end fields; use the
  visual's own axis range or a "Show completed" toggle.
- Add a "Show cancelled" toggle only if the office needs it. Default to active
  projects plus recently completed ones.

---

### 4.4 Project Detail (drillthrough)

**Purpose:** A single project record for review, escalation, or update.

**Setup**

1. Add `Projects[ProjectID]` to the **Drillthrough** field well.
2. Set **Keep all filters** to Off unless the user should retain page filters.
3. Add a Back button (Power BI inserts one automatically; style it).
4. Hide the page from the page navigator if it is drillthrough-only. Users reach
   it from the Tracker or Overview.

**Layout**

| Region | Content |
| --- | --- |
| Header | Project name, ID, Program, Status pill, Risk, Project Lead. |
| KPI row | Completion, Schedule variance, Days to target, Budget utilization. |
| Left column | Project details: office, phase, funding source, start/target/actual dates, last update. |
| Right column | Budget position: approved, utilized, remaining, a bar. |
| Middle | Milestones table: milestone, due date, status, completion date, owner. |
| Bottom left | Recent updates: date, status, percent, remarks, author. |
| Bottom right | Status remarks and "Open in SharePoint" button. |

**Visual details**

- Use a card or text box for the header; a table cannot style a project name as a
  page title.
- Status pill: use a small table or a card with `[Project RAG]` and conditional
  background `RAG Color`.
- `[Days to Target]` card: red if negative and active; show "Closed" for completed
  and cancelled.
- Budget bar: use a 100% stacked bar with utilized and remaining, or a card with a
  data bar. Do not use a gauge.
- Milestones table: conditional formatting on status; overdue rows in red text.
- Updates: sort by `UpdateDate` descending; show 6–10 entries; include a "View all"
  link to the SharePoint list.
- Remarks: a card with auto text; enable "Wrap text" and a fixed height with
  scroll if needed.
- Open in SharePoint: a button with an action of type **Web URL** using
  `Projects[ProjectURL]`. This works in the service and desktop.

**Data quality notes**

- If a project has no updates, show "No updates logged" rather than an empty
  visual. Use a measure or a text box with a conditional visibility bookmark.
- If milestones are missing, show a note and link to the Milestones list.
- Do not hide missing data silently; the Data Quality page exists to surface it.

---

### 4.5 Data Quality

**Purpose:** Make the invisible data problems visible and assign follow-up.

**Layout**

| Region | Content |
| --- | --- |
| Header | "Data Quality" + reporting date + refresh timestamp. |
| Health card | `[Portfolio Health Score]` / 100, RAG label, four component bars. |
| KPI row | Stale, Overdue milestones, Incomplete records, Overdue projects. |
| Left table | Stale projects: project, lead, last update, days since, status. |
| Right table | Overdue milestones: milestone, project, due date, days overdue, owner. |
| Bottom left | Incomplete records: project, missing fields. |
| Bottom right | Definitions / thresholds. |

**Health card**

- Big number: `[Portfolio Health Score]`.
- Small label: `[Portfolio RAG]`.
- Four component bars:
  - Freshness: `[Update Compliance %]`
  - Milestone timeliness: `[Milestone Timeliness %]`
  - Record completeness: `[Record Completeness %]`
  - Schedule adherence: `1 - [Overdue Project %]`
- Use data bars or small 100% stacked bars; avoid four separate gauges.
- Add a footnote: "Weights: freshness 30%, milestones 25%, completeness 25%,
  schedule 20%."

**Stale projects**

- Columns: Project, Program, Lead, Last Update, Days Since, Status.
- Filter: active projects where `[Last Status Update]` or `Modified` is older than
  14 days.
- Sort by days since descending.
- Conditional formatting: red for >30 days, amber for 14–30 days.
- Add a "Send reminder" note; the actual reminder is a Power Automate flow, not a
  Power BI action.

**Overdue milestones**

- Columns: Milestone, Project, Due Date, Days Overdue, Owner, Status.
- Filter: due date before reporting date, status not Completed/Cancelled.
- Sort by days overdue descending.
- Red font for days overdue.

**Incomplete records**

- Columns: Project, Lead, Missing fields.
- Use a DAX calculated column or a measure that concatenates the missing fields:

```dax
Missing Fields =
VAR MissingRemarks = IF ( ISBLANK ( Projects[Remarks] ), "Remarks; ", "" )
VAR MissingLead = IF ( ISBLANK ( Projects[ProjectLead] ), "Lead; ", "" )
VAR MissingBudget = IF ( Projects[BudgetApproved] <= 0, "Approved budget; ", "" )
VAR MissingActualEnd =
    IF (
        Projects[Status] = "Completed" && ISBLANK ( Projects[ActualEndDate] ),
        "Actual end date; ",
        ""
    )
VAR Result = MissingRemarks & MissingLead & MissingBudget & MissingActualEnd
RETURN
    IF ( LEN ( Result ) > 0, LEFT ( Result, LEN ( Result ) - 2 ), "" )
```

- Filter to non-blank `Missing Fields`.

**Definitions panel**

Include a text box with:

- Stale threshold: 14 days.
- Overdue milestone: due date before reporting date and not completed.
- Incomplete: missing remarks, lead, approved budget, or actual end date.
- Health weights.
- Data owner and update cadence.
- A link to the SharePoint lists.

**Refresh timestamp**

Use the `Refresh Audit` query or a measure:

```dax
Last Refresh =
FORMAT ( MAX ( 'Refresh Audit'[RefreshedAt] ), "mmm d, yyyy h:mm AM/PM" )
```

The audit query returns a proper datetime column. Avoid showing "now" from the
user's browser; show the actual dataset refresh time.

---

### 4.6 About & Definitions (optional)

A short page with:

- What the report covers and what it does not.
- Status definitions (On Track, At Risk, Delayed, Completed, Not Started,
  Cancelled).
- Data ownership and update cadence.
- How to request a correction (link to the SharePoint list or a mailto).
- Report version and last refresh.
- A note that budgets are in PHP and exclude cancelled projects.

This page is especially useful when the report is embedded in SharePoint and
viewers do not attend a training session.

---

## 5. Interactions, tooltips, and bookmarks

### Sync slicers

Use **View → Sync slicers** for Program, Office, Status, and Phase across the
Overview, Tracker, and Timeline pages. Decide which page owns the slicer
("Sync" + "Visible") and which pages only receive the filter.

### Drillthrough

- Tracker → Project Detail on `ProjectID`.
- Overview attention table → Project Detail.
- Timeline → Project Detail.
- Add a "Back" button on the detail page and test it after publishing.

### Custom tooltips

Create a hidden tooltip page (320 × 240) with:

- Project name and status.
- Lead and target date.
- Completion and budget utilization.
- Last update and next milestone.

Set the tooltip page in the visual's **Tooltip** settings. Keep it small; too many
fields make the tooltip unreadable.

### Bookmarks

Useful bookmarks:

- **Show filters / Hide filters** — toggles a filter panel.
- **Reset filters** — clears slicers. In the bookmark settings, check **Data**;
  otherwise the bookmark only changes visibility, not selections.
- **Tracker view / Timeline view** — if the two pages are combined.
- **Show definitions** — opens a text panel on the Data Quality page.

Name bookmarks clearly and group them in the Selection pane. Do not nest more than
one level of bookmarks; they become difficult to maintain.

---

## 6. Publishing and sharing

1. **Save the .pbix** in a controlled location. Consider a SharePoint document
   library or a Power BI workspace with version history.
2. **Publish** to a workspace, e.g., `EMB R7 Planning`.
3. **Configure the semantic model**:
   - Data source credentials: organizational account with read access to the
     SharePoint site.
   - Privacy level: Organizational.
   - Scheduled refresh: at least daily; twice daily if updates are frequent.
   - Failure notifications: workspace owner and dataset owner.
4. **Create the app**:
   - Include the five report pages.
   - Set the app name, description, and audience.
   - Grant access to the EMB staff group and executive group.
5. **Share the app link**, not the workspace. Workspace membership gives edit
   rights; viewers should use the app.
6. **Embed in SharePoint**:
   - Edit the target SharePoint page.
   - Add the **Power BI** web part.
   - Select the workspace and report.
   - Set the page audience and test with a non-owner account.
   - Alternatively, add a Teams tab with the report.
7. **Document the owner and refresh schedule** on the SharePoint page.

### Licensing note

- Power BI Pro or PPU is required to publish to a shared workspace.
- Viewers need Pro/PPU unless the workspace is backed by Premium/Fabric capacity.
- Embedding in SharePoint does not remove the licensing requirement.
- Confirm licensing before promising a broad rollout. A single Pro license is
  enough for authoring but not for sharing with the whole office.

### Gateway

No gateway is required for SharePoint Online. If the source is later moved to an
on-premises SQL Server or file share, a data gateway becomes necessary.

---

## 7. Row-level security

Implement roles as described in [`DAX_MEASURES.md`](DAX_MEASURES.md):

- **Planning Admins** — no filter.
- **Project Leads** — `[ProjectLeadEmail] = USERPRINCIPALNAME()`.
- **Office Leads** — mapping table `SecurityMap`.
- **Executives** — no filter.

Test with **View as role** in Desktop and with a real viewer account in the
service. Remember:

- Workspace admins/members with edit permissions bypass RLS.
- RLS applies to the semantic model, not to a copied Excel export.
- If the report is embedded in SharePoint, the viewer's Power BI identity is used.
- Do not use RLS to hide sample data in a public demo; use a separate demo
  workspace with no real data.

---

## 8. Accessibility

- Add alt text to every chart, table, and button.
- Set a logical tab order: navigation → filters → main content → detail.
- Use text labels in addition to color for status.
- Keep font sizes at 9 pt or larger; 10–11 pt for body text.
- Check contrast: dark text on white or pale backgrounds; white text on deep
  green. Avoid amber text on white for small labels.
- Do not put essential information only in a tooltip.
- Test at 100%, 125%, and 150% browser zoom.
- Create a mobile layout for the Overview and Tracker pages:
  - Hide the left rail; use a top page navigator.
  - Stack KPI cards 2 × 3.
  - Keep one table visible at a time.
  - Use the Power BI mobile app's phone layout, not just a scaled desktop canvas.
- Add a "How to read this report" note with definitions.

---

## 9. Performance

- Use **Import** mode; the dataset is small.
- Load only the columns used in visuals and measures.
- Disable Auto date/time; keep one marked Date table.
- Avoid bidirectional relationships.
- Use measures instead of calculated columns for aggregations.
- Avoid nested `FILTER` over large fact tables in every visual; the Updates table
  is the largest.
- Keep the number of visuals per page reasonable (8–12). Each visual issues a
  query.
- Use the Performance Analyzer to find slow visuals.
- For the trend, use the snapshot table if `[Actual % at Date]` is slow.
- Archive old Updates Log rows; the SharePoint connector does not fold complex
  transformations.
- If the report grows beyond a few hundred thousand update rows, move the
  semantic model to a Fabric Lakehouse or a SQL source.

---

## 10. QA checklist

### Data

- [ ] Project count matches the SharePoint list (excluding archived items).
- [ ] Active + Completed + Cancelled = Total.
- [ ] Budget totals exclude cancelled projects; the note is visible.
- [ ] Percent values are 0–100, not 0–1.
- [ ] Dates display in PHT; no UTC offset errors.
- [ ] Every milestone and update has a valid project.
- [ ] No duplicate `ProjectID`.
- [ ] Completed projects have actual end dates and 100%.
- [ ] The reporting date is correct for the intended audience.

### Visuals

- [ ] KPI cards reconcile with the tables.
- [ ] Status colors match the theme and are consistent across pages.
- [ ] Overdue projects are visually distinct without relying on color alone.
- [ ] Tables are sorted intentionally, not alphabetically by accident.
- [ ] Slicers sync across pages as intended.
- [ ] Clear/reset filters works.
- [ ] Drillthrough opens the correct project and the Back button works.
- [ ] Tooltips are readable and do not overflow.
- [ ] No visual is clipped at 1440 × 810 or at 100% zoom.
- [ ] Mobile layout is tested in the Power BI mobile app.

### Security and publishing

- [ ] RLS tested with a project lead, an office lead, and an executive.
- [ ] Workspace viewers cannot edit the report.
- [ ] The app audience is correct.
- [ ] Scheduled refresh succeeds with the service account.
- [ ] Refresh failure notifications are enabled.
- [ ] The SharePoint embed works for a non-owner.
- [ ] No real data is in the public prototype.
- [ ] The report has an owner, a support contact, and a review date.

---

## 11. Build sequence

A practical four-week sequence:

| Week | Work |
| --- | --- |
| **1** | Confirm workbook mapping; create lists; migrate and validate data; set permissions; build the Power Query queries. |
| **2** | Build the semantic model, date table, measures, and theme. Ship the Executive Overview and Project Tracker. |
| **3** | Build Timeline, Project Detail, and Data Quality. Add interactions, tooltips, bookmarks, and RLS. |
| **4** | Test, publish, embed in SharePoint, configure refresh and flows, train users, and hand over. |

Do not wait for every visual to be perfect before testing with real data. The
model and the data-quality rules are the foundation; the visuals are easier to
adjust.
