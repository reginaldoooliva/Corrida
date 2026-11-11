# Gestão de Planos Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk,
check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/gestao-de-planos/design.md`
**Status**: Approved
**Approved**: 2026-11-10 - user: "Sim, o agente aprova (Recomendado)" (delegado ao agente)
**Build**: `npm run build; npm run typecheck; npm run lint`
**Run unit**: `npx vitest run lib/domain --reporter=verbose`

---

## Test Coverage Matrix

> Generated from codebase and project guidelines. Guidelines found: `AGENTS.md`, `CLAUDE.md`,
> `.specs/STATE.md` (`AD-001`, `AD-004`), `vitest.config.ts`, `playwright.config.ts`; test samples
> `lib/domain/plan-lifecycle.test.ts`, `lib/domain/weekly-adjustment.test.ts`, `e2e/settings.spec.ts`,
> `e2e/logging.spec.ts`, `e2e/history.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| `lib/domain/*` (plan-lifecycle, workout-log) | unit | All branches; 1:1 to spec ACs; every listed edge case has a test | `lib/domain/**/*.test.ts` | `npx vitest run lib/domain --reporter=verbose` |
| Server Actions + UI screens (`app/**/page.tsx`, `app/**/actions.ts`, `components/*`) | e2e | Every story's Independent Test, every UI-facing criterion and error path, driven through the real UI | `e2e/**/*.spec.ts` | `npx playwright test <spec> --reporter=list` |
| Prisma schema / migrations | none | - (build gate only) | `prisma/**` | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only | `npx vitest run lib/domain --reporter=verbose` |
| Full | After tasks with e2e tests | `npm run build && npx vitest run lib/domain --reporter=verbose && npx playwright test <the task's spec file> --reporter=list` |
| Build | After phase completion or schema-only tasks | `npm run build && npm run typecheck && npm run lint` (+ the whole `npx playwright test --reporter=list` after the last phase) |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks
within a phase execute in order.

### Phase 1: Data model

```
T1
```

### Phase 2: Domain

```
T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
```

### Phase 3: Plans screen

```
T10 → T11 → T12 → T13
```

### Phase 4: Existing screens

```
T14 → T15 → T16 → T17 → T18 → T19 → T20 → T21 → T22 → T23
```

---

## Task Breakdown

### T1: Add the PAUSED plan status

**What**: `PAUSED` in `enum PlanStatus` and the migration `ALTER TYPE "PlanStatus" ADD VALUE 'PAUSED'`, applied to the dev database; the partial unique index on ACTIVE is reviewed and kept.
**Where**: `prisma/schema.prisma`
**Depends on**: None
**Reuses**: `prisma/migrations/20261107191423_init/migration.sql` (index `Plan_userId_active_key`)
**Requirement**: PLANS-01, PLANS-02

**Done when**:

- [x] `prisma/migrations/20261110120000_add_paused_plan_status/migration.sql` adds the value
- [x] `npx prisma migrate deploy` applied it to the dev database
- [x] Gate check passes: `npm run build && npm run typecheck && npm run lint`

**Tests**: none
**Gate**: build
**Commit**: `feat(db): add the paused plan status`

---

### T2: Archive past active and paused plans

**What**: `archiveIfPast` also archives a `PAUSED` plan; `archivePastPlans(userId, today)` archives every active or paused plan of the user whose race date is before today.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: None (phase order)
**Reuses**: `archiveIfPast`
**Requirement**: PLANS-10

**Done when**:

- [x] Unit tests: past active and paused archived; race day and future kept; another user's plan untouched
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): archive past paused plans too`

---

### T3: Limit of 3 plans and pause on create

**What**: `createNewPlan` refuses a plan when 3 are active or paused (`PlanLimitError`, PLANS-03 text); `createPlan` pauses the active plan in its own transaction; P2002 becomes `PlanConflictError`; `ActivePlanExistsError` goes away.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T2
**Reuses**: `createPlan`, `createNewPlan`
**Requirement**: PLANS-01, PLANS-02, PLANS-03, PLANS-04, PLANS-13

**Done when**:

- [x] `createPlan` in `lib/domain/plan-generator.ts` pauses the ACTIVE plan inside its transaction
- [x] The LIFE-06 test is rewritten for PLANS-04 (AD-005)
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): keep up to 3 plans and pause the active one on create`

