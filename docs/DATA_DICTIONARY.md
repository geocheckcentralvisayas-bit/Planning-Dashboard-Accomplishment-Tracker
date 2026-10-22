# Data Dictionary and SharePoint Schema

This document defines the production data model for the EMB Region 7 planning
dashboard. It is the contract between the SharePoint tracker, Power BI, and the
React prototype.

The model uses three lists:

| List | Role | Typical row count |
| --- | --- | --- |
| **Planning Projects** | One row per project; current status, schedule, budget, and owner. | 30–150 |
| **Milestones** | One row per project milestone; due date, status, and completion. | 300–1,000 |
| **Updates Log** | Append-only history of status, progress, and remarks. | 1,000–10,000 |

The Excel workbook is the starting point, not the ongoing source of truth. After
migration, staff update the SharePoint lists; Power BI reads from them on a
schedule.

---

## Live workbook snapshot (current)

**Every page in the dashboard now reads the actual workbook.** The
`Main (for CO)` sheet in `EMB 7 Accomplishment 2026 - ALL SECTIONS.xlsx` is
parsed by `scripts/sync_live_data.py` and rendered from `public/live-data.json`.

The workbook is a **monthly accomplishment matrix**, not a project portfolio. It
has activity-level indicators, monthly targets, monthly actuals, remarks, means
of verification, and focal staff. It does **not** contain project budgets,
milestones, project start/end dates, or risk registers.

### What the dashboard derives from it

| Dashboard view | Source in the workbook |
| --- | --- |
| **Live Accomplishments** | Every indicator line with its 12 monthly targets, 12 monthly actuals, % to date, % annual, remarks, and MOV. |
| **Executive Overview** | The 129 `PROGRAM / PROJECTS / ACTIVITIES` activity groups, their 15 `SECTION / UNIT` headings, and the derived monthly delivery curve. |
| **Activity Tracker** | The activity groups with their annual/YTD targets and actuals, focal staff, and completeness flags. |
| **Reporting Schedule** | The 2026 matrix year with Q1–Q4 plus full-year checkpoints, whose targets are summed from the monthly target columns. |
| **Data Quality** | Missing remarks, missing MOV, activities without an annual target or actual, and quarterly checkpoints that were not met by their due date. |

Status and risk are **formulas over the workbook's own numbers**, not separate
judgements:

| Derived value | Rule |
| --- | --- |
| Completed | annual actual ≥ annual target |
| On Track | YTD attainment ≥ 90% |
| At Risk | YTD attainment 70–90% |
| Delayed | YTD attainment < 70% |
| Not Started | a target exists but no YTD target has fallen due yet |
| No Target / Unplanned | no annual target recorded |
| Risk Low / Medium / High | attainment ≥ 90% / 70–90% / < 70% |

Each indicator has its own unit, so the dashboard uses per-activity attainment
and medians rather than summing raw values across rows.

> If the office later adds budgets, phases, milestones, and update logs to the
> workbook, the lists below become the production model and the same script can
> be extended to read them. Keep the activity-level fact table separate from
> the portfolio lists until the office decides whether to combine them.

---

## Design principles

1. **One fact per field.** Do not store derived values such as "Overdue" or
   "Budget remaining". Calculate them in Power BI so they cannot go stale.
2. **Stable keys.** `ProjectID` is the human-readable project key. SharePoint's
   hidden item ID is the technical key used by lookups and relationships.
3. **Choices, not free text.** Program, office, status, phase, risk, and funding
   source are choice columns. This keeps filters and colors consistent.
4. **People are people.** Use SharePoint Person columns for project leads and
   milestone owners, not text names. This enables "My Projects", notifications,
   and row-level security.
5. **Append, don't overwrite, history.** Status changes belong in the Updates Log.
   The Projects list holds the current state.
6. **Use built-in audit fields.** `Created`, `Modified`, and `Created By` are
   maintained by SharePoint. Avoid a manual "last updated" field that staff must
   remember to change.
7. **Keep the lists small.** The Projects and Milestones lists are small. The
   Updates Log is the only list that grows; archive entries older than 24–36 months
   if it approaches the 5,000-item list view threshold.

---

