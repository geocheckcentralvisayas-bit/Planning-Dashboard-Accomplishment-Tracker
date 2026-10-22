# DAX Measure Library

This is the measure layer for the Power BI model. It assumes the table and column
names produced by the Power Query queries in
[`POWER_QUERY_M.md`](POWER_QUERY_M.md):

| Table | Key columns used here |
| --- | --- |
| `Projects` | `ProjectItemID`, `ProjectID`, `ProjectName`, `Program`, `Office`, `ProjectLead`, `ProjectLeadEmail`, `Phase`, `Status`, `RiskLevel`, `StartDate`, `TargetEndDate`, `ActualEndDate`, `PercentComplete` (0–100), `BudgetApproved`, `BudgetUtilized`, `Modified` |
| `Milestones` | `ProjectItemID`, `MilestoneName`, `DueDate`, `Status`, `CompletionDate` |
| `Updates` | `ProjectItemID`, `UpdateDate`, `StatusAtUpdate`, `PercentAtUpdate` (0–100), `UpdateAuthor` |
| `Date` | `Date`, `Year`, `Quarter`, `Month`, `Month Year` |

Create a dedicated measure table called **`_Measures`** and organize measures into
display folders. Hide all key columns from report view after relationships are
built.

> **Percentage convention:** source percentages are stored as 0–100 (matching the
> SharePoint number columns). Measures that represent a rate return a fraction
> between 0 and 1. Format them as **Percentage, 1 decimal**. Counts and currency
> are formatted separately.

---

## 1. Reporting date

Use a single reporting-date measure everywhere. This makes it possible to switch
from a live view to a frozen audit snapshot later.

```dax
Reporting Date = TODAY()
```

For a fixed demonstration or a month-end audit copy, replace `TODAY()` with a
date:

```dax
Reporting Date = DATE ( 2026, 10, 22 )
```

```dax
Reporting Date Label =
FORMAT ( [Reporting Date], "MMMM D, YYYY" )
```

Use `[Reporting Date]` instead of `TODAY()` in every other measure so the report
behaves consistently when the date is frozen.

---

## 2. Portfolio counts

```dax
Total Projects =
COUNTROWS ( Projects )
```

```dax
Active Projects =
CALCULATE (
    [Total Projects],
    FILTER (
        Projects,
        NOT ( Projects[Status] IN { "Completed", "Cancelled" } )
    )
)
```

```dax
Completed Projects =
CALCULATE (
    [Total Projects],
    Projects[Status] = "Completed"
)
```

```dax
Cancelled Projects =
CALCULATE (
    [Total Projects],
    Projects[Status] = "Cancelled"
)
```

```dax
On Track Projects =
CALCULATE ( [Total Projects], Projects[Status] = "On Track" )
```

```dax
At Risk Projects =
CALCULATE ( [Total Projects], Projects[Status] = "At Risk" )
```

```dax
Delayed Projects =
CALCULATE ( [Total Projects], Projects[Status] = "Delayed" )
```

```dax
Not Started Projects =
CALCULATE ( [Total Projects], Projects[Status] = "Not Started" )
```

```dax
% of Portfolio =
DIVIDE (
    [Total Projects],
    CALCULATE ( [Total Projects], REMOVEFILTERS ( Projects[Status] ) )
)
```

Use `% of Portfolio` in the status donut or stacked bar. It respects Program and
Office slicers but not the Status filter.

```dax
Programs in View =
DISTINCTCOUNT ( Projects[Program] )
```

---

## 3. Progress and budget

```dax
Average Completion % =
DIVIDE (
    AVERAGEX (
        FILTER (
            Projects,
            NOT ( Projects[Status] IN { "Completed", "Cancelled", "Not Started" } )
        ),
        Projects[PercentComplete]
    ),
    100
)
```

For a single project row, use:

```dax
Project Completion % =
DIVIDE ( MAX ( Projects[PercentComplete] ), 100 )
```

Budget totals exclude cancelled projects. Completed spend remains in the totals
because it is real expenditure.

```dax
Budget Approved =
CALCULATE (
    SUM ( Projects[BudgetApproved] ),
    Projects[Status] <> "Cancelled"
)
```

```dax
Budget Utilized =
CALCULATE (
    SUM ( Projects[BudgetUtilized] ),
    Projects[Status] <> "Cancelled"
)
```

```dax
Budget Utilization % =
DIVIDE ( [Budget Utilized], [Budget Approved] )
```

```dax
Budget Remaining =
[Budget Approved] - [Budget Utilized]
```

