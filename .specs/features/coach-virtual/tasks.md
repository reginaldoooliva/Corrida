# Coach Virtual Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is
the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk,
check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/coach-virtual/design.md`
**Status**: Approved
**Approved**: 2026-11-07 - user: "tasks aprovadas, mas não execute ainda"
**Build**: `npm run build; npm run typecheck; npm run lint`
**Run unit**: `npx vitest run lib/domain --reporter=verbose`

---

## Test Coverage Matrix

> Generated from Design (AD-004: Vitest for `lib/domain/*`, Playwright for e2e) - no existing
> codebase or project guidelines to sample, this is a greenfield project. Confirm before Execute.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| `lib/domain/*` (vdot, plan-generator, weekly-adjustment, plan-lifecycle, auth, session-status) | unit | All branches; 1:1 to spec ACs; every listed edge case has a test | `lib/domain/**/*.test.ts` | `npx vitest run lib/domain --reporter=verbose` |
| Server Actions + UI screens (`app/**/page.tsx`, `app/**/actions.ts` with real branching behavior) | e2e | Every P1 story's Independent Test, every UI-facing edge case, and error/validation paths, driven through the real UI | `e2e/**/*.spec.ts` | `npx playwright test --reporter=list` |
| Prisma schema / migrations / seed script | none | - (build gate only) | `prisma/**` | build gate only |
| Framework/build configuration & wiring (Next.js scaffold, NextAuth provider config, middleware route matcher) - declarative config with no branching logic of its own | none | - (build gate only; exercised indirectly once a page drives it, proven there) | `package.json`, `next.config.ts`, `app/api/auth/**`, `middleware.ts` | build gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only | `npx vitest run lib/domain --reporter=verbose` |
| Full | After tasks with e2e tests | `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list` |
| Build | After phase completion or config/schema-only tasks | `npm run build && npm run typecheck && npm run lint` |

---

## Execution Plan

Phases are ordered and run sequentially - each phase completes before the next begins, and tasks
within a phase execute in order.

### Phase 1: Foundation

```
T1 → T2 → T3 → T4 → T5 → T6 → T7
```

### Phase 2: Domain - VDOT & Plan Generation

```
T8 → T9 → T10 → T11 → T12 → T13
```

### Phase 3: Domain - Weekly Adjustment & Session Status

```
T14 → T15 → T16 → T17 → T18
```

### Phase 4: Domain - Plan Lifecycle

```
T19 → T20 → T21 → T22 → T23 → T24
```

### Phase 5: Login UI

```
T25
```

### Phase 6: Onboarding UI

```
T26 → T27
```

### Phase 7: Dashboard UI

```
T28 → T29 → T30
```

### Phase 8: Workout Logging UI

```
T31 → T32
```

### Phase 9: History/Progress UI

```
T33 → T34 → T35
```

### Phase 10: Plan Lifecycle UI

```
T36 → T37
```

### Phase 11: Edit & Settings UI

```
T38 → T39
```

### Phase 12: Deploy & Polish

```
T40 → T41 → T42 → T43
```

### Dependency Graph (all edges, intra- and cross-phase)

Every task's `Depends on` field has a matching edge here; this is the authoritative graph the
per-phase chains above summarize visually.

```
T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7
T2 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13
T13 -> T14 -> T15 -> T16 -> T17
T13 -> T18
T17 -> T18
T13 -> T19 -> T20 -> T21 -> T22 -> T23
T13 -> T24
T23 -> T24
T7 -> T25
T25 -> T26
T24 -> T26
T26 -> T27
T22 -> T27
T27 -> T28
T18 -> T28
T28 -> T29
T17 -> T29
T29 -> T30
T24 -> T30
T30 -> T31 -> T32
T32 -> T33 -> T34 -> T35
T35 -> T36
T20 -> T36
T36 -> T37
T21 -> T37
T27 -> T37
T37 -> T38
T23 -> T38
T38 -> T39
T23 -> T39
T39 -> T40 -> T41 -> T42 -> T43
```

---

## Task Breakdown

### T1: Scaffold the Next.js project

**What**: Initialize git, add `.gitignore`, and scaffold a Next.js (App Router, TypeScript) project
with ESLint/Prettier and the npm scripts this plan relies on (`build`, `typecheck`, `lint`, `test`,
`test:e2e`, `seed`).
**Where**: `package.json`, `tsconfig.json`, `next.config.ts`, `.eslintrc.json`, `.gitignore`,
`app/layout.tsx`, `app/page.tsx`
**Depends on**: None
**Reuses**: n/a (greenfield)
**Requirement**: -

**Done when**:
- [x] `git init` has run and the initial scaffold is the first commit
- [x] `npm run build`, `npm run typecheck`, `npm run lint` all exit 0 against the empty scaffold
- [x] `npm run test` and `npm run test:e2e` run (even with zero tests) without erroring

**Tests**: none
**Gate**: build
**Commit**: `chore: scaffold Next.js project`

---

### T2: Define the Prisma schema

**What**: Write `prisma/schema.prisma` with all models and enums from design.md (`User`, `Plan`,
`VdotHistory`, `Week`, `Session`, `WorkoutLog`, `WeeklyAdjustment`, `RaceResult`), including the
`@unique` constraints on `WorkoutLog.sessionId` and `WeeklyAdjustment.weekId`, and the pooled
`DATABASE_URL`/direct `DIRECT_URL` datasource split (AD-003).
**Where**: `prisma/schema.prisma`
**Depends on**: T1
**Reuses**: n/a
**Requirement**: - (schema backs every model-touching requirement below)

**Done when**:
- [x] `npx prisma validate` passes
- [x] `npx prisma generate` produces a client with no type errors
- [x] Every model/enum from design.md's Data Models section is present

**Tests**: none
**Gate**: build
**Commit**: `feat(db): define Prisma schema`

---

### T3: Initial migration with DB-level safety nets

**What**: Generate the initial migration against Supabase and hand-edit it to add the partial
unique index `Plan (userId) WHERE status = 'ACTIVE'` (backs `LIFE-06`) via raw SQL.
**Where**: `prisma/migrations/<timestamp>_init/migration.sql`
**Depends on**: T2
**Reuses**: T2's schema
**Requirement**: LIFE-06 (DB-level backstop)

**Done when**:
- [x] `npx prisma migrate dev` applies cleanly against the Supabase dev database
- [x] The partial unique index exists (verified via `\d+ "Plan"` in `psql` or an inline query)
- [x] Attempting to insert a second `ACTIVE` plan for the same user at the SQL level fails

**Tests**: none
**Gate**: build
**Commit**: `feat(db): initial migration with active-plan safety net`

---

### T4: Seed script for the single account

**What**: Write `prisma/seed.ts` that creates the one `User` row from `SEED_USERNAME`/`SEED_PASSWORD`
env vars, hashing the password with bcrypt before storing it.
**Where**: `prisma/seed.ts`
**Depends on**: T3
**Reuses**: T2's `User` model
**Requirement**: AUTH-04, AUTH-05 (provisioning path)

**Done when**:
- [x] `npm run seed` creates exactly one `User` row
- [x] Running it twice does not create a duplicate (upsert by username)
- [x] The stored `passwordHash` is a bcrypt hash, never the plaintext env value

**Tests**: none
**Gate**: build
**Commit**: `feat(db): seed single-user account from env vars`

---

### T5: `lib/domain/auth.ts` - credential verification

**What**: Implement `verifyCredentials(username, password)` comparing against the seeded `User` row
via bcrypt.
**Where**: `lib/domain/auth.ts` (+ `lib/domain/auth.test.ts`)
**Depends on**: T4
**Reuses**: Prisma Client from T2
**Requirement**: AUTH-01, AUTH-02, AUTH-04

**Done when**:
- [x] `verifyCredentials` returns `{ id }` for correct credentials, `null` for incorrect
- [x] A test asserts the stored `passwordHash` is bcrypt-shaped (`$2...`), never equal to the
      plaintext password
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(auth): verify credentials against seeded account`

---

### T6: NextAuth Credentials Provider

**What**: Wire NextAuth.js with a Credentials Provider whose `authorize()` calls
`verifyCredentials` from T5; no other provider, no registration page.
**Where**: `app/api/auth/[...nextauth]/route.ts`
**Depends on**: T5
**Reuses**: `lib/domain/auth.ts`
**Requirement**: AUTH-01, AUTH-02, AUTH-05

**Done when**:
- [x] A successful `authorize()` call creates a session
- [x] A failed call returns `null` (NextAuth surfaces its generic error)
- [x] No route file exists anywhere under `app/` for registration/signup

**Tests**: none (covered end-to-end in T26)
**Gate**: build
**Commit**: `feat(auth): wire NextAuth credentials provider`

---

### T7: Route-protection middleware

**What**: Add `middleware.ts` redirecting any unauthenticated request for a protected path
(`/dashboard`, `/plan/**`, `/history`, `/settings`) to `/login`.
**Where**: `middleware.ts`
**Depends on**: T6
**Reuses**: NextAuth session helper from T6
**Requirement**: AUTH-03

**Done when**:
- [x] Protected paths redirect to `/login` when no session cookie is present
- [x] `/login` itself remains reachable without a session

**Tests**: none (covered end-to-end in T26)
**Gate**: build
**Commit**: `feat(auth): protect app routes with middleware`

---

### T8: `lib/domain/vdot.ts` - VDOT formula & plausibility check

**What**: Implement `calculateVdot(distanceKm, timeSec)` (Jack Daniels formula) and
`isPlausibleResult(distanceKm, timeSec)`.
**Where**: `lib/domain/vdot.ts` (+ `lib/domain/vdot.test.ts`)
**Depends on**: T2
**Reuses**: n/a
**Requirement**: VDOT-03 (pure calc), Edge Case (implausible time)

**Done when**:
- [x] `calculateVdot` matches known Jack Daniels VDOT table values within rounding tolerance for at
      least 3 reference distance/time pairs
- [x] `isPlausibleResult` rejects a sub-2-minute 5km and accepts a realistic 5km time
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 5 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): VDOT formula and plausibility check`

---

### T9: `lib/domain/vdot.ts` - training pace tables

**What**: Add `paceForVdot(vdot, sessionType)` returning `secPerKm` for Easy, Long, Tempo, Interval.
**Where**: `lib/domain/vdot.ts` (modify, + tests in `vdot.test.ts`)
**Depends on**: T8
**Reuses**: T8's VDOT module
**Requirement**: PLAN-07

**Done when**:
- [x] Returns a distinct, correctly-ordered pace (Interval fastest → Easy slowest) for a fixed VDOT
- [x] One test per `SessionType`
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): training pace tables from VDOT`

---

### T10: `lib/domain/plan-generator.ts` - plan length & day validation

**What**: Implement `computePlanWeeks(raceType, raceDate, today)` (with `belowMinimum` flag) and
`validateDaysPerWeek(days)`.
**Where**: `lib/domain/plan-generator.ts` (+ `lib/domain/plan-generator.test.ts`)
**Depends on**: T9
**Reuses**: n/a
**Requirement**: PLAN-01, PLAN-02, PLAN-04, PLAN-08

**Done when**:
- [x] `computePlanWeeks` returns `raceDate - today` in whole weeks for all 4 race types
- [x] `belowMinimum` is `true` exactly when weeks < the race type's minimum (5k:8, 10k:10, 21k:12, 42k:16)
- [x] `validateDaysPerWeek` accepts 3-6 and rejects <3 and >6
- [x] A race type outside the 4 supported ones is rejected
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 8 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): plan length and day-count validation`

---

### T11: `lib/domain/plan-generator.ts` - phase proportions

**What**: Implement `splitPhases(totalWeeks)`: taper = `ceil(10%)` clamped `[1,3]`, remainder base
40% / build 35% / peak 25%.
**Where**: `lib/domain/plan-generator.ts` (modify, + tests)
**Depends on**: T10
**Reuses**: T10's module
**Requirement**: PLAN-05

**Done when**:
- [x] A 10-week and an 18-week plan both produce phase-week counts matching the documented formula
- [x] Taper never exceeds 3 weeks or drops below 1
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): proportional phase split`

---

### T12: `lib/domain/plan-generator.ts` - session generation

**What**: Implement `generateSessions(week, days, vdot)`: one session per selected day, type
weighted toward Easy/Long in base and Tempo/Interval in build/peak, reduced in taper.
**Where**: `lib/domain/plan-generator.ts` (modify, + tests)
**Depends on**: T11
**Reuses**: T9's `paceForVdot`, T11's phase split
**Requirement**: PLAN-03, PLAN-06

**Done when**:
- [x] Generated sessions land only on the selected weekdays, one per day
- [x] A base-phase week is weighted toward Easy/Long; a build/peak week toward Tempo/Interval
- [x] A taper week has reduced distance/duration vs. the equivalent non-taper week
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 6 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): per-phase session generation`

---

### T13: `lib/domain/plan-generator.ts` - `createPlan` orchestrator

**What**: Implement `createPlan(input)` tying T8-T12 together: establishes initial VDOT (test or
manual), persists `Plan`, `VdotHistory` (source `test`/`manual`), `Week`, `Session` rows in one
Prisma transaction.
**Where**: `lib/domain/plan-generator.ts` (modify, + tests)
**Depends on**: T12
**Reuses**: T8-T12
**Requirement**: VDOT-01, VDOT-03, PLAN-01..08 (orchestration)

**Done when**:
- [x] A 10km plan ~10 weeks out from a manually entered 5km time produces ~10 `Week` rows with the
      expected phase proportions and every `Session` has a non-null planned pace
- [x] The created `VdotHistory` row's `source` matches the input method (`test`/`manual`)
- [x] A failure mid-generation leaves no partial rows (transaction rollback)
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): createPlan orchestrator`

---

### T14: `lib/domain/weekly-adjustment.ts` - compute signals

**What**: Implement `computeSignals(week)`: pace deviation ≥5%, RPE avg ≥8, missed ratio ≥25%.
**Where**: `lib/domain/weekly-adjustment.ts` (+ `lib/domain/weekly-adjustment.test.ts`)
**Depends on**: T13
**Reuses**: Prisma Client, T13's `Week`/`Session` shape
**Requirement**: ADJ-01, Edge Case (zero-logged week)

**Done when**:
- [x] Each of the 3 signals independently flips at its documented threshold
- [x] A week with zero logged sessions resolves `missed = true`, pace/RPE signals `false` (no data)
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 5 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): weekly fatigue signals`

---

### T15: `lib/domain/weekly-adjustment.ts` - decide

**What**: Implement `decide(signals)`: 0 → `progress`, exactly 1 → `maintain`, 2-3 → `reduce`.
**Where**: `lib/domain/weekly-adjustment.ts` (modify, + tests)
**Depends on**: T14
**Reuses**: T14's signal shape
**Requirement**: ADJ-02, ADJ-03, ADJ-04 (decision only)

**Done when**:
- [x] All 8 combinations of the 3 boolean signals map to the correct decision
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 8 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): reduce/maintain/progress decision`

---

### T16: `lib/domain/weekly-adjustment.ts` - apply decision

**What**: Implement `applyDecision(decision, nextWeekDraft)`: `reduce` cuts distance/duration 20% and
steps Tempo→Easy, Interval→Tempo; `maintain` clones the current week; `progress` leaves the
originally generated next week untouched.
**Where**: `lib/domain/weekly-adjustment.ts` (modify, + tests)
**Depends on**: T15
**Reuses**: T12's session shape
**Requirement**: ADJ-02, ADJ-03, ADJ-04 (effects)

**Done when**:
- [x] `reduce` output has every remaining session's distance/duration at 80% of the original, and
      Tempo/Interval sessions stepped down one intensity level
- [x] `maintain` output is identical to the current week's sessions (types, paces, distances)
- [x] `progress` output is unchanged from the originally generated next week
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): apply weekly adjustment decision`

---

### T17: `lib/domain/weekly-adjustment.ts` - idempotent orchestrator

**What**: Implement `reassessIfDue(weekId)`: no-ops if `Week.reassessedAt` is set or the DB unique
constraint on `WeeklyAdjustment.weekId` rejects a duplicate; otherwise computes, decides, applies,
and persists a `WeeklyAdjustment` row.
**Where**: `lib/domain/weekly-adjustment.ts` (modify, + tests)
**Depends on**: T16
**Reuses**: T14-T16, Prisma Client
**Requirement**: ADJ-05, ADJ-06

**Done when**:
- [x] First call on an ended, unreassessed week persists one `WeeklyAdjustment` row with the 3
      signal values, decision and `adjustmentPct`
- [x] A second call on the same week is a no-op (no second row, no change to next week's sessions)
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): idempotent weekly reassessment`

---

### T18: `lib/domain/session-status.ts` - derive session status

**What**: Implement `deriveSessionStatus(session, hasLog, today)`: `done` if logged, `missed` if
`date < today` and unlogged, `pending` otherwise. Future-dated logs are accepted.
**Where**: `lib/domain/session-status.ts` (+ `lib/domain/session-status.test.ts`)
**Depends on**: T13, T17
**Reuses**: n/a
**Requirement**: LOG-04 (status recompute), Edge Case (future-dated log)

**Done when**:
- [x] A logged future-dated session resolves `done`
- [x] A past, unlogged session resolves `missed`
- [x] A future, unlogged session resolves `pending`
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): derive session status`

---

### T19: `lib/domain/plan-lifecycle.ts` - archive on race-date passing

**What**: Implement `archiveIfPast(planId, today)`: sets `status = archived` once `raceDate < today`.
**Where**: `lib/domain/plan-lifecycle.ts` (+ `lib/domain/plan-lifecycle.test.ts`)
**Depends on**: T13
**Reuses**: Prisma Client
**Requirement**: LIFE-01

**Done when**:
- [x] A plan with a past `raceDate` becomes `archived` after the call
- [x] A plan with a future `raceDate` is left `active`
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 2 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): archive plan past race date`

---

### T20: `lib/domain/plan-lifecycle.ts` - record race result

**What**: Implement `recordRaceResult(planId, finishTimeSec)`: saves `RaceResult`, computes VDOT via
T8's `calculateVdot`, adds a `VdotHistory` entry with `source = race`.
**Where**: `lib/domain/plan-lifecycle.ts` (modify, + tests)
**Depends on**: T19
**Reuses**: T8's `calculateVdot`
**Requirement**: LIFE-03

**Done when**:
- [x] Saving a finish time creates exactly one `RaceResult` and one new `VdotHistory` (`source = race`)
- [x] The computed VDOT matches `calculateVdot(raceDistance, finishTimeSec)`
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 2 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): record race result and derive VDOT`

---

### T21: `lib/domain/plan-lifecycle.ts` - initial VDOT carry-over

**What**: Implement `initialVdotForNewPlan(previousPlanId?)`: uses the `RaceResult`'s VDOT if present,
else the previous plan's `currentVdot`.
**Where**: `lib/domain/plan-lifecycle.ts` (modify, + tests)
**Depends on**: T20
**Reuses**: T20's `RaceResult` handling
**Requirement**: LIFE-04, LIFE-05

**Done when**:
- [x] With a `RaceResult` present, returns the VDOT computed from it
- [x] With no `RaceResult`, returns the archived plan's last `currentVdot`
- [x] With no previous plan at all, returns `undefined`/`null` (first-ever plan falls through to the
      normal VDOT-establishment flow)
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): carry VDOT into the next plan`

---

### T22: `lib/domain/plan-lifecycle.ts` - new-plan guard

**What**: Implement `createNewPlan(input)`: calls T13's `createPlan` after asserting no `active` plan
exists for the user (defense in depth alongside T3's DB index).
**Where**: `lib/domain/plan-lifecycle.ts` (modify, + tests)
**Depends on**: T21
**Reuses**: T13's `createPlan`, T21's carry-over
**Requirement**: LIFE-06

**Done when**:
- [x] Creating a plan while one `active` plan exists throws a typed, user-facing error
- [x] Creating a plan while none is `active` succeeds
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 2 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): enforce single active plan on creation`

---

### T23: `lib/domain/plan-lifecycle.ts` - recalculate in-progress plan

**What**: Implement `recalculateFromCurrentWeek(planId, changes)`: deletes and regenerates `Week`/
`Session` rows from the current week forward using `currentVdot`, leaving past weeks and their
`WorkoutLog`s untouched; re-validates via T10's validators.
**Where**: `lib/domain/plan-lifecycle.ts` (modify, + tests)
**Depends on**: T22
**Reuses**: T10-T12's generation functions
**Requirement**: EDIT-01, EDIT-02, EDIT-03

**Done when**:
- [x] Changing the race date or days mid-plan leaves past weeks' `Session`/`WorkoutLog` rows byte-for-byte
      unchanged
- [x] Future weeks are regenerated using the plan's `currentVdot`, not `initialVdot`
- [x] An invalid new race date/day-count is rejected with the same error as plan creation
- [x] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [x] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): recalculate plan from current week`

---

### T24: `lib/domain/vdot.ts` - retest due-check & pace recompute

**What**: Add `isRetestDue(lastVdotHistoryDate, today)` (≥4 weeks) and
`recomputeFuturePaces(planId, newVdot)` (updates planned pace on all not-yet-done future sessions).
**Where**: `lib/domain/vdot.ts` (modify, + tests)
**Depends on**: T13, T23
**Reuses**: T9's `paceForVdot`
**Requirement**: VDOT-05, VDOT-06 (recompute half)

**Done when**:
- [ ] `isRetestDue` is `false` at 3 weeks 6 days and `true` at exactly 4 weeks
- [ ] `recomputeFuturePaces` updates every not-yet-done session's planned pace and leaves `done`
      sessions untouched
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick
**Commit**: `feat(domain): VDOT retest due-check and pace recompute`

---

### T25: Login page, sign-in action, and e2e tests

**What**: Build `/login` with a username/password form and a Server Action calling NextAuth's
`signIn`, redirecting to `/dashboard` on success; write `e2e/auth.spec.ts` covering the full P1-A
Independent Test in the same task, since the login page is what makes T6/T7's wiring testable for
the first time.
**Where**: `app/login/page.tsx`, `app/login/actions.ts`, `e2e/auth.spec.ts`
**Depends on**: T7
**Reuses**: T6's NextAuth config, T4's seeded account
**Requirement**: AUTH-01, AUTH-02, AUTH-03, AUTH-05

**Done when**:
- [ ] Submitting correct credentials redirects to `/dashboard`; the e2e test asserts it
- [ ] Submitting incorrect credentials shows the generic "invalid credentials" message; the e2e
      test asserts it
- [ ] Visiting `/dashboard` while logged out redirects to `/login`; the e2e test asserts it
- [ ] Visiting `/register` and `/signup` returns 404; the e2e test asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 4 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): login page, sign-in action, and e2e tests`

---

### T26: VDOT establishment UI and e2e tests

**What**: Build the guided-test (instructions + result form) and manual-time-entry UI, posting to a
Server Action that calls T8's `calculateVdot`/`isPlausibleResult`; write the matching e2e tests in
the same task.
**Where**: `app/plan/new/vdot/page.tsx`, `app/plan/new/vdot/actions.ts`, `e2e/onboarding.spec.ts`
**Depends on**: T25, T24
**Reuses**: `lib/domain/vdot.ts`, T25's login helper
**Requirement**: VDOT-01, VDOT-02

**Done when**:
- [ ] A user with no prior VDOT is offered both the guided test and manual entry; e2e asserts it
- [ ] The guided-test path shows instructions, then a result-entry form; e2e asserts it
- [ ] An implausible time is rejected with a field-level error
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): VDOT establishment flow and e2e tests`

---

### T27: New-plan form UI and e2e tests

**What**: Build the race type/date/days-per-week form posting to a Server Action calling T22's
`createNewPlan`; surfaces `PLAN-02`'s warning and `PLAN-04`'s rejection message; extend
`e2e/onboarding.spec.ts` in the same task to cover the full P1-B Independent Test now that the whole
onboarding flow (VDOT + plan form) exists.
**Where**: `app/plan/new/page.tsx`, `app/plan/new/actions.ts`, `e2e/onboarding.spec.ts` (modify)
**Depends on**: T26, T22
**Reuses**: `lib/domain/plan-lifecycle.ts`, T26's VDOT step
**Requirement**: PLAN-01, PLAN-02, PLAN-03, PLAN-04

**Done when**:
- [ ] A 10km plan ~10 weeks out, created from a manually entered 5km time, shows ~10 weeks with the
      expected phase proportions; e2e asserts it
- [ ] A plan shorter than the recommended minimum still generates, with a visible warning; e2e
      asserts it
- [ ] Selecting <3 or >6 days is rejected with the 3-6 range explained; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): new-plan creation form and e2e tests`

---

### T28: Dashboard session list and e2e tests

**What**: Build `/dashboard` rendering the current week's sessions in date order with type, planned
pace, distance/duration, and done/missed/pending badges; write `e2e/dashboard.spec.ts` for the
rendering behavior in the same task.
**Where**: `app/dashboard/page.tsx`, `e2e/dashboard.spec.ts`
**Depends on**: T27, T18
**Reuses**: `lib/domain/session-status.ts`, T27's plan-creation flow
**Requirement**: DASH-01, DASH-02, DASH-03

**Done when**:
- [ ] Sessions render in date order with all required fields; e2e asserts it
- [ ] A past unlogged session shows `missed`; e2e asserts it
- [ ] A logged session shows `done` with actual pace next to planned pace; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): dashboard session list and e2e tests`

---

### T29: Lazy weekly reassessment wiring and e2e tests

**What**: Call T17's `reassessIfDue` for the most recently ended week before rendering, on every
dashboard load; extend `e2e/dashboard.spec.ts` in the same task to cover the reassessment trigger
and the taper-week edge case.
**Where**: `app/dashboard/page.tsx` (modify), `e2e/dashboard.spec.ts` (modify)
**Depends on**: T28, T17
**Reuses**: `lib/domain/weekly-adjustment.ts`
**Requirement**: DASH-04, Edge Case (taper week)

**Done when**:
- [ ] Opening the dashboard after a week ends reassesses it before the next week renders; e2e
      asserts it
- [ ] A second load on the same already-reassessed week does not recompute (relies on T17)
- [ ] After the last taper week ends before the race date, the dashboard shows that week's sessions
      again rather than an empty week; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): trigger weekly reassessment on dashboard load, with e2e tests`

---

### T30: VDOT retest prompt and e2e tests

**What**: Add a dismissible banner shown when T24's `isRetestDue` is true, with a submit path reusing
T26's result form and a dismiss-for-the-day control; write the matching e2e tests in the same task.
**Where**: `app/dashboard/retest-prompt.tsx`, `app/dashboard/actions.ts`, `e2e/dashboard.spec.ts` (modify)
**Depends on**: T29, T24
**Reuses**: T24's due-check, T26's result-entry UI
**Requirement**: VDOT-04, VDOT-06, VDOT-07

**Done when**:
- [ ] The banner shows when the latest VDOT is ≥4 weeks old; e2e asserts it
- [ ] Submitting a result adds a `VdotHistory` (`source = recalc`), updates `currentVdot`, and future
      sessions' planned paces change; e2e asserts it
- [ ] Dismissing hides it for the day and it reappears on the next visit; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): VDOT retest prompt and e2e tests`

---

### T31: Workout log creation UI and e2e tests

**What**: Build the log form (pace, distance, duration, RPE) per session, posting to a Server Action
with zod bounds validation; write `e2e/logging.spec.ts` for the create + validation paths in the
same task.
**Where**: `app/dashboard/log/[sessionId]/page.tsx`, `app/dashboard/log/[sessionId]/actions.ts`, `e2e/logging.spec.ts`
**Depends on**: T30
**Reuses**: `lib/domain/session-status.ts`
**Requirement**: LOG-01, LOG-02

**Done when**:
- [ ] A valid submission saves the log and marks the session `done`; e2e asserts it
- [ ] An out-of-bounds field (distance/duration/pace/RPE) is rejected with that field named; e2e
      asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): workout log creation and e2e tests`

---

### T32: Workout log edit/delete UI and e2e tests

**What**: Add edit and delete controls on an existing log, with Server Actions that overwrite the
log or remove it and recompute session status via T18; extend `e2e/logging.spec.ts` in the same
task for the edit/delete/already-reassessed paths, completing the full P1-D Independent Test.
**Where**: `app/dashboard/log/[sessionId]/page.tsx` (modify), `app/dashboard/log/[sessionId]/actions.ts` (modify), `e2e/logging.spec.ts` (modify)
**Depends on**: T31
**Reuses**: `lib/domain/session-status.ts`
**Requirement**: LOG-03, LOG-04, LOG-05

**Done when**:
- [ ] Editing overwrites the stored values; e2e asserts it
- [ ] Deleting removes the log and the session reverts to `pending`/`missed` per T18's rule; e2e
      asserts it
- [ ] Logging/editing/deleting works on a session whose week was already reassessed; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): workout log edit and delete, with e2e tests`

---

### T33: History screen - VDOT chart and e2e test

**What**: Build the VDOT-over-time chart from a plan's `VdotHistory` entries; write
`e2e/history.spec.ts` for this chart in the same task.
**Where**: `app/history/page.tsx`, `e2e/history.spec.ts`
**Depends on**: T32
**Reuses**: n/a
**Requirement**: HIST-01

**Done when**:
- [ ] The chart renders one point per `VdotHistory` entry for the current plan; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 1 test passes (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): VDOT history chart and e2e test`

---

### T34: History screen - pace chart & adherence, and e2e test

**What**: Add the actual-vs-planned pace chart per logged session and the weekly adherence metric;
extend `e2e/history.spec.ts` in the same task.
**Where**: `app/history/page.tsx` (modify), `e2e/history.spec.ts` (modify)
**Depends on**: T33
**Reuses**: `lib/domain/session-status.ts`
**Requirement**: HIST-02

**Done when**:
- [ ] The pace chart plots actual vs. planned pace per logged session; e2e asserts it
- [ ] Weekly adherence (`done / planned`) is shown per week; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 1 test passes (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): pace chart and weekly adherence, with e2e test`

---

### T35: History screen - past-plan selector, empty state, and e2e tests

**What**: Add a selector for archived plans (showing their `RaceResult` if present) and an explicit
empty state when a plan has no logged sessions; extend `e2e/history.spec.ts` in the same task,
completing the full P1-G Independent Test.
**Where**: `app/history/page.tsx` (modify), `e2e/history.spec.ts` (modify)
**Depends on**: T34
**Reuses**: n/a
**Requirement**: HIST-03, HIST-04

**Done when**:
- [ ] Selecting an archived plan shows that plan's own charts and race result; e2e asserts it
- [ ] A plan with zero logged sessions shows an explicit empty state, not an empty chart; e2e
      asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): past-plan selector and empty state, with e2e tests`

---

### T36: Race-result prompt UI and e2e test

**What**: Add a dashboard banner shown when the active plan is `archived` with no `RaceResult`, with
a Server Action calling T20's `recordRaceResult`; write `e2e/lifecycle.spec.ts` for this prompt in
the same task.
**Where**: `app/dashboard/race-result-prompt.tsx`, `e2e/lifecycle.spec.ts`
**Depends on**: T35, T20
**Reuses**: `lib/domain/plan-lifecycle.ts`
**Requirement**: LIFE-02

**Done when**:
- [ ] The prompt shows exactly when the active plan is `archived` and has no `RaceResult`; e2e
      asserts it
- [ ] Submitting a finish time saves the result and hides the prompt; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): race result prompt and e2e test`

---

### T37: New-plan bootstrap with VDOT carry-over, and e2e tests

**What**: Extend T27's new-plan form to pre-fill (editable) VDOT from T21's carry-over logic when
starting a plan after an archived one; surface T22's `LIFE-06` rejection if one is somehow still
active; extend `e2e/lifecycle.spec.ts` in the same task, completing the full P1-H Independent Test.
**Where**: `app/plan/new/page.tsx` (modify), `app/plan/new/actions.ts` (modify), `e2e/lifecycle.spec.ts` (modify)
**Depends on**: T36, T21, T27
**Reuses**: T21, T22, T27
**Requirement**: LIFE-04, LIFE-05, LIFE-06

**Done when**:
- [ ] A new plan after an archived plan with a `RaceResult` defaults its VDOT from that result,
      editable before confirming; e2e asserts it
- [ ] A new plan after an archived plan with no `RaceResult` defaults to the last `currentVdot`
- [ ] Attempting a second active plan shows `LIFE-06`'s rejection message; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): new-plan VDOT carry-over, with e2e tests`

---

### T38: Settings screen - display, and e2e tests

**What**: Build `/settings` showing the active plan's race type, date, days, and current VDOT, with
an empty state linking to plan creation when there is none; write `e2e/settings.spec.ts` for the
display paths in the same task.
**Where**: `app/settings/page.tsx`, `e2e/settings.spec.ts`
**Depends on**: T37, T23
**Reuses**: n/a
**Requirement**: SET-01, SET-03

**Done when**:
- [ ] All 4 fields render for an active plan; e2e asserts it
- [ ] With no active plan, settings says so and links to `/plan/new` instead of showing empty
      fields; e2e asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): settings display, with e2e tests`

---

### T39: Settings screen - edit, and e2e tests

**What**: Add race-date/days editing controls wired to T23's `recalculateFromCurrentWeek`, surfacing
the same validation messages as plan creation; extend `e2e/settings.spec.ts` in the same task,
completing the full P1-I and P1-J Independent Tests.
**Where**: `app/settings/page.tsx` (modify), `app/settings/actions.ts`, `e2e/settings.spec.ts` (modify)
**Depends on**: T38, T23
**Reuses**: `lib/domain/plan-lifecycle.ts`
**Requirement**: SET-02, EDIT-02

**Done when**:
- [ ] Changing days from settings triggers the same recalculation as `EDIT-01`/`EDIT-03`; e2e
      asserts it, including that already-logged weeks are preserved
- [ ] An invalid race date or day count is rejected with the plan-creation validation message; e2e
      asserts it
- [ ] Gate check passes: `npx vitest run lib/domain --reporter=verbose && npx playwright test --reporter=list`
- [ ] Test count: 2 tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): settings edit, with e2e tests`

---

### T40: Configure Vercel + Supabase deploy

**What**: Create the Vercel project, set env vars (pooled `DATABASE_URL`, `DIRECT_URL`,
`NEXTAUTH_SECRET`, seed credentials), run the migration and seed against the production database.

> **Stop and confirm with the user before this task runs** - creating cloud resources, deploying,
> and touching a production database are exactly the actions the project's blast-radius rule
> requires an explicit go-ahead for, beyond the standing approval to implement tasks locally.

**Where**: Vercel project settings (no repo file change beyond `vercel.json` if needed)
**Depends on**: T39
**Reuses**: T3's migration, T4's seed script
**Requirement**: -

**Done when**:
- [ ] The app is reachable at its Vercel URL and the login/dashboard flow works against the
      production database
- [ ] `DATABASE_URL` is the pooled (6543) connection string and `DIRECT_URL` is the direct (5432) one

**Tests**: none
**Gate**: build
**Commit**: `chore: configure Vercel and Supabase deployment`

---

### T41: Mobile responsive pass

**What**: Walk all 5 screens (login, onboarding, dashboard, history, settings) at a phone viewport
width and fix layout issues found.
**Where**: touches whichever `app/**/page.tsx` files need layout fixes
**Depends on**: T40
**Reuses**: n/a
**Requirement**: -

**Done when**:
- [ ] Every screen is usable (no horizontal scroll, no overlapping controls) at a 390px-wide viewport
- [ ] Existing e2e suite still passes after any layout changes

**Tests**: e2e (re-run existing suite)
**Gate**: full
**Commit**: `fix(ui): mobile responsive layout`

---

### T42: Fix issues found in the mobile pass

**What**: Address any specific bugs logged during T41 that needed more than a layout tweak (e.g. a
touch-target too small, a modal that doesn't fit the viewport).
**Where**: as identified in T41
**Depends on**: T41
**Reuses**: n/a
**Requirement**: -

**Done when**:
- [ ] Every issue logged in T41 is resolved or explicitly deferred with the user's sign-off
- [ ] Full gate passes

**Tests**: e2e (re-run existing suite)
**Gate**: full
**Commit**: `fix(ui): resolve mobile issues found in review`

---

### T43: Final UAT walk

**What**: Walk the full spec Success Criteria end-to-end, once locally and once against the deployed
Vercel URL from an actual phone browser: create a 10km plan from a manual 5km time, log a fatigued
week, confirm next week reduces, advance 4 weeks, confirm the retest prompt, reach the race date,
submit the result, start a new plan with the carried-over VDOT.

> Accessing the deployed production URL from a phone is observation only - no further deploys or
> prod DB writes beyond what the walk itself performs as a normal user would.

**Where**: n/a (manual + e2e walk, no new code expected)
**Depends on**: T42
**Reuses**: the full e2e suite
**Requirement**: - (Success Criteria)

**Done when**:
- [ ] All three Success Criteria bullets from spec.md are demonstrated, locally and on the deployed URL
- [ ] No manual database edits were needed at any point in the walk

**Tests**: e2e (full suite, plus the manual walk)
**Gate**: full
**Commit**: none - this task only verifies prior commits; no new changes expected

---

## Checks

**Run unit**: `npx vitest run lib/domain --reporter=verbose`
**Run e2e**: `npx playwright test --reporter=list`

**C1** - Correct credentials create a session and redirect to `/dashboard` (AUTH-01, AC 1)
Proof: run e2e | ✓ auth.spec.ts > login succeeds with correct credentials and redirects to dashboard

**C2** - Wrong credentials are rejected with a generic message (AUTH-02, AC 2)
Proof: run e2e | ✓ auth.spec.ts > login with wrong credentials shows generic invalid-credentials message

**C3** - An unauthenticated request for a protected page redirects to `/login` (AUTH-03, AC 3)
Proof: run e2e | ✓ auth.spec.ts > visiting /dashboard while logged out redirects to /login

**C4** - The stored password is a salted hash, never plaintext (AUTH-04, AC 4)
Proof: run unit | ✓ auth > stored passwordHash is bcrypt, never the plaintext password

**C5** - No UI path exists to register a second account (AUTH-05, AC 5)
Proof: run e2e | ✓ auth.spec.ts > visiting /register and /signup returns 404

**C6** - A new plan with no prior VDOT offers a guided test or manual entry (VDOT-01, AC 1)
Proof: run e2e | ✓ onboarding.spec.ts > new plan offers guided test or manual time entry

**C7** - The guided test shows instructions, then a result-entry form (VDOT-02, AC 2)
Proof: run e2e | ✓ onboarding.spec.ts > guided test shows instructions and a result entry form

**C8** - Submitting a VDOT-establishing result records a VdotHistory entry with the right source (VDOT-03, AC 3)
Proof: run unit | ✓ plan-generator > createPlan records VdotHistory with source test or manual

**C9** - Plan length is computed as raceDate minus today (PLAN-01, AC 4)
Proof: run unit | ✓ plan-generator > computePlanWeeks returns raceDate minus today in weeks

**C10** - A below-minimum plan still generates, with a visible warning (PLAN-02, AC 5)
Proof: run e2e | ✓ onboarding.spec.ts > a plan shorter than the recommended minimum shows a visible warning

**C11** - 3-6 training days are accepted and types are placed only on those days (PLAN-03, AC 6)
Proof: run unit | ✓ plan-generator > generateSessions places a session on each selected day only

**C12** - Fewer than 3 or more than 6 days is rejected with the range explained (PLAN-04, AC 7)
Proof: run e2e | ✓ onboarding.spec.ts > selecting fewer than 3 or more than 6 days is rejected with the 3-6 range explained

**C13** - Phases are split in the documented proportions (PLAN-05, AC 8)
Proof: run unit | ✓ plan-generator > splitPhases assigns taper, base, build and peak in the documented proportions

**C14** - Session types are weighted correctly per phase (PLAN-06, AC 9)
Proof: run unit | ✓ plan-generator > generateSessions weights Fácil and Longão in base and Tempo and Intervalado in build and peak

**C15** - Planned pace/distance is derived from VDOT and session type (PLAN-07, AC 10)
Proof: run unit | ✓ vdot > paceForVdot returns the correct pace for each session type

**C16** - Exactly 5km/10km/21km/42km are supported (PLAN-08, AC 11)
Proof: run unit | ✓ plan-generator > computePlanWeeks supports exactly the four race types and rejects others

**C17** - The dashboard shows the current week's sessions in date order with details (DASH-01, AC 1)
Proof: run e2e | ✓ dashboard.spec.ts > shows the current week's sessions in date order with type, pace and distance

**C18** - A past, unlogged session shows as missed (DASH-02, AC 2)
Proof: run e2e | ✓ dashboard.spec.ts > a past session with no log shows as missed

**C19** - A logged session shows as done with actual pace next to planned pace (DASH-03, AC 3)
Proof: run e2e | ✓ dashboard.spec.ts > a logged session shows as done with the actual pace next to the planned pace

**C20** - Opening the dashboard after a week ends triggers reassessment before rendering the next week (DASH-04, AC 4)
Proof: run e2e | ✓ dashboard.spec.ts > opening the dashboard after a week ends reassesses before showing next week

**C21** - The dashboard shows a retest prompt when the VDOT is due (VDOT-04, AC 5)
Proof: run e2e | ✓ dashboard.spec.ts > shows a retest prompt when the VDOT is 4 or more weeks old

**C22** - A valid workout log is saved and the session marked done (LOG-01, AC 1)
Proof: run e2e | ✓ logging.spec.ts > submitting a valid workout log marks the session done

**C23** - An out-of-bounds field is rejected and named in the error (LOG-02, AC 2)
Proof: run e2e | ✓ logging.spec.ts > an out-of-range field is rejected and named in the error

**C24** - Editing a log overwrites its stored values (LOG-03, AC 3)
Proof: run e2e | ✓ logging.spec.ts > editing a log overwrites its stored values

**C25** - Deleting a log reverts the session's status correctly (LOG-04, AC 4)
Proof: run e2e | ✓ logging.spec.ts > deleting a log reverts the session to pending or missed

**C26** - A session in an already-reassessed week can still be logged, edited and deleted (LOG-05, AC 5)
Proof: run e2e | ✓ logging.spec.ts > a session in an already-reassessed week can still be logged, edited and deleted

**C27** - The 3 fatigue signals are computed at their documented thresholds (ADJ-01, AC 1)
Proof: run unit | ✓ weekly-adjustment > computeSignals flags pace, RPE and missed-ratio at their documented thresholds

**C28** - 2 or 3 signals produce `reduce` with -20% distance and one intensity step down (ADJ-02, AC 2)
Proof: run unit | ✓ weekly-adjustment > decide returns reduce and applyDecision cuts distance 20% and steps intensity down

**C29** - Exactly 1 signal produces `maintain`, cloning the current week (ADJ-03, AC 3)
Proof: run unit | ✓ weekly-adjustment > decide returns maintain and applyDecision clones the current week unchanged

**C30** - 0 signals produce `progress`, leaving the next week as generated (ADJ-04, AC 4)
Proof: run unit | ✓ weekly-adjustment > decide returns progress and leaves the next week as originally generated

**C31** - A reassessment persists a WeeklyAdjustment row with signals, decision and percentage (ADJ-05, AC 5)
Proof: run unit | ✓ weekly-adjustment > reassessIfDue persists a WeeklyAdjustment row with its signals, decision and percentage

**C32** - A week is reassessed at most once (ADJ-06, AC 6)
Proof: run unit | ✓ weekly-adjustment > reassessIfDue is a no-op when the week is already reassessed

**C33** - The retest prompt's due-check is true once the VDOT is 4+ weeks old (VDOT-05, AC 1)
Proof: run unit | ✓ vdot > isRetestDue is true once the latest VdotHistory entry is 4 or more weeks old

**C34** - Submitting a retest result updates the VDOT and future planned paces (VDOT-06, AC 2)
Proof: run e2e | ✓ dashboard.spec.ts > submitting a retest result updates the VDOT and future sessions' planned paces

**C35** - Dismissing the retest prompt hides it for the day only (VDOT-07, AC 3)
Proof: run e2e | ✓ dashboard.spec.ts > dismissing the retest prompt hides it today and shows it again on the next visit

**C36** - The history screen shows a VDOT-over-time chart (HIST-01, AC 1)
Proof: run e2e | ✓ history.spec.ts > shows a VDOT-over-time chart built from VdotHistory

**C37** - The history screen shows pace and weekly adherence (HIST-02, AC 2)
Proof: run e2e | ✓ history.spec.ts > shows actual-vs-planned pace and weekly adherence

**C38** - Selecting an archived plan shows its own charts and race result (HIST-03, AC 3)
Proof: run e2e | ✓ history.spec.ts > selecting an archived plan shows its own charts and race result

**C39** - A plan with no logged sessions shows an explicit empty state (HIST-04, AC 4)
Proof: run e2e | ✓ history.spec.ts > a plan with no logged sessions shows an explicit empty state

**C40** - A plan archives once its race date passes (LIFE-01, AC 1)
Proof: run unit | ✓ plan-lifecycle > archiveIfPast sets status to archived once raceDate is in the past

**C41** - An archived plan with no result shows the result prompt (LIFE-02, AC 2)
Proof: run e2e | ✓ lifecycle.spec.ts > an archived plan with no race result shows a prompt asking for the finish time

**C42** - Submitting a finish time saves the result and adds a race-sourced VdotHistory entry (LIFE-03, AC 3)
Proof: run unit | ✓ plan-lifecycle > recordRaceResult saves the result and adds a VdotHistory entry with source race

**C43** - A new plan without a prior result uses the archived plan's last currentVdot (LIFE-04, AC 4)
Proof: run unit | ✓ plan-lifecycle > initialVdotForNewPlan falls back to the archived plan's currentVdot when no race result exists

**C44** - A new plan defaults its VDOT from the last race result, editable before confirming (LIFE-05, AC 5)
Proof: run e2e | ✓ lifecycle.spec.ts > a new plan defaults its VDOT from the last race result and lets the user edit it before confirming

**C45** - At most one active plan is allowed at a time (LIFE-06, AC 6 + Edge Case: second active plan)
Proof: run unit | ✓ plan-lifecycle > createNewPlan rejects a second active plan while one already exists

**C46** - Editing a plan recalculates only from the current week forward, preserving the past (EDIT-01, AC 1)
Proof: run unit | ✓ plan-lifecycle > recalculateFromCurrentWeek regenerates only future weeks and leaves past WorkoutLogs untouched

**C47** - An invalid edit is rejected with the plan-creation validation message (EDIT-02, AC 2)
Proof: run e2e | ✓ settings.spec.ts > editing to an invalid race date or day count is rejected with the plan-creation validation message

**C48** - Recalculation uses currentVdot, not initialVdot (EDIT-03, AC 3)
Proof: run unit | ✓ plan-lifecycle > recalculateFromCurrentWeek re-derives future sessions from currentVdot, not initialVdot

**C49** - Settings shows the active plan's configuration (SET-01, AC 1)
Proof: run e2e | ✓ settings.spec.ts > shows the active plan's race type, date, days and current VDOT

**C50** - Editing from settings applies the same recalculation as plan editing (SET-02, AC 2)
Proof: run e2e | ✓ settings.spec.ts > changing days from settings triggers the same recalculation as plan editing

**C51** - With no active plan, settings links to plan creation instead of showing empty fields (SET-03, AC 3)
Proof: run e2e | ✓ settings.spec.ts > with no active plan, settings links to plan creation instead of showing empty fields

**C52** - A future-dated log is accepted and marks the session done (Edge Case: future-dated log)
Proof: run unit | ✓ session-status > a future-dated WorkoutLog is accepted and the session is marked done

**C53** - A week with zero logs resolves missed=true and the other two signals as not-triggered (Edge Case: zero-logged week)
Proof: run unit | ✓ weekly-adjustment > a week with zero logs resolves missed=true and pace/RPE as not-triggered

**C54** - A physically implausible VDOT test/race time is rejected (Edge Case: implausible time)
Proof: run unit | ✓ vdot > isPlausibleResult rejects a physically impossible time for the given distance

**C55** - The last taper week is shown again if the race date has not yet arrived (Edge Case: taper-week rounding)
Proof: run e2e | ✓ dashboard.spec.ts > after the last taper week ends before the race date, the dashboard shows that week's sessions again instead of an empty week

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** T3/T4 live-DB blocker (above) resolved 2026-11-07 - user provided Supabase
pooled `DATABASE_URL` (6543) and `DIRECT_URL` (5432) credentials, written to local `.env`
(gitignored). `npx prisma migrate deploy` applied `20261107191423_init` cleanly; verified live via
a scratch script: `pg_indexes` shows `Plan_userId_active_key` as
`CREATE UNIQUE INDEX ... ON public."Plan" USING btree ("userId") WHERE (status = 'ACTIVE')`, a
second `ACTIVE` plan insert for the same user fails with `P2002`, `npm run seed` produced exactly
one `User` row (re-run twice, no duplicate), and its `passwordHash` is bcrypt-shaped (`$2b$...`).
All T3/T4 Done-when items are now checked.

T7's file is `proxy.ts`, not `middleware.ts` as tasks.md names it: Next.js 16 (resolved by
`create-next-app@latest` in T1) renamed and requires the convention as `proxy.ts` -
`middleware.ts` build-fails outright. Behavior (NextAuth `withAuth` redirecting unauthenticated
requests on the matched paths to `/login`) is unchanged; see the `SPEC_DEVIATION` comment in the
file. `npm run build`/`typecheck`/`lint` also needed `NODE_OPTIONS="--max-old-space-size=2048"`
in this session after a transient OOM under heavy background memory pressure on this machine -
not a code issue, no script changes made for it.

Phase 2 spec-precision gaps (spec.md does not pin an exact value, so the Batch 2 worker chose one
- flag if the Verifier or a later spec update disagrees): Long-run pace is bounded (slower than
marathon pace, faster than Easy) at 74% intensity, not pinned like Easy/Tempo/Interval (70/88/
97.5%). Session volumes: Easy 40min, Long 75min, Tempo 25min, Interval 20min, x0.6 in taper (one
Tempo, no Long/Interval in taper); distance = duration / VDOT pace. Build/peak Tempo/Interval
weighting is "a larger share than base", majority only at 3 days/week (a literal majority at 6
days/week would mean 4 hard sessions). `isPlausibleResult` accepts VDOT in `(0, 90]`. Plan weeks =
whole UTC calendar weeks between today and race date, rounded down.

Build-gate OOM (Phase 2 end, recurring): `npm run build`'s internal TypeScript worker crashes with
a V8 "Committing semi space failed" heap OOM on this machine, independent of `NODE_OPTIONS`
(`--max-old-space-size` up to 4096 and `--max-semi-space-size=64` both tried, same crash) - the
orchestrator reproduced it directly via `npx next build`, and the Batch 2 worker reproduced it on
the Phase 1 baseline with Phase 2's files moved out, confirming it is a machine memory-pressure
issue (other apps - VS Code, Chrome, multiple Claude processes - plus Windows memory compression
leave too little headroom for the type-check worker's V8 heap), not a code defect. `typecheck`
(`tsc --noEmit`) and `lint` both pass standalone. User decision 2026-11-07: proceed to Batch 3
rather than pause to free memory now; retry the full Build gate later when more headroom is
available (before `check_proofs.py` and again before T40's deploy). Resolved at Batch 3's
phase-end Build gate (`13baa4e`): build/typecheck/lint all green with no `NODE_OPTIONS` override -
the OOM did not recur, confirming it was transient machine memory pressure, not a standing issue.

Phase 3 deviations (for the Verifier to review): `applyDecision`'s signature grew a third
argument `{ currentWeek, vdot }` (design.md only showed 2 args) - `maintain` needs the current
week to clone and `reduce` needs the plan's VDOT to re-derive the stepped-down pace via
`paceForVdot`; a `SPEC_DEVIATION` comment is in `lib/domain/weekly-adjustment.ts`. `reduce` steps
Tempo->Easy, Interval->Tempo, cuts distance/duration x0.8 (duration rounded to whole minutes -
Int column; distance to 2 decimals). `maintain` clones the current week's sessions with dates
shifted +7 days onto the same weekdays. `computeSignals` thresholds are inclusive, integer math
(no float error at exactly 5%), uses only logged sessions for pace/RPE. `reassessIfDue` inserts
the `WeeklyAdjustment` row first (so a duplicate hits the unique constraint - caught `P2002` ->
null - before touching next week's sessions), updates next week's sessions in place (not
delete+recreate, since a session may carry a future-dated log already), and does not itself check
the week has ended (the dashboard caller, T29, must pass an already-ended week).

**Known edge case flagged for the T19-T24 batch:** `reassessIfDue`'s `maintain` path pairs the
ended week's sessions with the next week's by position/index: if a mid-plan days-per-week edit
(T23's `recalculateFromCurrentWeek`) ever leaves an ended week and its following week with a
different session count, that pairing breaks. Does not happen in the normal flow (both weeks are
generated with the same `daysPerWeek` until an edit changes it) - check whether T23's
recalculation can land adjacent to an unreassessed week with a different day count, and if so,
either guard against it or document it as an accepted limitation.
**Resolved in T23 (guarded):** it could happen - an edit in week k rebuilds week k with the new
days while week k-1 (ended) may still be unreassessed. `recalculateFromCurrentWeek` now calls
`reassessIfDue(week k-1)` before rebuilding, so k-1 is never paired later with a rebuilt week;
from week k on every week shares the new day pattern. Proven by the test "settles the ended
week's pending reassessment..." (fails with the guard removed). Accepted trade-offs: (1) that
reassessment's effect on week k is replaced by the regeneration (the `WeeklyAdjustment` row stays);
(2) a logged session in a rebuilt week is kept (WorkoutLogs are never deleted) and stands in for
the regenerated session on its date - if it sits on a weekday the edit removed, that week has one
extra session; `reassessIfDue` then still updates every next-week session (drafts >= sessions, no
crash) but a `maintain` may clone that extra day's date; (3) unlogged sessions earlier in the
current week are regenerated on the new days and may show as missed. Other T23 choices:
signature gained `today` (SPEC_DEVIATION marker); phases re-split over the whole new plan length
(`splitPhases(N)` positions from the current week on); EDIT-02 spec-precision gap - PLAN-02 never
rejects a short race date, so creation has no race-date error to reuse; a race date leaving no
week from the current one is rejected with `RACE_DATE_ERROR`; the day-count error is the exact
`createPlan` message (`DAYS_PER_WEEK_ERROR`, now exported from `plan-generator.ts`). The function
does not check `status = ACTIVE` itself - T39 must only call it for the active plan (LIFE-01).
**Dispatched:** Batch 1 (Phase 1: T1-T7) dispatched 2026-11-07, pre-HEAD 4ebd525 - returned, all
complete. Batch 2 (Phase 2: T8-T13) dispatched 2026-11-07, pre-HEAD 6279836 - returned, all
complete (Build gate deferred per above). Batch 3 (Phase 3: T14-T18) dispatched 2026-11-07,
pre-HEAD 2df1b70 - returned, all complete, Build gate green. Batch 4 (Phase 4+5: T19-T25)
dispatched 2026-11-07, pre-HEAD 13baa4e
**Walked:** none

---

## Phase Execution Map

Visual representation of task ordering. Phases run in sequence, and tasks within a phase run in order:

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9 → Phase 10 → Phase 11 → Phase 12

Phase 1  (Foundation):            T1 → T2 → T3 → T4 → T5 → T6 → T7
Phase 2  (VDOT & Plan Gen):       T8 → T9 → T10 → T11 → T12 → T13
Phase 3  (Weekly Adj & Status):   T14 → T15 → T16 → T17 → T18
Phase 4  (Plan Lifecycle):        T19 → T20 → T21 → T22 → T23 → T24
Phase 5  (Login UI):              T25
Phase 6  (Onboarding UI):         T26 → T27
Phase 7  (Dashboard UI):          T28 → T29 → T30
Phase 8  (Logging UI):            T31 → T32
Phase 9  (History UI):            T33 → T34 → T35
Phase 10 (Lifecycle UI):          T36 → T37
Phase 11 (Edit & Settings UI):    T38 → T39
Phase 12 (Deploy & Polish):       T40 → T41 → T42 → T43
```

Execution is strictly sequential - there is no intra-phase parallelism. A single agent (or batch
worker) works one task at a time, in order. With 43 tasks, this feature packs into roughly 6
task-budgeted batches (~7 tasks per worker) once Execute begins; the orchestrator will offer
sub-agent delegation before dispatching the first batch.
