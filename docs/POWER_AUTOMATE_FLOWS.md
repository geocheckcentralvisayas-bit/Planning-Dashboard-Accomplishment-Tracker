# Power Automate Flows

The SharePoint lists are the source of truth. Power Automate keeps them consistent
and nudges people when updates are missing. This document specifies the five core
flows and one optional refresh flow.

All flows assume the lists and columns in
[`DATA_DICTIONARY.md`](DATA_DICTIONARY.md). Build them in a **staging site** first,
then export them as part of a managed solution.

---

## 0. Shared setup

### Connections

Use a **service account** (e.g., `r7planning.automation@emb.gov.ph`) for all
SharePoint connections, not a personal account. Grant it:

- **Contribute** to Planning Projects, Milestones, and Updates Log.
- **Read** access to the site (minimum).
- Permission to send from the shared planning mailbox or to post to the Teams
  channel.

If the service account cannot send email, use a shared mailbox connection and
document the sender.

### Environment variables

Create solution environment variables so the flows can move from test to
production without editing actions:

| Variable | Example |
| --- | --- |
| `SiteUrl` | `https://embco.sharepoint.com/sites/r7planning` |
| `ProjectsList` | `Planning Projects` |
| `MilestonesList` | `Milestones` |
| `UpdatesList` | `Updates Log` |
| `PlanningInbox` | `r7planning@emb.gov.ph` |
| `ExecutiveDistribution` | `r7-executives@emb.gov.ph` |
| `TeamsChannel` | Planning Updates channel ID |
| `DashboardUrl` | Power BI app or SharePoint page URL |

### Date and time

- Store SharePoint dates in UTC; display them in PHT (UTC+8).
- Use `convertFromUtc(utcNow(), 'Singapore Standard Time', 'yyyy-MM-dd')` for
  date comparisons and messages. The Windows time zone ID for PHT is
  **Singapore Standard Time**.
- Use `formatDateTime(..., 'MMMM d, yyyy')` for readable dates.
- Do not compare dates as raw strings unless both are normalized to ISO 8601.

### Error handling pattern

For each flow:

1. Put the main actions in a **Scope**.
2. Add a parallel branch with **Configure run after** → has failed / timed out.
3. In the failure branch, send a short email to the planning inbox with the flow
   name, item ID, and a link to the run history.
4. End with **Terminate** → Failed if the failure should be visible in run history.

Do not let a failed reminder silently stop the weekly digest.

---

## 1. Flow — Sync latest update to the project

**Purpose:** When staff add an entry to the Updates Log, copy the current status,
progress, and remarks to the project row so the dashboard, tracker, and freshness
checks stay aligned.

**Trigger:** SharePoint — **When an item is created** (Updates Log).

**Actions**

1. **Get the project**
   - SharePoint — Get item
   - Site: `SiteUrl`
   - List: `ProjectsList`
   - Id: the lookup ID from the trigger.
   - In expressions, the lookup is usually:
     ```text
     triggerOutputs()?['body/Project']?['Id']
     ```
     The designer may also expose a "Project Id" dynamic content token. Use
     whichever resolves to the numeric item ID. Do not use the lookup display text.

2. **Condition — the update belongs to an active project**
   - `Status` is not equal to `Completed`
   - AND `Status` is not equal to `Cancelled`
   - If the project is closed, stop the flow with **Terminate → Cancelled**. Do not
     change a closed project from a late log entry.

3. **Update the project**
   - SharePoint — Update item
   - Site: `SiteUrl`
   - List: `ProjectsList`
   - Id: the project item ID
   - Title: leave unchanged
   - Status: `Status at Update`
   - Percent Complete: `Percent at Update`
   - Remarks: `Remarks` from the update
   - Do **not** set `Modified`; SharePoint updates it automatically.
   - Optional: set `StatusAsOf` to `UpdateDate` if you add that field for audit.

4. **Log the sync (optional)**
   - Add a comment to the update item: "Synced to project on [date]".
   - Or write to a small `Automation Log` list. Do not write back to the Updates
     Log in a way that triggers this flow again.

**Why this is safe from loops:** the trigger is on the Updates Log, and the flow
updates the Projects list. It does not create another Updates Log item. If you add
a separate flow that triggers on Projects modified and writes to Updates Log, you
will create a loop. Do not do both.