```dax
Projects Over Budget =
CALCULATE (
    [Total Projects],
    FILTER (
        Projects,
        Projects[BudgetUtilized] > Projects[BudgetApproved]
            && Projects[Status] <> "Cancelled"
    )
)
```

```dax
Budget Variance % =
DIVIDE ( [Budget Utilized] - [Budget Approved], [Budget Approved] )
```

A positive variance means utilized exceeds approved; treat it as a flag, not
necessarily an error.

---

## 4. Schedule performance

```dax
Days to Target =
VAR TargetDate = MAX ( Projects[TargetEndDate] )
RETURN
    IF (
        NOT ISBLANK ( TargetDate ),
        DATEDIFF ( [Reporting Date], TargetDate, DAY )
    )
```

Use `Days to Target` only in a project-level table or card. At portfolio level it
returns the farthest target date, which is not meaningful.

```dax
Project Expected % =
VAR AsOf = [Reporting Date]
VAR Status = MAX ( Projects[Status] )
VAR StartDate = MAX ( Projects[StartDate] )
VAR TargetDate = MAX ( Projects[TargetEndDate] )
VAR Duration = DATEDIFF ( StartDate, TargetDate, DAY )
VAR Elapsed = DATEDIFF ( StartDate, AsOf, DAY )
RETURN
    SWITCH (
        TRUE (),
        Status = "Completed", 1,
        Status = "Cancelled", BLANK (),
        ISBLANK ( StartDate ) || ISBLANK ( TargetDate ) || Duration <= 0, BLANK (),
        DIVIDE ( MIN ( MAX ( Elapsed, 0 ), Duration ), Duration )
    )
```

This is a linear schedule assumption. It is a planning heuristic, not an earned
value calculation. If the office uses weighted deliverables, replace the linear
elapsed-time model with milestone weighting.

```dax
Project Schedule Variance =
[Project Completion %] - [Project Expected %]
```

```dax
Portfolio Schedule Variance =
AVERAGEX (
    FILTER (
        Projects,
        NOT ( Projects[Status] IN { "Completed", "Cancelled", "Not Started" } )
    ),
    [Project Schedule Variance]
)
```

```dax
Schedule Performance Index =
DIVIDE ( [Project Completion %], [Project Expected %] )
```

An SPI below 1.0 means progress is behind the elapsed-time plan. Use it as a
supporting indicator, not a hard rule.

```dax
Overdue Projects =
VAR AsOf = [Reporting Date]
RETURN
    CALCULATE (
        [Total Projects],
        FILTER (
            Projects,
            NOT ( Projects[Status] IN { "Completed", "Cancelled" } )
                && Projects[TargetEndDate] < AsOf
        )
    )
```

```dax
Overdue Project % =
DIVIDE ( [Overdue Projects], [Active Projects] )
```

```dax
On-Time Completion % =
VAR Completed =
    FILTER (
        Projects,
        Projects[Status] = "Completed"
            && NOT ISBLANK ( Projects[ActualEndDate] )
    )
VAR OnTime =
    FILTER (
        Completed,
        Projects[ActualEndDate] <= Projects[TargetEndDate]
    )
RETURN
    DIVIDE ( COUNTROWS ( OnTime ), COUNTROWS ( Completed ) )
```

```dax
Average Days Late (Completed) =
VAR Completed =
    FILTER (
        Projects,
        Projects[Status] = "Completed"
            && NOT ISBLANK ( Projects[ActualEndDate] )
    )
RETURN
    AVERAGEX (
        Completed,
        MAX ( 0, DATEDIFF ( Projects[TargetEndDate], Projects[ActualEndDate], DAY ) )
    )
```

---

## 5. Milestones

```dax
Total Milestones =
COUNTROWS ( Milestones )
```

```dax
Required Milestones =
CALCULATE (
    [Total Milestones],
    Milestones[Status] <> "Cancelled"
)
```

```dax
Completed Milestones =
CALCULATE (
    [Total Milestones],
    Milestones[Status] = "Completed"
)
```

```dax
Overdue Milestones =
VAR AsOf = [Reporting Date]
RETURN
    CALCULATE (
        [Total Milestones],
        FILTER (
            Milestones,
            NOT ( Milestones[Status] IN { "Completed", "Cancelled" } )
                && Milestones[DueDate] < AsOf
        )
    )
```

```dax
Milestones Due =
CALCULATE (
    [Total Milestones],
    FILTER (
        Milestones,
        Milestones[Status] <> "Cancelled"
            && Milestones[DueDate] <= [Reporting Date]
    )
)
```

```dax
Milestone Completion % =
DIVIDE ( [Completed Milestones], [Required Milestones] )
```