## List 1 — Planning Projects

**List URL:** `/sites/r7planning/Lists/Planning%20Projects`
**Title column:** used as the project name.
**Versioning:** major versions, retain at least 50 versions.
**Item-level permissions:** not recommended; use a small number of site groups.

| Display name | Internal name | Type | Required | Settings / choices | Notes |
| --- | --- | --- | --- | --- | --- |
| Project Name | `Title` | Single line of text | Yes | Max 255 characters | The default SharePoint Title column. Rename the display label only. |
| Project ID | `ProjectID` | Single line of text | Yes | Max 50; unique index | Format `PRJ-YYYY-NNN`. Never reuse an ID. |
| Description | `Description` | Multiple lines of text | No | Plain text, 6 lines | Short purpose statement. |
| Program | `Program` | Choice | Yes | See choice list below | One of the seven regional programs. |
| Office | `Office` | Choice | Yes | See choice list below | Section or unit accountable for delivery. |
| Project Lead | `ProjectLead` | Person | Yes | Allow only people; no groups | Owner of the project record and updates. |
| Phase | `Phase` | Choice | Yes | Planning, Procurement, Implementation, Monitoring, Completed | Current delivery phase. |
| Status | `Status` | Choice | Yes | On Track, At Risk, Delayed, Completed, Not Started, Cancelled | Current RAG status. Definitions below. |
| Risk Level | `RiskLevel` | Choice | Yes | Low, Medium, High | Current delivery risk, independent of status. |
| Start Date | `StartDate` | Date | Yes | Date only | Planned or actual start. |
| Target End Date | `TargetEndDate` | Date | Yes | Date only | Current approved target. |
| Actual End Date | `ActualEndDate` | Date | No | Date only | Required when Status = Completed. |
| Percent Complete | `PercentComplete` | Number | Yes | Min 0, max 100, 0 decimals | Physical or deliverable progress, not time elapsed. |
| Approved Budget | `BudgetApproved` | Currency | Yes | PHP, 2 decimals, min 0 | Approved budget, not obligated amount. |
| Utilized Budget | `BudgetUtilized` | Currency | Yes | PHP, 2 decimals, min 0 | Actual utilized to date. |
| Funding Source | `FundingSource` | Choice | Yes | GAA, Locally Funded, Grant, Special Account, Donor Funded | Add new sources through site settings, not free text. |
| Remarks | `Remarks` | Multiple lines of text | Yes | Plain text, 10 lines | Latest status narrative. Required for active projects. |
| Document Link | `DocumentLink` | Hyperlink | No | URL + description | Link to the project folder or source document. |
| Created | `Created` | Date and time | System | — | Audit. |
| Modified | `Modified` | Date and time | System | — | **Use this as the record freshness signal.** |
| Created By | `Author` | Person | System | — | Audit. |
| Modified By | `Editor` | Person | System | — | Audit. |

> **Do not add a manual `LastUpdated` column.** The prototype uses one because it
> has no server. In SharePoint, `Modified` is automatic and reliable. For status
> freshness specifically, Power BI can use the latest `Updates Log` entry date
> instead of `Modified`.

### Choice values

**Program**

- Air Quality Management
- Water Quality Management
- Solid Waste Management
- Climate Change Adaptation
- Environmental Education
- Land & Coastal Resources
- Compliance & Enforcement

**Office**

- Air Quality Management Section
- Water Quality Management Section
- Solid Waste Management Section
- Climate Change Unit
- Environmental Education & Information Section
- Land & Coastal Resources Section
- Compliance & Enforcement Section

**Phase**

- Planning
- Procurement
- Implementation
- Monitoring
- Completed

**Status**

- On Track
- At Risk
- Delayed
- Completed
- Not Started
- Cancelled

**Risk Level**

- Low
- Medium
- High

**Funding Source**

- GAA
- Locally Funded
- Grant
- Special Account
- Donor Funded

### Status definitions

Use these definitions consistently. The status is a judgement about delivery, not
a formula.