**Backdated updates:** the flow assumes updates are logged in business-date order.
If staff often enter an older update after a newer one, add a `StatusAsOf` date
column to Projects and only update when:

```text
triggerOutputs()?['body/UpdateDate'] >= body('Get_the_project')?['StatusAsOf']
```

Document the rule in the Updates Log form: "Do not backdate a status update; add a
note to the current update instead."

**Test**

- Add a test update to a test project.
- Confirm the project's Status, Percent Complete, and Remarks change.
- Confirm `Modified` changes.
- Confirm no second update is created.
- Confirm the flow does not run for Completed/Cancelled projects.

---

## 2. Flow — Weekly stale-update reminders

**Purpose:** Every Monday, remind project leads whose active projects have not
been updated in 14 days.

**Trigger:** Schedule — Recurrence, weekly, Monday 8:00 AM PHT.

**Actions**

1. **Get active projects**
   - SharePoint — Get items
   - List: `ProjectsList`
   - Filter query:
     ```text
     Status ne 'Completed' and Status ne 'Cancelled'
     ```
   - Top count: 5000
   - `Include Nested Items`: no, unless needed.

2. **Select stale projects**
   - Use a **Filter array** on the Get items output:
     ```text
     @less(
         item()?['Modified'],
         formatDateTime(addDays(utcNow(), -14), 'yyyy-MM-ddTHH:mm:ssZ')
     )
     ```
   - Or use an OData filter with a dynamic date:
     ```text
     Status ne 'Completed' and Status ne 'Cancelled'
     and Modified lt '@{formatDateTime(addDays(utcNow(), -14), 'yyyy-MM-dd')}'
     ```
   - OData date filtering is supported, but test it in your tenant. The Filter
     array approach is more portable.

3. **Condition — any stale projects?**
   - If no, terminate successfully. Do not send an empty email.

4. **Apply to each stale project**
   - **Get the project lead's email.** The Person field may expose `Email` or
     `Claims`. Use:
     ```text
     coalesce(
         item()?['ProjectLead']?['Email'],
         item()?['ProjectLead']?['Claims'],
         variables('PlanningInbox')
     )
     ```
     If the value is a claims string such as `i:0#.f|membership|name@emb.gov.ph`,
     extract the email or use the Person field's Email property. Test with a real
     item.
   - **Send an email (V2)**:
     - To: project lead email.
     - CC: `PlanningInbox`.
     - Subject:
       ```text
       Action needed: update [Project Name] (last update [date])
       ```
     - Body: a short HTML message with:
       - Project name and ID.
       - Current status and percent complete.
       - Last modified date and days since.
       - A direct link to the project's edit form:
         ```text
         concat(
             variables('SiteUrl'),
             '/Lists/Planning%20Projects/EditForm.aspx?ID=',
             item()?['ID']
         )
         ```
       - A link to the Updates Log list.
       - The 14-day expectation and a one-line "what to update" checklist.
   - **Optional dedupe:** add a `LastReminderSent` date column to Projects. Before
     sending, check that it is blank or older than 7 days; after sending, update it.
     Without this, the same lead receives a reminder every week until they update.
     That may be intended; decide explicitly.

5. **Summary to the planning inbox**
   - After the loop, send one summary email: count of stale projects, list of
     project names, and a link to the Data Quality page.
   - This avoids flooding the inbox with individual copies.

**Test**

- Set the threshold to 0 days on a test list; confirm emails.
- Confirm the edit link opens the right item.
- Confirm Completed/Cancelled projects are excluded.
- Confirm the summary count matches the loop count.

---

## 3. Flow — At-risk / delayed escalation

**Purpose:** Notify the planning lead and division chief when a project becomes
At Risk or Delayed, or when an active project passes its target date.

**Trigger:** SharePoint — **When an item is created or modified** (Planning
Projects).

**Recommended guard:** add a `LastAlertSent` (Date and time) column to Projects,
hidden from the main views. The flow checks it before sending; after sending it
updates the column. The update triggers the flow again, but the guard stops the
second run. This is a controlled two-run pattern, not an infinite loop.

