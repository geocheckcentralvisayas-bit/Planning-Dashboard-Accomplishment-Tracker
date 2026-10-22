# Power Query M — SharePoint to Power BI

This document contains the Power Query queries for the production Power BI
dataset. The queries read the three SharePoint lists defined in
[`DATA_DICTIONARY.md`](DATA_DICTIONARY.md), expand lookups and people fields, and
produce clean tables for the star schema.

Power Query is **read-only** with respect to SharePoint lists. It is used to load
and shape the data; it is not the migration tool.

---

## 1. Parameters

Create these in Power Query Editor → **Manage Parameters**:

| Parameter | Type | Example | Notes |
| --- | --- | --- | --- |
| `SharePointSiteUrl` | Text | `https://embco.sharepoint.com/sites/r7planning` | No trailing slash. Use the site that owns the lists. |
| `ProjectsListName` | Text | `Planning Projects` | Exact list name. |
| `MilestonesListName` | Text | `Milestones` | Exact list name. |
| `UpdatesListName` | Text | `Updates Log` | Exact list name. |

Using parameters makes it possible to point the same report at a test site without
editing every query.

---

## 2. Query dependency map

```text
SharePointSiteUrl
       │
       ├── Projects ─────────┐
       ├── Milestones ───────┼──► Model
       ├── Updates ──────────┤
       └── Date ─────────────┘
```

Recommended query names in the model:

| Query | Model table | Grain |
| --- | --- | --- |
| `Projects` | **Projects** | One row per project. |
| `Milestones` | **Milestones** | One row per milestone. |
| `Updates` | **Updates** | One row per status update. |
| `Date` | **Date** | One row per calendar day. |

Rename the queries to these short names after loading. The DAX in
[`DAX_MEASURES.md`](DAX_MEASURES.md) assumes these table names.

---

## 3. Projects query

```m
let
    Source = SharePoint.Tables(SharePointSiteUrl, [ApiVersion = 15]),
    Raw = Source{[Name = ProjectsListName]}[Data],

    // Remove connector/system columns that are not needed in the report.
    RemovedSystemColumns = Table.RemoveColumns(
        Raw,
        {
            "ContentType", "Attachments", "Edit", "LinkTitleNoMenu", "LinkTitle",
            "DocIcon", "ItemChildCount", "FolderChildCount",
            "_ComplianceFlags", "_ComplianceTag", "_ComplianceTagWrittenTime",
            "_ComplianceTagUserId", "_UIVersionString", "AppAuthor", "AppEditor"
        },
        MissingField.Ignore
    ),

    Renamed = Table.RenameColumns(
        RemovedSystemColumns,
        {
            {"ID", "ProjectItemID"},
            {"Title", "ProjectName"},
            {"ProjectLead", "ProjectLeadRecord"},
            {"DocumentLink", "DocumentLinkRecord"}
        },
        MissingField.Ignore
    ),

    // Person columns arrive as records; make nulls safe before expanding.
    NormalizedLead = Table.TransformColumns(
        Renamed,
        {
            {
                "ProjectLeadRecord",
                each if _ = null then [DisplayName = null, Email = null] else _,
                type record
            }
        }
    ),
    ExpandedLead = Table.ExpandRecordColumn(
        NormalizedLead,
        "ProjectLeadRecord",
        {"DisplayName", "Email"},
        {"ProjectLead", "ProjectLeadEmail"}
    ),

    // Hyperlink columns also arrive as records. If the Document Link column is
    // not used, delete these two steps AND the DocumentURL / DocumentDescription
    // entries from the type step below.
    NormalizedLink = Table.TransformColumns(
        ExpandedLead,
        {
            {
                "DocumentLinkRecord",
                each if _ = null then [Url = null, Description = null] else _,
                type record
            }
        }
    ),
    ExpandedLink = Table.ExpandRecordColumn(
        NormalizedLink,
        "DocumentLinkRecord",
        {"Url", "Description"},
        {"DocumentURL", "DocumentDescription"}
    ),

    Trimmed = Table.TransformColumns(
        ExpandedLink,
        {
            {"ProjectName", each if _ = null then null else Text.Trim(Text.Clean(_)), type text},
            {"ProjectID", each if _ = null then null else Text.Upper(Text.Trim(_)), type text},
            {"Program", each if _ = null then null else Text.Trim(_), type text},
            {"Office", each if _ = null then null else Text.Trim(_), type text},
            {"Phase", each if _ = null then null else Text.Trim(_), type text},
            {"Status", each if _ = null then null else Text.Trim(_), type text},
            {"RiskLevel", each if _ = null then null else Text.Trim(_), type text},
            {"FundingSource", each if _ = null then null else Text.Trim(_), type text}
        }
    ),

    // All columns below must exist in the list. Create the schema first, or
    // remove the optional columns from this step.
    Typed = Table.TransformColumnTypes(
        Trimmed,
        {
            {"ProjectItemID", Int64.Type},
            {"ProjectName", type text},
            {"ProjectID", type text},
            {"Description", type text},
            {"Program", type text},
            {"Office", type text},
            {"ProjectLead", type text},
            {"ProjectLeadEmail", type text},
            {"Phase", type text},
            {"Status", type text},
            {"RiskLevel", type text},
            {"StartDate", type date},
            {"TargetEndDate", type date},
            {"ActualEndDate", type date},
            {"PercentComplete", type number},
            {"BudgetApproved", Currency.Type},
            {"BudgetUtilized", Currency.Type},
            {"FundingSource", type text},
            {"Remarks", type text},
            {"DocumentURL", type text},
            {"DocumentDescription", type text},
            {"Created", type datetime},
            {"Modified", type datetime}
        }
    ),

    AddedFlags = Table.AddColumn(
        Typed,
        "IsClosed",
        each List.Contains({"Completed", "Cancelled"}, [Status]),
        type logical
    ),

    AddedURL = Table.AddColumn(
        AddedFlags,
        "ProjectURL",
        each SharePointSiteUrl
            & "/Lists/"
            & Uri.EscapeDataString(ProjectsListName)
            & "/DispForm.aspx?ID="
            & Text.From([ProjectItemID]),
        type text
    ),

    Filtered = Table.SelectRows(AddedURL, each [ProjectItemID] <> null)
in
    Filtered
```