---

### T4: Follow a paused plan

**What**: `followPlan(userId, planId, today)` - PAUSED plan of the user becomes ACTIVE, the ACTIVE one PAUSED, its ended weeks marked reassessed without a WeeklyAdjustment; a past race archives it instead; P2002 is `PlanConflictError`; not found is `PlanNotFoundError`.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T3
**Reuses**: `isWeekDue` rule (end day before today), `archiveIfPast`
**Requirement**: PLANS-06, PLANS-09, PLANS-10, PLANS-13, PLANS-14

**Done when**:

- [x] Unit tests for each requirement above, the DB unchanged on every refusal
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): follow a paused plan`

---

### T5: List the user's plans

**What**: `listPlans(userId, today)` archives past plans, then returns the active and paused ones with race type, race date, week count and status, the active first.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T4
**Reuses**: `archivePastPlans`
**Requirement**: PLANS-05, PLANS-10

**Done when**:

- [x] Unit test: fields, order, archived plans left out, past paused plan archived on the way
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): list active and paused plans`

---

### T6: Delete a plan

**What**: `deletePlan(userId, planId)` removes the plan with its weeks, sessions, logs, adjustments, VDOT history and race result in one transaction; other plans keep their status; not found refuses without changes.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T5
**Reuses**: in-memory Prisma mock
**Requirement**: DEL-02, DEL-04, PLANS-14

**Done when**:

- [x] Unit tests: nothing of the plan left, the other plans and their rows intact, statuses unchanged
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): delete a plan with everything it owns`

---

### T7: Delete a session

**What**: `deleteSession(userId, sessionId)` removes a session of the user's active plan and its log; refuses the week's last session with `LAST_SESSION_ERROR` and a foreign or unknown session with `SessionNotFoundError`.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T6
**Reuses**: `reassessIfDue` / `computeSignals` (DEL-09)
**Requirement**: DEL-08, DEL-09, DEL-10, PLANS-14

**Done when**:

- [x] Unit tests, including a reassessment after the deletion with the missed signal off
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): delete a planned session`

---

### T8: Rebuild the whole plan when the race date changes

**What**: `editPlan(planId, { raceDate, days }, today)` - a new race date rebuilds every week from week 1 in place (past weeks on the previous days, the rest on the new ones), keeping logged sessions, `reassessedAt` and adjustments; the same date falls back to `recalculateFromCurrentWeek`.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T7
**Reuses**: `recalculateFromCurrentWeek` body as `rebuildWeeks`, `splitPhases`, `generateSessions`
**Requirement**: RECALC-01, RECALC-02, RECALC-03, RECALC-04, RECALC-05

**Done when**:

- [x] Existing `recalculateFromCurrentWeek` tests still pass unchanged
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: quick
**Commit**: `feat(plans): rebuild the whole plan when the race date changes`

---

### T9: Workout note rule

**What**: `parseNotes` (trim, blank → null, over 500 → `NOTES_ERROR`) and `saveWorkoutLog` writing `notes`.
**Where**: `lib/domain/workout-log.ts`
**Depends on**: T8
**Reuses**: `saveWorkoutLog`
**Requirement**: NOTE-01, NOTE-02, NOTE-03

**Done when**:

- [x] `lib/domain/workout-log.test.ts` covers blank, trimmed, 500 and 501 characters
- [x] Gate check passes: `npm run build && npm run typecheck && npm run lint && npx vitest run lib/domain --reporter=verbose`

**Tests**: unit
**Gate**: build
**Commit**: `feat(log): validate and save the workout note`

---

### T10: Plans screen list

**What**: `/plans` lists each active or paused plan (race, race date, weeks, "Seguindo"/"Pausado") and links to a new plan.
**Where**: `app/plans/page.tsx`
**Depends on**: None (phase order)
**Reuses**: `listPlans`, `.card`, `.chip-*`, `formatLongDay`, `RACE_NAME`
**Requirement**: PLANS-05