| Status | Meaning | Required action |
| --- | --- | --- |
| **On Track** | Work is progressing against the approved schedule; no material issue threatens the target. | Normal weekly update. |
| **At Risk** | A known issue or trend could cause slippage or a missed milestone; mitigation is not yet sufficient. | Document the risk and mitigation in Remarks; notify the planning office. |
| **Delayed** | The target end date or a critical milestone has been missed, or work has stopped. | Recovery plan with a new date; escalate to the division chief. |
| **Completed** | All deliverables accepted; actual end date recorded; progress at 100%. | Final update and close-out documents. |
| **Not Started** | Approved and included in the portfolio, but work has not begun. | Confirm start date and readiness. |
| **Cancelled** | Discontinued or defunded. Retained for audit, excluded from active totals. | Record the reason in Remarks. |

### Column and list validation

Use SharePoint validation to protect the most important rules. Validation messages
should tell the user what to fix, not just "invalid value".

**Percent Complete (column validation)**

```text
=AND([Percent Complete]>=0,[Percent Complete]<=100)
```

**Target End Date (column validation)**

```text
=[Target End Date]>=[Start Date]
```

**Actual End Date (column validation)**

```text
=OR(ISBLANK([Actual End Date]),[Actual End Date]>=[Start Date])
```

**List validation: completed projects must be complete**

```text
=IF([Status]="Completed",AND([Percent Complete]=100,NOT(ISBLANK([Actual End Date]))),TRUE)
```

**List validation: not-started projects must be at zero**

```text
=IF([Status]="Not Started",[Percent Complete]=0,TRUE)
```

**Budget utilization (warning only, not a hard block)**

Do not block a record when utilized exceeds approved; variations and realignments
happen. Instead, surface it on the Data Quality page and in a Power Automate
notification:

```text
Utilized budget is greater than approved budget.
```

> **Validation formula tip:** SharePoint validation formulas reference the
> **display name** in brackets. If you rename a column later, update the formula.
> Build and test the rules in a staging list before applying them to production.

### Indexes

Create indexed columns for:

- `ProjectID` — **unique index**, enforce uniqueness.
- `Program`
- `Office`
- `Status`
- `TargetEndDate`
- `Modified` (for stale-record views)

SharePoint allows a limited number of indexed columns per list; these are enough
for the portfolio size.

### Views

| View | Columns | Filter / sort |
| --- | --- | --- |
| **All Projects** | Project Name, Project ID, Program, Status, % Complete, Target End Date, Project Lead, Modified | Sort by Status, then Target End Date. |
| **My Projects** | Same as All Projects | `Project Lead is equal to [Me]`; sort by Target End Date. |
| **Needs Attention** | Project Name, Program, Status, Risk, Target End Date, % Complete, Remarks, Project Lead | `Status is equal to At Risk` OR `Status is equal to Delayed` OR (`Target End Date is less than [Today]` AND `Status is not equal to Completed` AND `Status is not equal to Cancelled`). |
| **Due in 30 Days** | Project Name, Status, Target End Date, % Complete, Project Lead | Target End Date ≤ `[Today]+30`; exclude Completed and Cancelled. |
| **Needs Update** | Project Name, Status, Modified, Project Lead, Remarks | Active projects sorted by Modified ascending. The authoritative stale count is on the Power BI Data Quality page. |
| **Completed** | Project Name, Program, Actual End Date, Approved Budget, Utilized Budget | Status = Completed; sort by Actual End Date descending. |
| **Cancelled** | Project Name, Program, Cancelled reason (Remarks), Modified | Status = Cancelled. |

> SharePoint view filters can use `[Today]` and `[Me]`, but relative date arithmetic
> such as `[Today]-14` is not consistently supported in every tenant. Keep the
> "Needs Update" view sorted by Modified and let Power BI calculate the 14-day
> threshold.

### Permissions

| Group | Permission | Notes |
| --- | --- | --- |
| **Site Owners** | Full Control | Planning & Information Section lead and site administrator. |
| **Planning Editors** | Contribute | Planning staff who maintain projects, milestones, and updates. |
| **Program Leads** | Contribute | Optional; can edit their program's records if the office accepts shared editing. |
| **EMB Staff / Executives** | Read | Dashboard audience. |
| **Updates Log** | Add only (custom) | Regular users can add entries but not edit or delete them. Site Owners can correct mistakes. |