### Notes

- `ProjectItemID` is SharePoint's technical item ID. It is the relationship key
  used by the Milestones and Updates lookups. `ProjectID` is the human-readable
  code (`PRJ-2025-006`), not the relationship key.
- If your tenant's hyperlink column comes through as text rather than a record,
  remove the `NormalizedLink` / `ExpandedLink` steps, remove the `DocumentURL` and
  `DocumentDescription` entries from the type step, and type `DocumentLink` as
  text instead.
- `Modified` is the record freshness field. There is no manual `LastUpdated`
  field in the production schema.
- The `ProjectURL` column can drive a "Open in SharePoint" button or table URL
  icon in the report. It points to the display form; use `EditForm.aspx` if you
  want editors to land directly in edit mode.
- Do not add `TODAY()`-dependent columns here. Use DAX measures so the report
  updates without a dataset refresh.

---

## 4. Milestones query

```m
let
    Source = SharePoint.Tables(SharePointSiteUrl, [ApiVersion = 15]),
    Raw = Source{[Name = MilestonesListName]}[Data],

    RemovedSystemColumns = Table.RemoveColumns(
        Raw,
        {
            "ContentType", "Attachments", "Edit", "LinkTitleNoMenu", "LinkTitle",
            "DocIcon", "ItemChildCount", "FolderChildCount",
            "_ComplianceFlags", "_ComplianceTag", "_ComplianceTagWrittenTime",
            "_ComplianceTagUserId", "_UIVersionString", "AppAuthor", "AppEditor"
        },
        MissingField.Ignore
    ),

    Renamed = Table.RenameColumns(
        RemovedSystemColumns,
        {
            {"ID", "MilestoneItemID"},
            {"Title", "MilestoneName"},
            {"Project", "ProjectLookup"},
            {"Owner", "OwnerRecord"}
        },
        MissingField.Ignore
    ),

    NormalizedProject = Table.TransformColumns(
        Renamed,
        {
            {
                "ProjectLookup",
                each if _ = null then [Id = null, Value = null] else _,
                type record
            }
        }
    ),
    ExpandedProject = Table.ExpandRecordColumn(
        NormalizedProject,
        "ProjectLookup",
        {"Id", "Value"},
        {"ProjectItemID", "ProjectName"}
    ),

    NormalizedOwner = Table.TransformColumns(
        ExpandedProject,
        {
            {
                "OwnerRecord",
                each if _ = null then [DisplayName = null, Email = null] else _,
                type record
            }
        }
    ),
    ExpandedOwner = Table.ExpandRecordColumn(
        NormalizedOwner,
        "OwnerRecord",
        {"DisplayName", "Email"},
        {"Owner", "OwnerEmail"}
    ),

    Typed = Table.TransformColumnTypes(
        ExpandedOwner,
        {
            {"MilestoneItemID", Int64.Type},
            {"MilestoneID", type text},
            {"MilestoneName", type text},
            {"ProjectItemID", Int64.Type},
            {"ProjectName", type text},
            {"DueDate", type date},
            {"Status", type text},
            {"CompletionDate", type date},
            {"Owner", type text},
            {"OwnerEmail", type text},
            {"Notes", type text},
            {"Created", type datetime},
            {"Modified", type datetime}
        }
    ),

    AddedFlags = Table.AddColumn(
        Typed,
        "IsClosed",
        each List.Contains({"Completed", "Cancelled"}, [Status]),
        type logical
    ),

    AddedURL = Table.AddColumn(
        AddedFlags,
        "MilestoneURL",
        each SharePointSiteUrl
            & "/Lists/"
            & Uri.EscapeDataString(MilestonesListName)
            & "/DispForm.aspx?ID="
            & Text.From([MilestoneItemID]),
        type text
    ),

    Filtered = Table.SelectRows(AddedURL, each [MilestoneItemID] <> null)
in
    Filtered
```