**Done when**:

- [x] `e2e/plans.spec.ts` checks the list against seeded plans, at 390px wide
- [x] Gate check passes: full gate with `e2e/plans.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(plans): add the plans screen`

---

### T11: Follow a plan from the plans screen

**What**: "Seguir este plano" on each paused plan, through `followPlanAction`; errors come back as `?error=`.
**Where**: `app/plans/actions.ts`
**Depends on**: T10
**Reuses**: `followPlan`
**Requirement**: PLANS-06, PLANS-07

**Done when**:

- [x] e2e: following switches the statuses and the dashboard shows the followed plan's current week
- [x] Gate check passes: full gate with `e2e/plans.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(plans): follow a plan from the plans screen`

---

### T12: Delete a plan with confirmation

**What**: `ConfirmDialog` (modal `<dialog>`, "Cancelar"/"Excluir") and "Excluir plano" on every plan of `/plans`, through `deletePlanAction`.
**Where**: `components/confirm-dialog.tsx`
**Depends on**: T11
**Reuses**: `deletePlan`, `.btn-danger`, `SubmitButton`; `.dialog` CSS in `app/globals.css`
**Requirement**: DEL-01, DEL-02, DEL-03, DEL-05

**Done when**:

- [x] `e2e/delete.spec.ts`: the exact DEL-01 text, cancel keeps everything, confirm leaves no row of the plan
- [x] Gate check passes: full gate with `e2e/delete.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(plans): delete a plan after confirmation`

---

### T13: Refuse a fourth plan on the form

**What**: The plan forms show `PlanLimitError` and `PlanConflictError` messages.
**Where**: `app/plan/new/actions.ts`
**Depends on**: T12
**Reuses**: `backToForm`
**Requirement**: PLANS-03

**Done when**:

- [x] e2e: with 3 plans, submitting a new one shows "Você já tem 3 planos. Exclua um para criar outro." and creates nothing
- [x] Gate check passes: `npm run build && npm run typecheck && npm run lint && npx playwright test e2e/plans.spec.ts e2e/delete.spec.ts --reporter=list`

**Tests**: e2e
**Gate**: build
**Commit**: `feat(plans): refuse a fourth plan on the plan form`

---

### T14: Dashboard with several plans

**What**: The dashboard archives every past plan (`archivePastPlans`) and, with no active plan but a paused one, shows the empty state with "Ver meus planos".
**Where**: `app/dashboard/page.tsx`
**Depends on**: None (phase order)
**Reuses**: `archivePastPlans`
**Requirement**: PLANS-08, PLANS-10, PLANS-11

**Done when**:

- [x] e2e: paused plan not reassessed and no retest banner for it; past paused plan archived; empty state link
- [x] Gate check passes: full gate with `e2e/plans.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(dashboard): handle paused plans`

---

### T15: Settings link and whole-plan recalculation

**What**: A "Planos" link in both settings states; saving calls `editPlan`.
**Where**: `app/settings/page.tsx`
**Depends on**: T14
**Reuses**: `editPlan`, `.choice-card`
**Requirement**: PLANS-12, RECALC-01

**Done when**:

- [x] `e2e/recalc.spec.ts`: postponing the race rebuilds every week and keeps the logs on their dates; the existing `e2e/settings.spec.ts` still passes
- [x] Gate check passes: full gate with `e2e/recalc.spec.ts e2e/settings.spec.ts e2e/plans.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(settings): link to plans and rebuild the plan on a new race date`

---

### T16: Delete an archived plan from history

**What**: History labels paused plans and offers "Excluir plano" for the selected archived plan.
**Where**: `app/history/page.tsx`
**Depends on**: T15
**Reuses**: `ConfirmDialog`, `deletePlanAction`
**Requirement**: DEL-05, DEL-06

**Done when**:

- [x] e2e: the deleted archived plan disappears from history
- [x] Gate check passes: full gate with `e2e/delete.spec.ts e2e/history.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(history): delete an archived plan`

---

### T17: Delete a session from its screen

**What**: "Excluir treino" on the session screen of the active plan, with the DEL-07 confirmation, through `deleteSessionAction`.
**Where**: `app/dashboard/log/[sessionId]/actions.ts`
**Depends on**: T16
**Reuses**: `ConfirmDialog`, `deleteSession`
**Requirement**: DEL-07, DEL-08, DEL-10

**Done when**:

- [x] e2e: exact text, deletion removes session and log from the dashboard, last session refused
- [x] Gate check passes: full gate with `e2e/delete.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(log): delete a planned session`

---

### T18: Note field on the log form

**What**: Optional "Observação" textarea, pre-filled when editing, validated with `parseNotes`.
**Where**: `app/dashboard/log/[sessionId]/page.tsx`
**Depends on**: T17
**Reuses**: `parseNotes`, `saveWorkoutLog`
**Requirement**: NOTE-01, NOTE-02, NOTE-04

**Done when**:

- [x] `e2e/notes.spec.ts`: saved, refused over 500, shown when editing; `e2e/logging.spec.ts` still passes
- [x] Gate check passes: full gate with `e2e/notes.spec.ts e2e/logging.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `feat(log): add the note field`

---

### T19: Note on the dashboard card

**What**: A logged session's note shows on its dashboard card.
**Where**: `app/dashboard/page.tsx`
**Depends on**: T18
**Reuses**: session card
**Requirement**: NOTE-05

**Done when**:

- [x] e2e: the note text is on the card
- [x] Gate check passes: `npm run build && npm run typecheck && npm run lint && npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`

**Tests**: e2e
**Gate**: build
**Commit**: `feat(dashboard): show the workout note on the card`

---

### T20: Center the delete confirmation

**What**: The `.dialog` keeps the `<dialog>` centered (`margin: auto`), which the global `* { margin: 0 }` reset removed. Found walking the session screen at 390px: the confirmation sat at the top-left corner with "Excluir" cut off.
**Where**: `app/globals.css`
**Depends on**: T19
**Reuses**: `.dialog`
**Requirement**: DEL-11

**Done when**:

- [x] e2e: both confirmations sit centered and whole on a 390px screen, the session one opened after scrolling
- [x] Gate check passes: full gate with `e2e/delete.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `fix(plans): center the delete confirmation`

---

### T21: Keep the history plan tabs inside a phone screen

**What**: `.page`'s grid column is `minmax(0, 1fr)`, so a row wider than the screen (the history plan tabs, one per plan) scrolls on its own instead of widening the whole page. Found walking the history at 390px with three plans: `main` grew to 674px and the charts were cut off.
**Where**: `app/globals.css`
**Depends on**: T20
**Reuses**: `.page`, `.plan-tabs`
**Requirement**: PLANS-15

**Done when**:

- [x] e2e: with three plans, nothing on the history passes the right edge of a 390px screen, and the last plan tab is reached by scrolling the tabs row
- [x] Gate check passes: full gate with `e2e/plans.spec.ts`

**Tests**: e2e
**Gate**: full
**Commit**: `fix(history): keep the plan tabs inside a phone screen`

---

### T22: Maintain a week by weekday, not by position

**What**: `applyDecision`'s `maintain` copies each current-week session onto the next-week session of the same weekday, keeping the next week's dates. Found by the Verifier: after a deleted session the two weeks differ in length, and the copy by position moved a session to another day.
**Where**: `lib/domain/weekly-adjustment.ts`
**Depends on**: T21
**Reuses**: `applyDecision`
**Requirement**: DEL-13

**Done when**:

- [x] Unit: with a deleted session in either week, every next-week session keeps its date and takes the current-week session of its weekday; one with no match stays as generated
- [x] Gate check passes: `npx vitest run lib/domain`

**Tests**: unit
**Gate**: quick
**Commit**: `fix(adjust): maintain a week by weekday, not by position`

---

### T23: Keep a deleted session deleted when the plan is rebuilt

