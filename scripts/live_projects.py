#!/usr/bin/env python3
r"""Derive the real planning portfolio from the accomplishment workbook.

The workbook's `Main (for CO)` sheet is an FY2026 matrix:

    A: SECTION/UNIT            -> the 15 EMB Region 7 units
    B: PROGRAM/PROJECTS/ACT.   -> the activity group (the "project")
    C: PERFORMANCE INDICATORS  -> the measurable line
    D..O: MONTHLY TARGET (Jan..Dec)
    R..AC: MONTHLY ACCOMPLISHMENTS (Jan..Dec)

This module groups the indicator lines back into their activity groups and
derives, from the workbook only:

  * status and risk from the target/actual attainment,
  * quarterly checkpoints (milestones) from the monthly target columns,
  * a monthly progress series (updates) from the monthly actual columns,
  * the fiscal-year window that the workbook itself defines.

No figure in the output is invented. Budgets, phases, and update logs are not
present in the workbook, so they are not fabricated here.
"""

from __future__ import annotations

import re
from collections import OrderedDict
from typing import Any

MONTHS_SHORT = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]

QUARTERS = [
    ("Q1 target (Jan-Mar)", 0, 3, "03-31"),
    ("Q2 target (Apr-Jun)", 3, 6, "06-30"),
    ("Q3 target (Jul-Sep)", 6, 9, "09-30"),
    ("Q4 target (Oct-Dec)", 9, 12, "12-31"),
    ("Full-year target", 0, 12, "12-31"),
]

FISCAL_START = "2026-01-01"
FISCAL_END = "2026-12-31"

# Ordered status vocabulary shared with the dashboard.
STATUS_ON_TRACK = "On Track"
STATUS_AT_RISK = "At Risk"
STATUS_DELAYED = "Delayed"
STATUS_COMPLETED = "Completed"
STATUS_NOT_STARTED = "Not Started"
STATUS_NO_TARGET = "No Target"
STATUS_UNPLANNED = "Unplanned"


def _clean_name(value: str) -> str:
    """Collapse the workbook's multi-line activity labels into one line."""
    return re.sub(r"\s+", " ", value).strip(" -–—•\t")


def _risk_for(rate: float | None, status: str) -> str:
    """Derive a risk band from the recorded attainment.

    This is a reading of the workbook numbers, not a separate judgement: a
    unit already below 70% of its year-to-date target is a delivery risk.
    """
    if status == STATUS_COMPLETED:
        return "Low"
    if rate is None:
        return "Medium"
    if rate >= 0.9:
        return "Low"
    if rate >= 0.7:
        return "Medium"
    return "High"


def _status_for(
    annual_target: float,
    annual_actual: float,
    ytd_target: float,
    ytd_rate: float | None,
) -> str:
    if annual_target <= 0.0001 and annual_actual > 0.0001:
        return STATUS_UNPLANNED
    if annual_target <= 0.0001:
        return STATUS_NO_TARGET
    if annual_actual >= annual_target:
        return STATUS_COMPLETED
    if ytd_target <= 0.0001:
        return STATUS_NOT_STARTED
    if ytd_rate is not None and ytd_rate >= 0.9:
        return STATUS_ON_TRACK
    if ytd_rate is not None and ytd_rate >= 0.7:
        return STATUS_AT_RISK
    return STATUS_DELAYED