**Actions**

1. **Get the current item** (or use the trigger body).
   - Status, Target End Date, Project Lead, Program, Office, Remarks.

2. **Condition — needs escalation**
   - Status equals `At Risk` OR `Delayed`
   - OR (`Target End Date` is before today AND Status is not `Completed` or
     `Cancelled`)
   - AND (`LastAlertSent` is empty OR older than 7 days).

3. **If yes, send alerts**
   - **Teams — Post message in a chat or channel** to the planning channel:
     - Adaptive Card with project name, status, target date, lead, remarks, link.
     - Mention the project lead and the division chief.
   - **Send an email (V2)** to the project lead, CC the planning inbox and the
     division chief:
     - Subject: `[At Risk] Project Name — action required`.
     - Body: status, target date, current progress, the last remarks, and a link
       to the project.
     - Ask for a mitigation or recovery plan with a date.

4. **Record the alert**
   - Update the project's `LastAlertSent` to `utcNow()`.
   - Optional: add a row to an `Alerts Log` list with project, alert type, date,
     recipients, and a link to the run. The log is useful for audit and avoids
     duplicate alerts.

5. **Close-out**
   - If the status returns to On Track, do not send an all-clear automatically.
     A human should confirm the recovery. Optional: send a low-priority note to the
     planning inbox.

**Escalation tiers**

| Condition | Notify |
| --- | --- |
| At Risk for the first time | Project lead + planning inbox. |
| Delayed, or target date passed | Project lead + division chief + planning inbox. |
| Delayed more than 14 days | Division chief + executive distribution, with a request for a recovery decision. |
| Repeatedly stale (>30 days) | Planning inbox for a data-quality follow-up; do not escalate the project status automatically. |

**Test**

- Change a test project to At Risk; confirm one alert and `LastAlertSent`.
- Change it again within 7 days; confirm no duplicate alert.
- Change it to Delayed after 7 days; confirm a new alert.
- Confirm the Teams link and project edit link work.

---

## 4. Flow — Milestone due reminders

**Purpose:** Remind milestone owners and project leads before a milestone is due.

**Trigger:** Schedule — Recurrence, daily 8:00 AM PHT.

**Actions**

1. **Get milestones due in the next 7 days**
   - SharePoint — Get items
   - List: `MilestonesList`
   - Filter query:
     ```text
     Status ne 'Completed' and Status ne 'Cancelled'
     and DueDate ge '@{formatDateTime(utcNow(), 'yyyy-MM-dd')}'
     and DueDate le '@{formatDateTime(addDays(utcNow(), 7), 'yyyy-MM-dd')}'
     ```
   - If the tenant rejects the date filter, get active milestones and filter in
     Flow with `ticks()`.
2. **For each milestone**
   - Get the related project (lookup ID).
   - Determine the recipient:
     - `Owner.Email` if present;
     - else `ProjectLead.Email`;
     - else `PlanningInbox`.
   - Send an email:
     - Subject: `Milestone due [date]: [Milestone Name]`.
     - Body: project, milestone, due date, status, owner, link to the milestone
       and project.
     - CC the project lead and planning inbox if the owner is different.
3. **Overdue escalation (optional)**
   - A second scheduled flow at 8:05 AM gets milestones with `DueDate < today`
     and status not Completed/Cancelled.
   - Send a daily digest to the planning inbox; do not email the owner every day.
     A weekly cadence is enough.

**Test**

- Create a milestone due in 3 days on a test project; confirm the email.
- Confirm a completed milestone is excluded.
- Confirm an ownerless milestone falls back to the project lead.

---

## 5. Flow — Weekly executive digest

**Purpose:** Give executives a one-page snapshot every Monday without opening the
dashboard.

**Trigger:** Schedule — Recurrence, weekly, Monday 7:00 AM PHT.

**Actions**

1. **Get active projects** (Status not Completed/Cancelled).
2. **Get milestones due/overdue** (next 30 days, plus overdue).
3. **Get updates from the last 7 days** (for a "what changed" section).
4. **Compose the counts**
   - Total active.
   - On Track, At Risk, Delayed.
   - Overdue projects.
   - Budget approved/utilized/utilization.
   - Stale projects (>14 days).
   - Upcoming milestones.
   - Top 3 attention projects (Delayed first, then At Risk, then overdue).