### Notes

- The lookup expands to `ProjectItemID` (the project's SharePoint item ID) and
  `ProjectName` (the looked-up Title). Keep `ProjectName` for display and
  `ProjectItemID` for the relationship.
- **Do not store an "Overdue" status.** The status choices are Pending,
  In Progress, Completed, Cancelled. Overdue is a DAX condition based on
  `DueDate` and the reporting date.
- If the Owner column is optional and a row has no owner, the null-record
  replacement prevents an expansion error.

---

## 5. Updates query

```m
let
    Source = SharePoint.Tables(SharePointSiteUrl, [ApiVersion = 15]),
    Raw = Source{[Name = UpdatesListName]}[Data],

    RemovedSystemColumns = Table.RemoveColumns(
        Raw,
        {
            "ContentType", "Attachments", "Edit", "LinkTitleNoMenu", "LinkTitle",
            "DocIcon", "ItemChildCount", "FolderChildCount",
            "_ComplianceFlags", "_ComplianceTag", "_ComplianceTagWrittenTime",
            "_ComplianceTagUserId", "_UIVersionString", "AppAuthor", "AppEditor"
        },
        MissingField.Ignore
    ),

    Renamed = Table.RenameColumns(
        RemovedSystemColumns,
        {
            {"ID", "UpdateItemID"},
            {"Title", "UpdateSummary"},
            {"Project", "ProjectLookup"},
            {"Author", "CreatedByRecord"}
        },
        MissingField.Ignore
    ),

    NormalizedProject = Table.TransformColumns(
        Renamed,
        {
            {
                "ProjectLookup",
                each if _ = null then [Id = null, Value = null] else _,
                type record
            }
        }
    ),
    ExpandedProject = Table.ExpandRecordColumn(
        NormalizedProject,
        "ProjectLookup",
        {"Id", "Value"},
        {"ProjectItemID", "ProjectName"}
    ),

    NormalizedAuthor = Table.TransformColumns(
        ExpandedProject,
        {
            {
                "CreatedByRecord",
                each if _ = null then [DisplayName = null, Email = null] else _,
                type record
            }
        }
    ),
    ExpandedAuthor = Table.ExpandRecordColumn(
        NormalizedAuthor,
        "CreatedByRecord",
        {"DisplayName", "Email"},
        {"CreatedBy", "CreatedByEmail"}
    ),

    Typed = Table.TransformColumnTypes(
        ExpandedAuthor,
        {
            {"UpdateItemID", Int64.Type},
            {"UpdateSummary", type text},
            {"ProjectItemID", Int64.Type},
            {"ProjectName", type text},
            {"UpdateDate", type datetime},
            {"StatusAtUpdate", type text},
            {"PercentAtUpdate", type number},
            {"Remarks", type text},
            {"LoggedBy", type text},
            {"CreatedBy", type text},
            {"CreatedByEmail", type text},
            {"Created", type datetime},
            {"Modified", type datetime}
        }
    ),

    AddedAuthor = Table.AddColumn(
        Typed,
        "UpdateAuthor",
        each if [LoggedBy] <> null and [LoggedBy] <> "" then [LoggedBy] else [CreatedBy],
        type text
    ),

    AddedURL = Table.AddColumn(
        AddedAuthor,
        "UpdateURL",
        each SharePointSiteUrl
            & "/Lists/"
            & Uri.EscapeDataString(UpdatesListName)
            & "/DispForm.aspx?ID="
            & Text.From([UpdateItemID]),
        type text
    ),

    Filtered = Table.SelectRows(AddedURL, each [UpdateItemID] <> null)
in
    Filtered
```

### Notes

- `UpdateDate` is the business date of the update. `Created` is when the record
  was entered. The trend line uses `UpdateDate`.
- `UpdateAuthor` prefers the imported historical name in `LoggedBy` and falls
  back to the SharePoint `Created By` display name for new entries.
- The Updates table is a fact table. Relate it to Projects on `ProjectItemID` and
  to Date on `UpdateDate` (or use a separate `UpdateDate` relationship and mark
  one date relationship active).

---

## 6. Date table

A dedicated date table is required for time intelligence and for consistent
reporting-date comparisons. Create a blank query named `Date`:

```m
let
    StartDate = #date(2024, 1, 1),
    EndDate = #date(2028, 12, 31),
    DayCount = Duration.Days(EndDate - StartDate) + 1,
    DateList = List.Dates(StartDate, DayCount, #duration(1, 0, 0, 0)),
    ToTable = Table.FromList(DateList, Splitter.SplitByNothing(), {"Date"}, null, ExtraValues.Error),
    ChangedType = Table.TransformColumnTypes(ToTable, {{"Date", type date}}),

    AddedYear = Table.AddColumn(ChangedType, "Year", each Date.Year([Date]), Int64.Type),
    AddedQuarterNumber = Table.AddColumn(AddedYear, "Quarter Number", each Date.QuarterOfYear([Date]), Int64.Type),
    AddedQuarter = Table.AddColumn(
        AddedQuarterNumber,
        "Quarter",
        each "Q" & Text.From(Date.QuarterOfYear([Date])) & " " & Text.From(Date.Year([Date])),
        type text
    ),
    AddedMonthNumber = Table.AddColumn(AddedQuarter, "Month Number", each Date.Month([Date]), Int64.Type),
    AddedMonth = Table.AddColumn(
        AddedMonthNumber,
        "Month",
        each Date.ToText([Date], "MMM", "en-US"),
        type text
    ),
    AddedMonthName = Table.AddColumn(
        AddedMonth,
        "Month Name",
        each Date.ToText([Date], "MMMM", "en-US"),
        type text
    ),
    AddedMonthYear = Table.AddColumn(
        AddedMonthName,
        "Month Year",
        each Date.ToText([Date], "MMM yyyy", "en-US"),
        type text
    ),
    AddedMonthStart = Table.AddColumn(
        AddedMonthYear,
        "Month Start",
        each Date.StartOfMonth([Date]),
        type date
    ),
    AddedWeekdayNumber = Table.AddColumn(
        AddedMonthStart,
        "Weekday Number",
        each Date.DayOfWeek([Date], Day.Monday) + 1,
        Int64.Type
    ),
    AddedWeekday = Table.AddColumn(
        AddedWeekdayNumber,
        "Weekday",
        each Date.ToText([Date], "ddd", "en-US"),
        type text
    ),
    AddedDay = Table.AddColumn(AddedWeekday, "Day", each Date.Day([Date]), Int64.Type),
    AddedIsWeekend = Table.AddColumn(
        AddedDay,
        "Is Weekend",
        each Date.DayOfWeek([Date], Day.Monday) >= 5,
        type logical
    ),
    AddedIsToday = Table.AddColumn(
        AddedIsWeekend,
        "Is Today",
        each [Date] = Date.From(DateTime.LocalNow()),
        type logical
    ),
    AddedIsCurrentMonth = Table.AddColumn(
        AddedIsToday,
        "Is Current Month",
        each Date.Year([Date]) = Date.Year(DateTime.LocalNow())
            and Date.Month([Date]) = Date.Month(DateTime.LocalNow()),
        type logical
    ),
    AddedIsPast = Table.AddColumn(
        AddedIsCurrentMonth,
        "Is Past",
        each [Date] < Date.From(DateTime.LocalNow()),
        type logical
    ),

    // Sort keys
    AddedSort = Table.AddColumn(
        AddedIsPast,
        "Year Month",
        each Date.Year([Date]) * 100 + Date.Month([Date]),
        Int64.Type
    )
in
    AddedSort
```

In Power BI:

1. Select `Date` → **Table tools** → **Mark as date table** → `Date`.
2. Create a hierarchy: Year → Quarter → Month → Date.
3. Sort `Month` by `Month Number`.
4. Sort `Month Name` by `Month Number`.
5. Sort `Month Year` by `Month Start` (or `Year Month`).
6. Hide technical columns (`Month Number`, `Year Month`, etc.) from report view.

Adjust `StartDate` / `EndDate` after the portfolio is migrated. A fixed range is
fine for a five-year planning horizon; a dynamic range is unnecessary complexity
for this dataset.

---

## 7. Optional — monthly portfolio snapshot

The prototype's planned-vs-actual trend needs one value per project per month.
Power BI cannot derive that from the current Projects table alone because it only
holds the latest percent. There are two viable approaches:

### Option A — actual trend from the Updates Log (recommended for v1)

Use the Updates fact table for the actual line. Each update is a point in time.
Build a measure that returns the latest percent per project at the selected month
end, then averages across projects. This is simpler than a snapshot table and
uses data the office already maintains.

The planned line can be a DAX measure over Projects based on elapsed schedule. See
[`DAX_MEASURES.md`](DAX_MEASURES.md).

### Option B — monthly snapshot table (more precise, more maintenance)

Create a query `PortfolioMonthly` with one row per project per month-end:

- Month-end dates from the earliest project start to the latest target/update.
- Cross join with Projects.
- `PlannedPercent` = elapsed days ÷ total duration, clamped to 0–100.
- `ActualPercent` = latest `PercentAtUpdate` on or before that month-end.
- `StatusAtMonthEnd` = latest status on or before that month-end.

This produces roughly 50 projects × 60 months = 3,000 rows, which is small. The M
implementation is iterative and slower to refresh, so build it only if the trend
is a must-have for the executive page. Keep it as a separate fact table and relate
it to `Date[Date]` and `Projects[ProjectItemID]`.

A DAX-only approximation using `GENERATESERIES` is possible but harder to audit.
Prefer the snapshot table if the office needs a precise historical trend.

---

## 8. Data-quality query (optional)

A small audit query gives the Data Quality page a reliable refresh timestamp and
row counts without hard-coding them in the report.

```m
let
    Result = #table(
        {"Projects", "Milestones", "Updates", "RefreshedAt"},
        {
            {
                Table.RowCount(Projects),
                Table.RowCount(Milestones),
                Table.RowCount(Updates),
                DateTime.LocalNow()
            }
        }
    ),
    Typed = Table.TransformColumnTypes(
        Result,
        {
            {"Projects", Int64.Type},
            {"Milestones", Int64.Type},
            {"Updates", Int64.Type},
            {"RefreshedAt", type datetime}
        }
    )
in
    Typed
```

Load this as `Refresh Audit`. Use the counts in cards or a small table, and use
`RefreshedAt` for the refresh timestamp. It is the time Power BI refreshed the
dataset, not the time a user opened the report.

---

## 9. Refresh, credentials, and privacy

| Setting | Recommendation |
| --- | --- |
| **Authentication** | Organizational account (Microsoft Entra ID), not anonymous. |
| **Privacy level** | Organizational. Keep it consistent across SharePoint and any Excel staging sources. |
| **Gateway** | Not required for SharePoint Online. |
| **Refresh** | Twice daily (e.g., 7:00 AM and 1:00 PM PHT) or hourly if the office updates frequently. |
| **Failure alerts** | Enable dataset refresh failure notifications for the workspace owner. |
| **Credentials owner** | Use a service account or a dedicated planning account with read access to the site, not a personal account that may leave. |

### SharePoint list threshold

SharePoint list views have a 5,000-item threshold. The Projects and Milestones
lists are far below it. The Updates Log can approach it over time.

- Keep indexed columns on `Project`, `UpdateDate`, and `Modified`.
- Archive updates older than 24–36 months to a separate list or document library.
- Power BI can paginate past 5,000 items, but refresh time and reliability degrade.
- If the Updates Log grows beyond ~20,000 rows, move the history to a SQL table or
  a Fabric Lakehouse and keep only the recent 24 months in SharePoint.

### Time zones

SharePoint stores date/time values in UTC. The connector may present them as UTC
or convert them to the local machine time, depending on the environment. Before
publishing:

1. Edit a known item at a known PHT time.
2. Refresh the query and compare `Modified` with the edit time.
3. If the value is UTC, add eight hours for PHT display:

```m
AddedPHT = Table.AddColumn(
    Typed,
    "Modified PHT",
    each [Modified] + #duration(0, 8, 0, 0),
    type datetime
)
```

Do this once, in one place, and document it. Do not add eight hours in DAX as well.
Date-only fields (`StartDate`, `TargetEndDate`, `DueDate`) do not need adjustment.

---

## 10. Validation in Power Query

Add a temporary validation query or use the Data Quality page to check:

- [ ] `Table.RowCount(Projects)` is greater than zero and matches the expected
      portfolio count.
- [ ] `ProjectID` has no blanks and no duplicates.
- [ ] `Status` contains only the six approved values.
- [ ] `Program` and `Office` contain only approved choices.
- [ ] `PercentComplete` is between 0 and 100.
- [ ] `TargetEndDate` is not before `StartDate`.
- [ ] `Completed` rows have `ActualEndDate` and 100%.
- [ ] Every `Milestones[ProjectItemID]` exists in `Projects[ProjectItemID]`.
- [ ] Every `Updates[ProjectItemID]` exists in `Projects[ProjectItemID]`.
- [ ] No lookup expansion produced a null `ProjectItemID`.

A quick orphan check in Power Query:

```m
let
    ProjectIDs = Projects[ProjectItemID],
    OrphanMilestones = Table.SelectRows(
        Milestones,
        each not List.Contains(ProjectIDs, [ProjectItemID])
    )
in
    OrphanMilestones
```

If this returns rows, fix the source data before publishing. Do not hide orphan
records with an inner join; they usually indicate a deleted project or a broken
lookup.

---

## 11. Load settings

- **Projects**, **Milestones**, **Updates**, **Date** → load to the model.
- Disable **Auto date/time** in Power BI options; the explicit `Date` table is the
  only date table.
- Do not enable **Include in report refresh** for staging queries that are not
  loaded.
- Rename queries to the short names above before creating relationships.
- Set data categories: `ProjectURL` / `MilestoneURL` / `UpdateURL` → **Web URL**.
- Set `ProjectItemID` as the key and hide it from report view after creating
  relationships.
- Format budgets as **Currency**, locale **Philippines**, symbol **₱**.
- Format `PercentComplete` and `PercentAtUpdate` as whole numbers with a `%`
  suffix only if the value is stored 0–100. The DAX measures divide by 100 where a
  true percentage is needed.
