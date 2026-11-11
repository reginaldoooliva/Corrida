# Coach Virtual verification

**Verdict**: PASS - FAIL at bde8a32 (7 findings below); every finding closed and proofs re-run
**Proofs**: `proofs.md` at a258f13 (58 pass, 0 fail); judged at bde8a32
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `e2e/auth.spec.ts` `login succeeds with correct credentials and redirects to dashboard` | yes |
| C2 | `e2e/auth.spec.ts` `login with wrong credentials shows generic invalid-credentials message` | yes |
| C3 | `e2e/auth.spec.ts` `visiting /dashboard while logged out redirects to /login` | yes |
| C4 | `lib/domain/auth.test.ts` `stored passwordHash is bcrypt, never the plaintext password` | no - the hash is made by `bcrypt.hash` inside the test's own `beforeEach`; no app code (`prisma/seed.ts`) runs, so it passes even if the seed stored the plaintext |
| C5 | `e2e/auth.spec.ts` `visiting /register and /signup returns 404` | yes |
| C6 | `e2e/onboarding.spec.ts` `new plan offers guided test or manual time entry` | yes |
| C7 | `e2e/onboarding.spec.ts` `guided test shows instructions and a result entry form` | yes |
| C8 | `lib/domain/plan-generator.test.ts` `createPlan records VdotHistory with source test or manual` | yes |
| C9 | `lib/domain/plan-generator.test.ts` `computePlanWeeks returns raceDate minus today in weeks` | yes |
| C10 | `e2e/onboarding.spec.ts` `a plan shorter than the recommended minimum still generates, with a visible warning` | yes |
| C11 | `lib/domain/plan-generator.test.ts` `generateSessions places a session on each selected day only` | yes |
| C12 | `e2e/onboarding.spec.ts` `selecting fewer than 3 or more than 6 days is rejected with the 3-6 range explained` | yes |
| C13 | `lib/domain/plan-generator.test.ts` `splitPhases assigns taper, base, build and peak in the documented proportions for a 10-week plan` / `... for an 18-week plan` | yes |
| C14 | `lib/domain/plan-generator.test.ts` `generateSessions weights Fácil and Longão in base and Tempo and Intervalado in build and peak` | yes |
| C15 | `lib/domain/vdot.test.ts` `paceForVdot returns the correct pace for each session type ($type)` / `(LONG)` | no - pace is checked against the Daniels table at one VDOT (50) only, LONG only by bounds, and the planned distance/duration the criterion also fixes is not asserted |
| C16 | `lib/domain/plan-generator.test.ts` `computePlanWeeks supports exactly the four race types and rejects others` | yes |
| C17 | `e2e/dashboard.spec.ts` `shows the current week's sessions in date order with type, pace and distance` | no - each row is checked only for the day and `plannedDistanceKm`; the session type and planned pace are not asserted |
| C18 | `e2e/dashboard.spec.ts` `a past session with no log shows as missed` | yes |
| C19 | `e2e/dashboard.spec.ts` `a logged session shows as done with the actual pace next to the planned pace` | no - asserts `Feito` and the actual `4:40/km`; the planned pace beside it is not asserted |
| C20 | `e2e/dashboard.spec.ts` `opening the dashboard after a week ends reassesses before showing next week` | no - asserts the `WeeklyAdjustment` row exists after load, not that the rendered week-2 sessions carry the reduction (the "before rendering" part) |
| C21 | `e2e/dashboard.spec.ts` `shows a retest prompt when the VDOT is 4 or more weeks old` | yes |
| C22 | `e2e/logging.spec.ts` `submitting a valid workout log marks the session done` | yes |
| C23 | `e2e/logging.spec.ts` `an out-of-range field is rejected and named in the error` | yes |
| C24 | `e2e/logging.spec.ts` `editing a log overwrites its stored values` | yes |
| C25 | `e2e/logging.spec.ts` `deleting a log reverts the session to pending or missed` | yes |
| C26 | `e2e/logging.spec.ts` `a session in an already-reassessed week can still be logged, edited and deleted` | yes |
| C27 | `lib/domain/weekly-adjustment.test.ts` `computeSignals flags pace, RPE and missed-ratio at their documented thresholds` | no - thresholds are pinned, but the fixture's unlogged session has planned pace 300, equal to the logged average, so averaging planned pace over all sessions instead of "das sessões registradas" (ADJ-01) would still pass |
| C28 | `lib/domain/weekly-adjustment.test.ts` `decide returns reduce and applyDecision cuts distance 20% and steps intensity down` | yes |
| C29 | `lib/domain/weekly-adjustment.test.ts` `decide returns maintain and applyDecision clones the current week unchanged` | yes |
| C30 | `lib/domain/weekly-adjustment.test.ts` `decide returns progress and leaves the next week as originally generated` | yes |
| C31 | `lib/domain/weekly-adjustment.test.ts` `reassessIfDue persists a WeeklyAdjustment row with its signals, decision and percentage` | yes |
| C32 | `lib/domain/weekly-adjustment.test.ts` `reassessIfDue is a no-op when the week is already reassessed` | yes |
| C33 | `lib/domain/vdot.test.ts` `isRetestDue is true once the latest VdotHistory entry is 4 or more weeks old` | yes |
| C34 | `e2e/dashboard.spec.ts` `submitting a retest result updates the VDOT and future sessions' planned paces` | yes |
| C35 | `e2e/dashboard.spec.ts` `dismissing the retest prompt hides it today and shows it again on the next visit` | yes |
| C36 | `e2e/history.spec.ts` `shows a VDOT-over-time chart built from VdotHistory` | yes |
| C37 | `e2e/history.spec.ts` `shows actual-vs-planned pace and weekly adherence` | yes |
| C38 | `e2e/history.spec.ts` `selecting an archived plan shows its own charts and race result` | yes |
| C39 | `e2e/history.spec.ts` `a plan with no logged sessions shows an explicit empty state` | yes |
| C40 | `lib/domain/plan-lifecycle.test.ts` `archiveIfPast sets status to archived once raceDate is in the past` | yes |
| C41 | `e2e/lifecycle.spec.ts` `an archived plan with no race result shows a prompt asking for the finish time` | yes |
| C42 | `lib/domain/plan-lifecycle.test.ts` `recordRaceResult saves the result and adds a VdotHistory entry with source race` | yes |
| C43 | `lib/domain/plan-lifecycle.test.ts` `initialVdotForNewPlan falls back to the archived plan's currentVdot when no race result exists` | yes |
| C44 | `e2e/lifecycle.spec.ts` `a new plan defaults its VDOT from the last race result and lets the user edit it before confirming` | yes |
| C45 | `lib/domain/plan-lifecycle.test.ts` `createNewPlan rejects a second active plan while one already exists` | yes |
| C46 | `lib/domain/plan-lifecycle.test.ts` `recalculateFromCurrentWeek regenerates only future weeks and leaves past WorkoutLogs untouched` | yes |
| C47 | `e2e/settings.spec.ts` `editing to an invalid race date or day count is rejected with the plan-creation validation message` | yes |
| C48 | `lib/domain/plan-lifecycle.test.ts` `recalculateFromCurrentWeek re-derives future sessions from currentVdot, not initialVdot` | yes |
| C49 | `e2e/settings.spec.ts` `shows the active plan's race type, date, days and current VDOT` | yes |
| C50 | `e2e/settings.spec.ts` `changing days from settings triggers the same recalculation as plan editing` | yes |
| C51 | `e2e/settings.spec.ts` `with no active plan, settings links to plan creation instead of showing empty fields` | yes |
| C52 | `lib/domain/session-status.test.ts` `a future-dated WorkoutLog is accepted and the session is marked done` | yes |
| C53 | `lib/domain/weekly-adjustment.test.ts` `a week with zero logs resolves missed=true and pace/RPE as not-triggered` | yes |
| C54 | `lib/domain/vdot.test.ts` `isPlausibleResult rejects a physically impossible time for the given distance` | yes |
| C55 | `e2e/dashboard.spec.ts` `after the last taper week ends before the race date, the dashboard shows that week's sessions again instead of an empty week` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| AUTH-04 is never checked against the app's stored hash | `lib/domain/auth.test.ts:32` hashes inside the test, `:60-63` asserts on that local value; `prisma/seed.ts:18` (the code that stores the hash) is never run | extract the seed's hashing into a function (or run the seed's upsert against the prisma mock) and assert that the `passwordHash` it writes is bcrypt and not `SEED_PASSWORD` | 99bd955 - seeding goes through `seedAccount`; C4 (`stored passwordHash is bcrypt, never the plaintext password`) asserts on the hash it upserts |
| DASH-01 row content: type and planned pace not asserted | `e2e/dashboard.spec.ts:35-36` checks only `formatSessionDay(session.date)` and `String(session.plannedDistanceKm)` | assert each row also shows the session type label and `formatPace(session.plannedPaceSecPerKm)` | a258f13 - C17 asserts `SESSION_LABEL[type]`, `formatPace(plannedPace)` and `${km}km` per row |
| DASH-03: planned pace beside the actual pace not asserted | `e2e/dashboard.spec.ts:68-70` checks `Feito` and `4:40/km` only | also assert the row shows `formatPace(pastSession.plannedPaceSecPerKm)` | a258f13 - C19 asserts `Pace planejado: ${formatPace(plannedPace)}` beside `4:40/km` |
| DASH-04 "before rendering" not proven | `e2e/dashboard.spec.ts:88-90` checks the heading and that the adjustment row exists; nothing compares the rendered week-2 sessions with the reduced values | assert a rendered week-2 row shows the reduced distance (and stepped-down pace) on the first load | a258f13 - C20 asserts every week-2 session is shorter than before the visit and the rows render the reduced `${km}km` on the first load |
| ADJ-01 pace signal: "planned average of logged sessions" not pinned | `lib/domain/weekly-adjustment.test.ts:100`: the unlogged session's planned 300 equals the logged average, and the boundary tests at `:106-108` have no unlogged session. Own example (logged 300->315 plus unlogged planned 400) holds at HEAD, but no check would catch a regression | add a case where an unlogged session's planned pace would flip the result, e.g. logged 300/315 + unlogged 400 -> `paceDeviation: true` | e2cca35 - C27's fixture uses an unlogged planned 400, which would flip `paceDeviation` if it were averaged in |
| PLAN-07 proven at one VDOT and for pace only | `lib/domain/vdot.test.ts:122-148` uses `VDOT = 50` only; LONG checked only by bounds; distance/duration not part of C15's test | add table values at a second VDOT (e.g. 40 or 60) and point C15 at, or add, an assertion on planned distance/duration | 01e29b0 - C15's `(LONG)` test also checks every type gets faster from VDOT 35 to 65 and that generated distance = duration at the VDOT pace |
| Reassessment boundary is one day later than the spec states, with no check at the boundary | `app/dashboard/page.tsx:90` reassesses when `week.endDate < today`; ADJ-01 and DASH-04 say "hoje ≥ data de fim da semana" (`endDate` is the week's last day, `plan-generator.ts:208`). C20 seeds a week that ended 4 days ago, so the endDate day itself is never tested; no `SPEC_DEVIATION` records it | decide the rule (spec literal `>=` or "day after the last day") - if the latter, append a requirement/deviation; either way add a test with `today == endDate` | 8f4968b + a258f13 - rule kept as "day after the last day", moved to `isWeekDue` with a `SPEC_DEVIATION` marker and a unit test at `today == endDate`; C20 now also asserts no `WeeklyAdjustment` on week 1's last day |