**What**: `rebuildWeeks` drafts no session on a day of the plan's days that had none before the rebuild - a deleted one - in a week laid out on those days. Found by the Verifier: a new race date or new days brought a deleted session back, and the reassessment then counted it as missed.
**Where**: `lib/domain/plan-lifecycle.ts`
**Depends on**: T22
**Reuses**: `rebuildWeeks`, `deleteSession`
**Requirement**: DEL-12

**Done when**:

- [ ] Unit: a session deleted in the current week and one in a future week stay deleted after a new race date and after new days; the new days are still added; the week's reassessment does not count the deleted one as missed
- [ ] Gate check passes: `npx vitest run lib/domain`

**Tests**: unit
**Gate**: quick
**Commit**: `fix(recalc): keep a deleted session deleted when the plan is rebuilt`

---

## Checks

**Run unit**: `npx vitest run lib/domain --reporter=verbose`
**Run e2e**: `npx playwright test e2e/plans.spec.ts e2e/delete.spec.ts e2e/recalc.spec.ts e2e/notes.spec.ts --reporter=list`
<!-- Playwright's list reporter prints `ok N <file>:<line> › <title>` on this Windows shell (no ✓), so e2e proofs name that line. -->

**C1** - Only active and paused plans count toward the limit of 3; archived ones never do (PLANS-01, AC 1)
Proof: run unit | ✓ plan-lifecycle > createNewPlan counts only active and paused plans toward the limit of 3

**C2** - Creating a plan pauses the active one, so at most one plan is active (PLANS-02, AC 2)
Proof: run unit | ✓ plan-lifecycle > createPlan pauses the active plan so at most one stays active

**C3** - With 3 plans, creating another is refused with "Você já tem 3 planos. Exclua um para criar outro." (PLANS-03, AC 3)
Proof: run e2e | ok plans.spec.ts › a fourth plan is refused with the 3-plan message

**C4** - A plan created while another is active is active and the previous one paused (PLANS-04, AC 4)
Proof: run unit | ✓ plan-lifecycle > createNewPlan makes the new plan active and the previous one paused

**C5** - "Planos" lists each active and paused plan with race, race date, weeks and "Seguindo"/"Pausado" (PLANS-05, AC 5)
Proof: run e2e | ok plans.spec.ts › the plans screen lists each active and paused plan with race, date, weeks and status

**C6** - "Seguir este plano" makes the paused plan active and the active one paused (PLANS-06, AC 6)
Proof: run e2e | ok plans.spec.ts › following a paused plan makes it active and pauses the other

**C7** - After switching, the dashboard shows the followed plan's current week (PLANS-07, AC 7)
Proof: run e2e | ok plans.spec.ts › the dashboard shows the current week of the plan just followed

**C8** - A paused plan's ended weeks are not reassessed and its stale VDOT shows no retest banner (PLANS-08, AC 8)
Proof: run e2e | ok plans.spec.ts › the dashboard never reassesses or prompts a retest for a paused plan

**C9** - Following a paused plan marks its weeks ended before today as reassessed, with no WeeklyAdjustment (PLANS-09, AC 9)
Proof: run unit | ✓ plan-lifecycle > followPlan marks the plan's ended weeks reassessed without a WeeklyAdjustment

**C10** - Opening the plans screen or the dashboard archives a paused plan whose race date has passed (PLANS-10, AC 10)
Proof: run e2e | ok plans.spec.ts › opening the plans screen or the dashboard archives a paused plan whose race has passed

**C11** - With no active plan and a paused one, the dashboard shows the empty state linking to "Planos" (PLANS-11, AC 11)
Proof: run e2e | ok plans.spec.ts › with only paused plans the dashboard shows the empty state linking to the plans screen

**C12** - Settings show a link to the plans screen (PLANS-12, AC 12)
Proof: run e2e | ok plans.spec.ts › settings links to the plans screen

**C13** - A concurrent second activation (unique index, P2002) is refused and nothing changes (PLANS-13, Edge Case 1)
Proof: run unit | ✓ plan-lifecycle > followPlan refuses a concurrent second activation without changing anything