Cancelled milestones are retained for audit but excluded from the completion and
timeliness denominators. `Total Milestones` still reconciles to the SharePoint
list.

```dax
Milestone Timeliness % =
1 - DIVIDE ( [Overdue Milestones], [Milestones Due], 0 )
```

```dax
Milestones Due Next 30 Days =
VAR AsOf = [Reporting Date]
RETURN
    CALCULATE (
        [Total Milestones],
        FILTER (
            Milestones,
            NOT ( Milestones[Status] IN { "Completed", "Cancelled" } )
                && Milestones[DueDate] >= AsOf
                && Milestones[DueDate] <= AsOf + 30
        )
    )
```

```dax
Milestones Due Next 60 Days =
VAR AsOf = [Reporting Date]
RETURN
    CALCULATE (
        [Total Milestones],
        FILTER (
            Milestones,
            NOT ( Milestones[Status] IN { "Completed", "Cancelled" } )
                && Milestones[DueDate] >= AsOf
                && Milestones[DueDate] <= AsOf + 60
        )
    )
```

```dax
Milestone On-Time Completion % =
VAR Completed =
    FILTER (
        Milestones,
        Milestones[Status] = "Completed"
            && NOT ISBLANK ( Milestones[CompletionDate] )
    )
VAR OnTime =
    FILTER (
        Completed,
        Milestones[CompletionDate] <= Milestones[DueDate]
    )
RETURN
    DIVIDE ( COUNTROWS ( OnTime ), COUNTROWS ( Completed ) )
```

---

## 6. Data quality

The freshness measure uses `Projects[Modified]`. This is correct **if** the Updates
Log sync flow updates the project row whenever a status update is logged. If the
office only adds to the Updates Log, replace `Projects[Modified]` with the latest
related update date shown below.

```dax
Last Status Update =
VAR LastUpdate =
    MAXX ( RELATEDTABLE ( Updates ), Updates[UpdateDate] )
RETURN
    IF ( ISBLANK ( LastUpdate ), MAX ( Projects[Modified] ), LastUpdate )
```

```dax
Stale Projects =
VAR AsOf = [Reporting Date]
VAR Threshold = AsOf - 14
RETURN
    CALCULATE (
        [Total Projects],
        FILTER (
            Projects,
            NOT ( Projects[Status] IN { "Completed", "Cancelled" } )
                && Projects[Modified] < Threshold
        )
    )
```

If using `Last Status Update`:

```dax
Stale Projects (Update-Based) =
VAR AsOf = [Reporting Date]
VAR Threshold = AsOf - 14
RETURN
    COUNTROWS (
        FILTER (
            Projects,
            NOT ( Projects[Status] IN { "Completed", "Cancelled" } )
                && [Last Status Update] < Threshold
        )
    )
```

```dax
Update Compliance % =
DIVIDE ( [Active Projects] - [Stale Projects], [Active Projects] )
```

```dax
Incomplete Projects =
CALCULATE (
    [Total Projects],
    FILTER (
        Projects,
        ISBLANK ( Projects[Remarks] )
            || ISBLANK ( Projects[ProjectLead] )
            || Projects[BudgetApproved] <= 0
            || (
                Projects[Status] = "Completed"
                    && ISBLANK ( Projects[ActualEndDate] )
            )
    )
)
```

```dax
Record Completeness % =
1 - DIVIDE ( [Incomplete Projects], [Total Projects], 0 )
```

```dax
Cancelled Budget Exposure =
CALCULATE (
    SUM ( Projects[BudgetUtilized] ),
    Projects[Status] = "Cancelled"
)
```

This is useful context on the Data Quality page: cancelled projects may still have
sunk costs.

### Composite health score

This mirrors the React prototype: freshness 30%, milestone timeliness 25%, record
completeness 25%, schedule adherence 20%.

```dax
Portfolio Health Score =
VAR Freshness = [Update Compliance %]
VAR Timeliness = [Milestone Timeliness %]
VAR Completeness = [Record Completeness %]
VAR ScheduleAdherence =
    1 - DIVIDE ( [Overdue Projects], [Active Projects], 0 )
RETURN
    ROUND (
        100 * (
            0.30 * Freshness
                + 0.25 * Timeliness
                + 0.25 * Completeness
                + 0.20 * ScheduleAdherence
        ),
        0
    )
```

Guard against a blank ratio when a filter yields no active projects. `DIVIDE` with
an alternate result handles zero denominators; the score will be 100 for an empty
selection, which is acceptable for a card that is hidden when no data is selected.

---

## 7. RAG status and colors