5. **Build an HTML table** for the attention list and upcoming milestones.
   - Keep the email short: counts, top risks, next milestones, and a link to the
     Power BI report.
   - Do not embed the full project table; it will be unreadable on a phone.
6. **Send an email (V2)** to `ExecutiveDistribution`, CC `PlanningInbox`.
   - Subject: `EMB R7 planning digest — week of [date]`.
   - Include a "View the dashboard" button linking to `DashboardUrl`.
   - Include a "Data as of [refresh timestamp]" line.

**Example HTML structure**

```html
<h2>EMB R7 Planning — Weekly Digest</h2>
<p>Week of @{formatDateTime(utcNow(), 'MMMM d, yyyy')}</p>
<table>
  <tr><td>Active projects</td><td>@variables('ActiveCount')</td></tr>
  <tr><td>On Track</td><td>@variables('OnTrackCount')</td></tr>
  <tr><td>At Risk</td><td>@variables('AtRiskCount')</td></tr>
  <tr><td>Delayed</td><td>@variables('DelayedCount')</td></tr>
  <tr><td>Budget utilization</td><td>@variables('BudgetUtilization')</td></tr>
</table>
<h3>Needs attention</h3>
@{variables('AttentionTable')}
<h3>Upcoming milestones</h3>
@{variables('MilestoneTable')}
<p><a href="@{variables('DashboardUrl')}">Open the planning dashboard</a></p>
```

**Test**

- Send to a test distribution list first.
- Check rendering in Outlook desktop, Outlook web, and the mobile app.
- Confirm the dashboard link opens the app, not the workspace.
- Confirm the counts match the Power BI report at the same time.

---

## 6. Flow — Refresh Power BI after updates (optional)

**Purpose:** Refresh the dataset shortly after a status update so the dashboard is
current.

**Options**

1. **Scheduled refresh in Power BI** (recommended): set 2–4 refreshes per day in
   the dataset settings. This is simpler, predictable, and avoids API limits.
2. **Power Automate Power BI action**: use the **Refresh a dataset** action after
   the sync flow, with a delay or a condition. This consumes a Power BI refresh
   and may hit the daily limit, especially on Pro. Use it only for a small number
   of high-value updates, not every row.
3. **Power BI REST API**: `POST /datasets/{datasetId}/refreshes` via a service
   principal or a custom connector. More control, more setup. Not needed for v1.

If you use option 2, add a **Delay** of 2–5 minutes after the project update, then
refresh. Avoid refreshing on every update in a busy list. A scheduled refresh is
almost always the better choice.

---

## 7. Governance checklist

- [ ] Flows are solution-aware and stored in a managed solution for production.
- [ ] Connections use a service account, not a personal account.
- [ ] Environment variables hold site URL, list names, and distribution lists.
- [ ] Each flow has a failure branch that notifies the planning inbox.
- [ ] Run history is retained long enough for audit (28 days by default; export
      critical logs if needed).
- [ ] No flow writes to the Updates Log in response to a Projects update.
- [ ] Reminder thresholds (14 days stale, 7 days before milestone, 7-day alert
      cooldown) are documented and agreed with the office.
- [ ] Emails do not include sensitive remarks beyond the intended audience.
- [ ] The project lead and division chief mapping is maintained.
- [ ] Flows are tested with Completed, Cancelled, Not Started, and ownerless
      records.
- [ ] The weekly digest is reviewed after the first month and adjusted.

### Permissions summary

| Flow | SharePoint | Other |
| --- | --- | --- |
| Sync update | Contribute to Projects and Updates Log | — |
| Stale reminders | Read Projects | Send email / shared mailbox |
| At-risk escalation | Read/Edit Projects (for `LastAlertSent`) | Teams channel, email |
| Milestone reminders | Read Milestones and Projects | Send email |
| Weekly digest | Read all three lists | Send email |
| Refresh (optional) | — | Power BI dataset contributor |

Use the least privilege that still lets the flow complete. A service account with
Site Owner is convenient but broader than necessary; Contribute plus the specific
list permissions is usually enough.