Item-level permissions are possible but add significant maintenance and can slow
large lists. For 30–150 projects, a small number of site groups is simpler. If
program-level edit isolation is mandatory, use separate document libraries or a
Power Apps form with business rules rather than per-item permissions.

Enable **version history** on all three lists and require **check-out editing** only
if the office already works that way; check-out adds friction to frequent status
updates.

---

## List 2 — Milestones

**List URL:** `/sites/r7planning/Lists/Milestones`
**Purpose:** Track the small number of delivery gates per project. Not a task list.

| Display name | Internal name | Type | Required | Settings / choices | Notes |
| --- | --- | --- | --- | --- | --- |
| Milestone Name | `Title` | Single line of text | Yes | Max 255 | e.g., "Procurement completed", "Draft plan submitted". |
| Milestone ID | `MilestoneID` | Single line of text | Yes | Unique index | Format `MS-<ProjectID>-NN`. |
| Project | `Project` | Lookup | Yes | Lookup to Planning Projects, Title column | The technical relationship uses the lookup item ID. |
| Due Date | `DueDate` | Date | Yes | Date only | Current committed date. |
| Status | `Status` | Choice | Yes | Pending, In Progress, Completed, Cancelled | **Do not store "Overdue".** Calculate it. |
| Completion Date | `CompletionDate` | Date | No | Date only | Required when Status = Completed. |
| Owner | `Owner` | Person | No | Allow only people | Defaults to the project lead by convention. |
| Notes | `Notes` | Multiple lines of text | No | Plain text, 4 lines | Evidence, blockers, or acceptance notes. |
| Created | `Created` | Date and time | System | — | Audit. |
| Modified | `Modified` | Date and time | System | — | Audit and freshness. |

### Milestone status definitions

| Status | Meaning |
| --- | --- |
| **Pending** | Not yet started; due date is in the future. |
| **In Progress** | Work is underway. |
| **Completed** | Deliverable accepted; completion date recorded. |
| **Cancelled** | No longer required because the project scope or schedule changed. |

**Overdue** is a calculated condition in Power BI:

```text
DueDate < ReportingDate
AND Status <> Completed
AND Status <> Cancelled
```

### Validation

**Completion Date (column validation)**

```text
=IF([Status]="Completed",NOT(ISBLANK([Completion Date])),TRUE)
```

**List validation: completion date cannot precede the due date by more than a
reasonable tolerance?** Do not enforce this. A milestone can be completed early.
Instead, flag impossible values in the Data Quality page if `CompletionDate` is
before the project start date.

### Milestone views

| View | Filter / sort |
| --- | --- |
| **All Milestones** | Sort by Due Date ascending. |
| **My Milestones** | `Owner is equal to [Me]`; exclude Completed and Cancelled. |
| **Due Next 30 Days** | Due Date ≤ `[Today]+30`; Status not Completed or Cancelled. |
| **Overdue** | Due Date < `[Today]`; Status not Completed or Cancelled. |
| **Completed This Quarter** | Status = Completed; Completion Date in the current quarter. |

---

## List 3 — Updates Log

**List URL:** `/sites/r7planning/Lists/Updates%20Log`
**Purpose:** An append-only record of status changes and narrative updates. This is
the audit trail and the source of the actual-progress trend.

| Display name | Internal name | Type | Required | Settings / choices | Notes |
| --- | --- | --- | --- | --- | --- |
| Update Summary | `Title` | Single line of text | Yes | Max 255 | Short headline, e.g., "Procurement package submitted". |
| Project | `Project` | Lookup | Yes | Lookup to Planning Projects, Title column | The project being updated. |
| Update Date | `UpdateDate` | Date and time | Yes | Date and time | When the update occurred, not when it was encoded. |
| Status at Update | `StatusAtUpdate` | Choice | Yes | Same six statuses as Projects | Snapshot of status at that moment. |
| Percent at Update | `PercentAtUpdate` | Number | Yes | Min 0, max 100, 0 decimals | Snapshot of progress. |
| Remarks | `Remarks` | Multiple lines of text | Yes | Plain text, 10 lines | What changed, what is blocked, and what happens next. |
| Logged By | `LoggedBy` | Single line of text | No | Max 100 | Optional. Use for imported historical entries; new entries can use Created By. |
| Created | `Created` | Date and time | System | — | When the record was entered. |
| Created By | `Author` | Person | System | — | The person who entered the record. |
| Modified | `Modified` | Date and time | System | — | Audit. |