```dax
Project RAG =
VAR Status = MAX ( Projects[Status] )
VAR TargetDate = MAX ( Projects[TargetEndDate] )
VAR IsOverdue =
    TargetDate < [Reporting Date]
        && NOT ( Status IN { "Completed", "Cancelled" } )
RETURN
    SWITCH (
        TRUE (),
        Status IN { "Completed", "Cancelled" }, Status,
        IsOverdue, "Overdue",
        Status
    )
```

Use `Project RAG` in a table rather than a plain Status column when you want
overdue active projects to read as "Overdue" even if their stored status is still
"On Track".

```dax
RAG Color =
SWITCH (
    [Project RAG],
    "Delayed", "#DC2626",
    "Overdue", "#DC2626",
    "At Risk", "#D97706",
    "On Track", "#16A34A",
    "Completed", "#0891B2",
    "Not Started", "#94A3B8",
    "Cancelled", "#94A3B8",
    "#94A3B8"
)
```

For a visual that uses the raw `Projects[Status]` field (status donut, stacked
bar), use a separate measure so "Overdue" does not replace the stored status:

```dax
Status Color =
SWITCH (
    SELECTEDVALUE ( Projects[Status] ),
    "On Track", "#16A34A",
    "At Risk", "#D97706",
    "Delayed", "#DC2626",
    "Completed", "#0891B2",
    "Not Started", "#94A3B8",
    "Cancelled", "#6B7280",
    "#94A3B8"
)
```

To color a table row or status pill:

1. Select the visual → **Format** → **Cell elements** → **Background color**.
2. Choose **Format by** → **Field value**.
3. Select `RAG Color`.
4. Use a light tint by adding transparency in the visual settings, or create a
   second measure returning a pale background color.

```dax
Portfolio RAG =
VAR Score = [Portfolio Health Score]
RETURN
    SWITCH (
        TRUE (),
        Score >= 80, "Green",
        Score >= 60, "Amber",
        "Red"
    )
```

```dax
Portfolio RAG Color =
SWITCH (
    [Portfolio RAG],
    "Green", "#16A34A",
    "Amber", "#D97706",
    "Red", "#DC2626",
    "#94A3B8"
)
```

---

## 8. Dynamic titles and labels

```dax
Program Label =
IF (
    ISFILTERED ( Projects[Program] ),
    SELECTEDVALUE ( Projects[Program], "Multiple programs" ),
    "All programs"
)
```

```dax
Office Label =
IF (
    ISFILTERED ( Projects[Office] ),
    SELECTEDVALUE ( Projects[Office], "Multiple offices" ),
    "All offices"
)
```

```dax
Status Label =
IF (
    ISFILTERED ( Projects[Status] ),
    SELECTEDVALUE ( Projects[Status], "Multiple statuses" ),
    "All statuses"
)
```

```dax
Portfolio Headline =
"Planning Portfolio · " & [Program Label] & " · as of " & [Reporting Date Label]
```

Use the headline measure in a card or a text box with a dynamic field. Avoid
building titles by concatenating slicer values in static text; they will go stale.

---

## 9. Trend measures

The report can show a planned line and an actual line by month. The planned line is
straightforward. The actual line requires the latest update per project at each
month-end.

### Planned completion at the selected date

```dax
Planned % at Date =
VAR AsOf = MAX ( Date[Date] )
RETURN
    AVERAGEX (
        FILTER (
            Projects,
            Projects[StartDate] <= AsOf
                && Projects[Status] <> "Cancelled"
        ),
        VAR StartDate = Projects[StartDate]
        VAR TargetDate = Projects[TargetEndDate]
        VAR Duration = DATEDIFF ( StartDate, TargetDate, DAY )
        VAR Elapsed = DATEDIFF ( StartDate, AsOf, DAY )
        RETURN
            DIVIDE (
                MIN ( MAX ( Elapsed, 0 ), Duration ),
                Duration
            )
    )
```

### Actual completion at the selected date

```dax
Actual % at Date =
VAR AsOf = MAX ( Date[Date] )
VAR ProjectRows =
    ADDCOLUMNS (
        FILTER (
            Projects,
            Projects[StartDate] <= AsOf
                && Projects[Status] <> "Cancelled"
        ),
        "@LatestPercent",
            VAR ThisProject = Projects[ProjectItemID]
            VAR LatestDate =
                CALCULATE (
                    MAX ( Updates[UpdateDate] ),
                    FILTER (
                        Updates,
                        Updates[ProjectItemID] = ThisProject
                            && Updates[UpdateDate] <= AsOf
                    )
                )
            RETURN
                CALCULATE (
                    MAX ( Updates[PercentAtUpdate] ),
                    FILTER (
                        Updates,
                        Updates[ProjectItemID] = ThisProject
                            && Updates[UpdateDate] = LatestDate
                    )
                )
    )
RETURN
    DIVIDE (
        SUMX ( ProjectRows, [@LatestPercent] ),
        COUNTROWS ( ProjectRows )
    )
```

