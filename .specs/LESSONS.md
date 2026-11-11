# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Prove a stored value by calling the app function that writes it, never by recomputing it inside the test
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `auth` · harmful: 0
- features: coach-virtual
- evidence: C4 lib/domain/auth.test.ts (auth)
- last seen: 2026-11-11T00:12:34Z

### L-002 - When a criterion lists the fields a row shows, assert every listed field per row, not just one identifying field
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: coach-virtual
- evidence: C17 e2e/dashboard.spec.ts (e2e)
- last seen: 2026-11-11T00:12:34Z

### L-003 - When a criterion says one value appears beside another, assert both values in the same element
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: coach-virtual
- evidence: C19 e2e/dashboard.spec.ts (e2e)
- last seen: 2026-11-11T00:12:34Z

### L-004 - To prove an effect happens before rendering, assert the rendered page shows the changed values, not just that a record exists
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: coach-virtual
- evidence: C20 e2e/dashboard.spec.ts (e2e)
- last seen: 2026-11-11T00:12:35Z

### L-005 - Give excluded rows fixture values that would change the result if they were wrongly included
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: coach-virtual
- evidence: C27 lib/domain/weekly-adjustment.test.ts (domain)
- last seen: 2026-11-11T00:12:35Z

### L-006 - Prove a derived formula at two or more inputs and for every output the criterion names, not one table row
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: coach-virtual
- evidence: C15 lib/domain/vdot.test.ts (domain)
- last seen: 2026-11-11T00:12:35Z

### L-007 - Pin date-boundary rules to a test at the boundary day itself, and state whether an end date is inclusive
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: coach-virtual
- evidence: SPEC_DEVIATION lib/domain/weekly-adjustment.ts isWeekDue (domain)
- last seen: 2026-11-11T00:12:35Z

### L-008 - Test a numeric limit on both sides of the boundary, not one case far from it
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: gestao-de-planos
- evidence: C29 plan-lifecycle.test.ts editPlan refuses a race date (domain)
- last seen: 2026-11-11T05:10:02Z

### L-009 - Assert a layout rule by measuring the element it names, never by excluding that element from the check
- signal: `weak_test` · recurrence: 1 feature(s) · scope: `e2e` · harmful: 0
- features: gestao-de-planos
- evidence: C36 e2e/plans.spec.ts history tabs (e2e)
- last seen: 2026-11-11T05:10:02Z

### L-010 - When rows can be deleted, match related rows by key such as date, never by list position
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `domain` · harmful: 0
- features: gestao-de-planos
- evidence: DEL-12/DEL-13 weekly-adjustment.ts applyDecision maintain (domain)
- last seen: 2026-11-11T05:10:02Z

### L-011 - Count user text length in graphemes after NFC, not in UTF-16 units
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `validation` · harmful: 0
- features: gestao-de-planos
- evidence: NOTE-02 workout-log.ts parseNotes (validation)
- last seen: 2026-11-11T05:10:02Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