> **Why `LoggedBy` is text:** when importing historical updates, SharePoint assigns
> the importer as `Created By`. A text field preserves the original author's name.
> For new entries, leave it blank and use `Created By`. A Power BI calculated column
> can choose `COALESCE(LoggedBy, CreatedBy.DisplayName)`.

### Updates Log rules

1. **Append-only.** Do not edit or delete an entry to change history. Add a new
   entry that supersedes it. Site Owners may correct spelling or metadata.
2. **One entry per status change.** If only the narrative changes, one entry is
   enough.
3. **Update Date is the business date.** Use the date the update was reported, not
   the date the record was created. This keeps the trend line honest.
4. **Every active project should have an entry at least every 14 days.** The Data
   Quality page uses this threshold.
5. **The latest entry should agree with the Projects list.** A Power Automate flow
   can copy status, percent, and remarks from the latest update to the project
   record (see [`POWER_AUTOMATE_FLOWS.md`](POWER_AUTOMATE_FLOWS.md)).

### Validation

**Percent at Update (column validation)**

```text
=AND([Percent at Update]>=0,[Percent at Update]<=100)
```

**Ensure a completed update is at 100% (list validation)**

```text
=IF([Status at Update]="Completed",[Percent at Update]=100,TRUE)
```

---

## Workbook migration mapping

The workbook requires tenant sign-in and could not be inspected from this
environment. The mapping below covers the fields in the prototype and is the
expected shape. Adjust the left-hand column to the workbook's actual headers.

> **Template tip:** the dashboard's **Export** button downloads the current
> filtered activities as a UTF-8 CSV with the columns in the table below. Clear
> the filters first to export all 129 activity groups, then use the file as a
> starting template for the real migration. It is an activity-level template
> only; milestones and updates need separate rows based on the source workbook.

### Projects

| Workbook column (example) | Destination field | Transformation |
| --- | --- | --- |
| Project Title / Project Name | `Title` | Trim; remove line breaks. |
| Project ID / Code | `ProjectID` | Uppercase; generate `PRJ-YYYY-NNN` if missing; check duplicates. |
| Program / Division | `Program` | Map to the seven choice values; do not keep free text. |
| Section / Office | `Office` | Map to the seven office values. |
| Project Lead / Focal Person | `ProjectLead` | Resolve to a tenant email/UPN. Keep a staging name column until resolved. |
| Phase | `Phase` | Map to the five phase values. |
| Status | `Status` | Map synonyms; see below. |
| Risk | `RiskLevel` | Map Low/Medium/High. |
| Start Date | `StartDate` | Convert Excel serial or local date to `yyyy-mm-dd`. |
| Target End / Completion Date | `TargetEndDate` | Convert to date; must be ≥ Start Date. |
| Actual End Date | `ActualEndDate` | Required for Completed; otherwise blank. |
| % Complete | `PercentComplete` | If stored 0–1, multiply by 100; clamp 0–100. |
| Approved Budget | `BudgetApproved` | Remove `₱`, commas, and spaces; store numeric PHP. |
| Utilized / Disbursed | `BudgetUtilized` | Same as above. |
| Funding Source | `FundingSource` | Map to the five choices. |
| Remarks / Status Update | `Remarks` | Keep latest narrative; do not truncate without review. |
| Document Link | `DocumentLink` | URL only; optional. |
| Last Update | *Do not migrate* | Use `Modified` and the Updates Log. |

**Status synonyms to normalize**

| Workbook value | Production status |
| --- | --- |
| Ongoing, In Progress, Implementation | On Track |
| For Completion, Near Completion, Substantially Complete | On Track (unless a known issue exists, then At Risk) |
| Not Yet Started, Pending, For Start | Not Started |
| On Hold, For Decision, Issue | At Risk |
| Behind Schedule, Slippage, Overdue | Delayed |
| Finished, Turned Over, Closed | Completed |
| Dropped, Defunded, Discontinued | Cancelled |