**C14** - Follow, plan deletion and session deletion refuse an id that is not the user's or does not exist, changing nothing (PLANS-14, Edge Case 2)
Proof: run unit | ✓ plan-lifecycle > followPlan, deletePlan and deleteSession refuse an id that is not the user's or does not exist

**C15** - "Excluir plano" asks "Excluir o plano de <prova>? Todas as semanas, treinos e registros dele serão apagados. Isso não pode ser desfeito." (DEL-01, AC 1)
Proof: run e2e | ok delete.spec.ts › deleting a plan asks for confirmation with the spec text

**C16** - Confirming leaves no week, session, log, adjustment, VDOT history or race result of the plan in the database (DEL-02, AC 2)
Proof: run e2e | ok delete.spec.ts › confirming deletes the plan and every row it owns

**C17** - Cancelling keeps the plan and every row it owns (DEL-03, AC 3)
Proof: run e2e | ok delete.spec.ts › cancelling the plan deletion keeps the plan and everything in it

**C18** - Deleting the active plan leaves every other plan's status as it was (DEL-04, AC 4)
Proof: run unit | ✓ plan-lifecycle > deletePlan of the active plan leaves every other plan's status as it was

**C19** - Every plan on "Planos" and every archived plan in History offers "Excluir plano" (DEL-05, AC 5)
Proof: run e2e | ok delete.spec.ts › every plan on the plans screen and every archived plan in history offers Excluir plano

**C20** - A deleted archived plan is no longer listed in History (DEL-06, AC 6)
Proof: run e2e | ok delete.spec.ts › a deleted archived plan is no longer listed in history

**C21** - "Excluir treino" asks "Excluir o treino de <dia>? O registro dele, se houver, também será apagado." (DEL-07, AC 1)
Proof: run e2e | ok delete.spec.ts › deleting a session asks for confirmation with the spec text

**C22** - Confirming deletes the session and its WorkoutLog and the dashboard no longer shows it (DEL-08, AC 2)
Proof: run e2e | ok delete.spec.ts › confirming deletes the session and its log and the dashboard no longer shows it

**C23** - A week reassessed after a deletion counts only the remaining sessions; the deleted one is not missed (DEL-09, AC 3)
Proof: run unit | ✓ plan-lifecycle > a deleted session does not count as missed when its week is reassessed

**C24** - Deleting a week's last session is refused with "A semana precisa de pelo menos um treino." (DEL-10, AC 4)
Proof: run e2e | ok delete.spec.ts › deleting the last session of a week is refused

**C25** - A new race date rebuilds the phases and sessions of every week from week 1, counted from the original start (RECALC-01, AC 1)
Proof: run e2e | ok recalc.spec.ts › postponing the race from settings rebuilds every week from the first

**C26** - Each logged session keeps its log on its date, and no other session is generated on that day of that week (RECALC-02, AC 2)
Proof: run unit | ✓ plan-lifecycle > editPlan keeps every logged session with its log on its date and adds no session on that day

**C27** - Regenerated sessions take their paces from currentVdot (RECALC-03, AC 3)
Proof: run unit | ✓ plan-lifecycle > editPlan derives the regenerated paces from currentVdot

**C28** - Every week that was reassessed stays reassessed, its WeeklyAdjustment kept (RECALC-04, AC 4)
Proof: run unit | ✓ plan-lifecycle > editPlan keeps every reassessed week reassessed

**C29** - A race date leaving fewer weeks than the current one is refused with "A data da prova precisa ser depois da semana de treino atual." (RECALC-05, AC 5)
Proof: run unit | ✓ plan-lifecycle > editPlan refuses a race date that leaves fewer weeks than the current one

**C30** - A note typed when logging is saved in WorkoutLog.notes (NOTE-01, AC 1)
Proof: run e2e | ok notes.spec.ts › a note typed when logging is saved to the log

**C31** - A note over 500 characters is refused with "Observação inválida: no máximo 500 caracteres." (NOTE-02, AC 2)
Proof: run e2e | ok notes.spec.ts › a note over 500 characters is refused with the spec message