Plot both measures on a line chart using `Date[Month Year]` on the axis. Format
them as percentages, with `Planned % at Date` as a dashed line.

> **Performance note:** `Actual % at Date` iterates projects and updates for each
> month in the visual. For a 50-project, 36-month portfolio it is acceptable. For
> larger portfolios, build the monthly snapshot table described in
> [`POWER_QUERY_M.md`](POWER_QUERY_M.md), or move the model to a star schema with a
> precomputed monthly fact.

If the trend is not essential for v1, ship the executive page without it and add
the snapshot in phase 2.

---

## 10. Time intelligence

These measures require inactive relationships from `Date[Date]` to
`Projects[StartDate]` and `Projects[ActualEndDate]`, and the `Date` table marked
as a date table. The active relationship is `Date[Date]` → `Projects[TargetEndDate]`.

```dax
Projects Started =
CALCULATE (
    [Total Projects],
    USERELATIONSHIP ( Projects[StartDate], Date[Date] ),
    Projects[Status] <> "Cancelled"
)
```

```dax
Projects Started YTD =
CALCULATE (
    [Total Projects],
    USERELATIONSHIP ( Projects[StartDate], Date[Date] ),
    DATESYTD ( Date[Date] ),
    Projects[Status] <> "Cancelled"
)
```

```dax
Projects Completed =
CALCULATE (
    [Total Projects],
    USERELATIONSHIP ( Projects[ActualEndDate], Date[Date] ),
    Projects[Status] = "Completed"
)
```

```dax
Projects Completed YTD =
CALCULATE (
    [Total Projects],
    USERELATIONSHIP ( Projects[ActualEndDate], Date[Date] ),
    DATESYTD ( Date[Date] ),
    Projects[Status] = "Completed"
)
```

If the report only needs a small number of time-intelligence cards, consider
computing them with direct date filters instead of adding inactive relationships.
The relationships are worth it only if a Date slicer or a time hierarchy is used
in several visuals.

---

## 11. Row-level security

Create roles in **Modeling → Manage roles**.

### Role: Planning Admins

No filter. Members see everything.

### Role: Project Leads

Filter on `Projects`:

```dax
[ProjectLeadEmail] = USERPRINCIPALNAME ()
```

If project leads should also see their milestones and updates, the relationships
from `Projects` to `Milestones` and `Updates` propagate the filter automatically.
Test this in **View as role**.

### Role: Office Leads

A mapping table is cleaner than hard-coding names:

| SecurityMap | |
| --- | --- |
| `UserEmail` | `Office` |
| `lead.air@emb.gov.ph` | Air Quality Management Section |
| `lead.water@emb.gov.ph` | Water Quality Management Section |

Filter on `Projects`:

```dax
Projects[Office] IN
CALCULATETABLE (
    VALUES ( SecurityMap[Office] ),
    SecurityMap[UserEmail] = USERPRINCIPALNAME ()
)
```

Hide the `SecurityMap` table from report view and do not use it in visuals.

### Role: Executives

No filter, or a filter that excludes `Cancelled` projects if executives only want
the active portfolio. Prefer no filter and let the report's default slicer exclude
cancelled rows; the audit view may still need them.

> **RLS testing:** use **View as role** in Power BI Desktop, then test the
> published app with a real account in each role. RLS does not apply to workspace
> members with edit permissions; use a viewer account for the test.

---

## 12. Measure formatting reference

| Measure type | Format | Example |
| --- | --- | --- |
| Counts | Whole number, thousands separator | `1,284` |
| Currency | Currency, `₱`, 0 decimals | `₱102,400,000` |
| Percent rate | Percentage, 1 decimal | `64.8%` |
| Percentage points | Decimal, 1 decimal, suffix `pp` | `-12.4 pp` |
| Days | Whole number | `53` |
| Dates | `mmm d, yyyy` | `Oct 22, 2026` |
| Health score | Whole number, 0–100 | `80` |

For percentage-point variance measures, use a custom format such as
`0.0" pp"` and return the difference of two fractions multiplied by 100:

```dax
Schedule Variance (pp) =
( [Project Completion %] - [Project Expected %] ) * 100
```

Do not mix fraction and 0–100 values in the same visual. Pick one convention per
measure and keep the format consistent.