def build_projects(
    records: list[dict[str, Any]],
    reporting_index: int,
    reporting_year: int,
) -> list[dict[str, Any]]:
    """Group indicator lines into their activity groups.

    ``records`` are the already-normalised indicator rows produced by the
    caller. Each record carries ``section``, ``project`` and the monthly
    target/actual vectors.
    """
    groups: "OrderedDict[tuple[str, str], list[dict[str, Any]]]" = OrderedDict()
    for record in records:
        key = (record["section"], record["project"])
        groups.setdefault(key, []).append(record)

    projects: list[dict[str, Any]] = []
    for index, ((section, program), items) in enumerate(groups.items(), start=1):
        program_name = _clean_name(program)
        if not program_name:
            program_name = f"{section} — general indicators"

        targets = [0.0] * 12
        actuals = [0.0] * 12
        for item in items:
            for month in range(12):
                targets[month] += item["targets"][month]
                actuals[month] += item["actuals"][month]

        ytd_target = round(sum(targets[: reporting_index + 1]), 2)
        ytd_actual = round(sum(actuals[: reporting_index + 1]), 2)
        annual_target = round(sum(targets), 2)
        annual_actual = round(sum(actuals), 2)

        ytd_rate = ytd_actual / ytd_target if ytd_target > 0.0001 else None
        annual_rate = (
            annual_actual / annual_target if annual_target > 0.0001 else None
        )
        status = _status_for(annual_target, annual_actual, ytd_target, ytd_rate)
        risk = _risk_for(ytd_rate, status)

        reported = [m for m in range(12) if actuals[m] > 0.0001]
        last_reported = reported[-1] if reported else None
        last_reported_label = (
            f"{MONTHS_SHORT[last_reported]} {reporting_year}"
            if last_reported is not None
            else "No accomplishment"
        )
        last_updated = (
            _month_end(reporting_year, last_reported)
            if last_reported is not None
            else FISCAL_START
        )

        remarks = " / ".join(
            dict.fromkeys(item["remarks"] for item in items if item["remarks"])
        )
        mov = " / ".join(
            dict.fromkeys(item["mov"] for item in items if item["mov"])
        )

        flags: list[str] = []
        if annual_target <= 0.0001:
            flags.append("No target")
        elif annual_actual <= 0.0001:
            flags.append("No accomplishment")
        if not remarks:
            flags.append("Missing remarks")
        if not mov:
            flags.append("Missing MOV")

        months = []
        for month in range(12):
            target = round(targets[month], 2)
            actual = round(actuals[month], 2)
            months.append(
                {
                    "label": MONTHS_SHORT[month],
                    "target": target,
                    "actual": actual,
                    "met": bool(target > 0.0001 and actual >= target),
                    "future": month > reporting_index,
                }
            )

        milestones = []
        for q_index, (name, start, end, due) in enumerate(QUARTERS, start=1):
            q_target = round(sum(targets[start:end]), 2)
            q_actual = round(sum(actuals[start:end]), 2)
            due_date = f"{reporting_year}-{due}"
            quarter_ended = (end - 1) <= reporting_index
            if q_target <= 0.0001:
                milestone_status = "Pending"
            elif q_actual >= q_target:
                milestone_status = "Completed"
            elif quarter_ended:
                milestone_status = "Overdue"
            else:
                milestone_status = "Pending"
            milestones.append(
                {
                    "id": f"PRG-{index:03d}-M{q_index}",
                    "name": name,
                    "dueDate": due_date,
                    "status": milestone_status,
                    "target": q_target,
                    "actual": q_actual,
                }
            )

        updates = []
        cumulative_target = 0.0
        cumulative_actual = 0.0
        for month in range(reporting_index + 1):
            cumulative_target += targets[month]
            cumulative_actual += actuals[month]
            if targets[month] <= 0.0001 and actuals[month] <= 0.0001:
                continue
            percent = (
                min(100, int(round((cumulative_actual / cumulative_target) * 100)))
                if cumulative_target > 0.0001
                else 0
            )
            updates.append(
                {
                    "id": f"PRG-{index:03d}-U{month + 1}",
                    "date": _month_end(reporting_year, month),
                    "percent": percent,
                    "status": status,
                    "remarks": f"{MONTHS_SHORT[month]} {reporting_year} reporting",
                }
            )

        projects.append(
            {
                "id": f"PRG-{index:03d}",
                "name": program_name,
                "section": section,
                "unit": section,
                "lead": next((item["lead"] for item in items if item["lead"]), ""),
                "status": status,
                "risk": risk,
                "startDate": FISCAL_START,
                "targetEndDate": FISCAL_END,
                "percentComplete": (
                    min(100, int(round(ytd_rate * 100))) if ytd_rate is not None else 0
                ),
                "indicatorCount": len(items),
                "indicators": [item["indicator"] for item in items],
                "annualTarget": annual_target,
                "annualActual": annual_actual,
                "ytdTarget": ytd_target,
                "ytdActual": ytd_actual,
                "ytdRate": None if ytd_rate is None else round(ytd_rate, 4),
                "annualRate": None if annual_rate is None else round(annual_rate, 4),
                "lastReported": last_reported_label,
                "lastUpdated": last_updated,
                "remarks": remarks,
                "mov": mov,
                "flags": flags,
                "months": months,
                "milestones": milestones,
                "updates": updates,
            }
        )

    return projects


def _month_end(year: int, month_index: int) -> str:
    """Return the ISO date of the last day of a zero-based month."""
    days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    if month_index == 1 and (year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)):
        days[1] = 29
    return f"{year}-{month_index + 1:02d}-{days[month_index]:02d}"