**C32** - An empty or blank note is saved as null (NOTE-03, AC 3)
Proof: run unit | ✓ workout-log > parseNotes turns an empty or blank note into null

**C33** - Editing a log with a note shows the saved note in the field (NOTE-04, AC 4)
Proof: run e2e | ok notes.spec.ts › editing a log shows its saved note in the field

**C34** - A logged session with a note shows the note on its dashboard card (NOTE-05, AC 5)
Proof: run e2e | ok notes.spec.ts › the dashboard card shows the note of a logged session

**C35** - Both delete confirmations sit centered and whole on a 390px screen (DEL-11, AC 5)
Proof: run e2e | ok delete.spec.ts › the delete confirmation sits centered and whole on a phone screen

**C36** - With three plans the history fits a 390px screen and its plan tabs scroll on their own (PLANS-15, AC 13)
Proof: run e2e | ok plans.spec.ts › with three plans the history fits a phone screen and its plan tabs scroll

**C37** - A new race date or new days never bring back a deleted session (DEL-12, AC 6)
Proof: run unit | ✓ plan-lifecycle > editPlan never brings back a deleted session, with a new race date or new days

**C38** - A maintained week keeps each next-week session on its own day when a session was deleted (DEL-13, AC 7)
Proof: run unit | ✓ weekly-adjustment > maintain matches sessions by weekday when either week has a deleted session

**C39** - The 500-character limit counts characters, not UTF-16 units: 500 emoji or decomposed accents are accepted, 501 refused (NOTE-02, AC 2)
Proof: run unit | ✓ workout-log > parseNotes counts characters, not UTF-16 units: emoji and decomposed accents count as one

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** Execução inline pelo agente orquestrador, sem batch workers: o usuário delegou a feature de ponta a ponta ("ele aprova todos os commit e push que forem perguntados").
**Dispatched:** Verifier (round 1, independent sub-agent, validate.md) over HEAD 89e9591, diff 8b3390f^..89e9591 - 2026-11-11
**Walked:** 2026-11-11, navegador do app a 390x844, `npm run start` com a conta semeada (dev DB). Dados: um 10K seguido começado há 10 dias (seg/qua/sáb), uma meia maratona pausada e um 5K arquivado, semeados por script com `e2e/helpers.ts` (`seedActivePlan`, `logWorkout`). Até 3 planos: /plans lista o 10K "Seguindo" (20 jan 2027, 11 semanas) e a meia "Pausado" (11 mar 2027, 17 semanas); "Seguir este plano" troca os dois e o painel mostra a semana do plano seguido. Observação: o card de Seg 09/11 no painel mostra "Calor forte, segurei o ritmo."; registrar Qua 11/11 em /dashboard/log/<id> com observação a mostra no card. Excluir treino: em /dashboard/log/<id> de Sáb 14/11, "Excluir treino" abre a confirmação com o texto da spec - estava no canto superior esquerdo com "Excluir" cortado (virou DEL-11/T20, corrigido); confirmar volta ao painel com "1 de 2 treinos". Recalcular: em /settings, nova data 2027-02-10 → painel "Semana 2 de 14", 10 fev 2027, os dois registros e observações mantidos (o Sáb excluído volta como rascunho, pois a data nova regenera os dias sem registro desde a semana 1). Histórico: com três planos /history ficava com 674px e cortava os gráficos (virou PLANS-15/T21, corrigido); a aba "5km - 2027-01-10 (arquivado)" mostra "Excluir plano", a confirmação aparece centralizada, e confirmar tira o 5K das abas. O dev DB fica com o 10K seguido e a meia pausada.

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1 (Data model):        T1
Phase 2 (Domain):            T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9
Phase 3 (Plans screen):      T10 → T11 → T12 → T13
Phase 4 (Existing screens):  T14 → T15 → T16 → T17 → T18 → T19 → T20 → T21 → T22 → T23
```

Execution is strictly sequential - a single agent works one task at a time, in order.