Do not guess: when a value is ambiguous, put the project in a staging list and ask
the program owner to confirm.

### Milestones

| Workbook column | Destination field | Transformation |
| --- | --- | --- |
| Project ID | `Project` | Resolve to the SharePoint lookup item for that project. |
| Milestone Name | `Title` | Trim. |
| Milestone ID | `MilestoneID` | Generate `MS-<ProjectID>-NN` if missing. |
| Due Date | `DueDate` | Date. |
| Status | `Status` | Pending / In Progress / Completed / Cancelled; map "Overdue" to Pending or In Progress and let Power BI calculate overdue. |
| Completion Date | `CompletionDate` | Required for Completed. |
| Owner | `Owner` | Resolve to tenant user; optional. |
| Notes | `Notes` | Optional. |

### Updates

| Workbook column | Destination field | Transformation |
| --- | --- | --- |
| Project ID | `Project` | Resolve to lookup. |
| Update Date | `UpdateDate` | Date and time; use noon if only a date is available. |
| Status | `StatusAtUpdate` | Normalize as above. |
| % Complete | `PercentAtUpdate` | 0–100. |
| Remarks | `Remarks` | Preserve original text. |
| Author | `LoggedBy` | Preserve the original name. |

**Migration scope:** migrate the current portfolio and the last 12–24 months of
updates, not the entire workbook history. Older history can stay in a read-only
archive document library if needed.

### Import methods

| Method | Best for | Notes |
| --- | --- | --- |
| **SharePoint Import Spreadsheet** | A one-time import by a site owner | May be disabled by tenant policy. Creates a new list, so import into staging then map. |
| **PnP PowerShell / Microsoft Graph** | Repeatable, auditable migration | Requires a site owner and PowerShell. Preferred for a clean cutover. |
| **Power Automate** | Small volumes or ongoing sync | Not suitable for thousands of rows; watch API throttling. |
| **Datasheet copy/paste** | Under ~100 rows | Fast but error-prone; verify lookups and people fields. |

Power Query can read SharePoint and Excel, but it **cannot write** list items. Do
not plan a Power Query-only migration.

### Post-import checks

Run these before switching the dashboard to live data:

- [ ] Project count matches the workbook (excluding intentionally archived rows).
- [ ] `ProjectID` is unique and follows the agreed format.
- [ ] Every project has a valid Program, Office, Status, Phase, and Risk.
- [ ] Every Project Lead resolves to a tenant user.
- [ ] Every date parses; no Excel serial numbers or text dates remain.
- [ ] Target End Date ≥ Start Date; Actual End Date ≥ Start Date.
- [ ] Completed projects have 100% and an Actual End Date.
- [ ] Not Started projects have 0%.
- [ ] Budgets are numeric; utilized is not negative; outliers are explained.
- [ ] Every milestone resolves to a project; no orphan lookups.
- [ ] No milestone is stored as "Overdue"; overdue is calculated.
- [ ] Updates Log entries resolve to projects and use business dates.
- [ ] The latest update agrees with each project's current status and progress.
- [ ] Sample data is removed from the production lists.

---

## Governance and update cadence

| Item | Cadence | Owner |
| --- | --- | --- |
| Project status, progress, remarks | Weekly (e.g., every Friday) | Project lead |
| Milestone status and completion dates | As they change; reviewed weekly | Project lead |
| Budget utilized | Monthly, after financial reporting | Planning finance focal |
| Portfolio review | Monthly | Planning & Information Section |
| Data quality review | Weekly, using the Data Quality page | Planning staff |
| Archived updates | Annually, older than 24–36 months | Site owner |

**Data quality thresholds**

- Status update older than **14 days** for an active project = stale.
- Milestone past due and not Completed/Cancelled = overdue.
- Missing Remarks, Project Lead, Approved Budget, or Actual End Date (when
  Completed) = incomplete.
- Budget utilized > approved = variance requiring an explanation, not necessarily
  an error.
- Project past Target End Date and still active = overdue regardless of status.

These thresholds match the React prototype and the Power BI measures.
