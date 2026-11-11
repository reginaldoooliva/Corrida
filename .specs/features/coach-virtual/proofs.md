# coach-virtual proofs

**HEAD**: a258f13
**Tree**: clean
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 58 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ok auth.spec.ts › login succeeds with correct credentials and redirects to dashboard` | pass |
| C2 | `run e2e / ok auth.spec.ts › login with wrong credentials shows generic invalid-credentials message` | pass |
| C3 | `run e2e / ok auth.spec.ts › visiting /dashboard while logged out redirects to /login` | pass |
| C4 | `run unit / ✓ auth > stored passwordHash is bcrypt, never the plaintext password` | pass |
| C5 | `run e2e / ok auth.spec.ts › visiting /register and /signup returns 404` | pass |
| C6 | `run e2e / ok onboarding.spec.ts › new plan offers guided test or manual time entry` | pass |
| C7 | `run e2e / ok onboarding.spec.ts › guided test shows instructions and a result entry form` | pass |
| C8 | `run unit / ✓ plan-generator > createPlan records VdotHistory with source test or manual` | pass |
| C9 | `run unit / ✓ plan-generator > computePlanWeeks returns raceDate minus today in weeks` | pass |
| C10 | `run e2e / ok onboarding.spec.ts › a plan shorter than the recommended minimum still generates, with a visible ` | pass |
| C11 | `run unit / ✓ plan-generator > generateSessions places a session on each selected day only` | pass |
| C12 | `run e2e / ok onboarding.spec.ts › selecting fewer than 3 or more than 6 days is rejected with the 3-6 range ex` | pass |
| C13 | `run unit / ✓ plan-generator > splitPhases assigns taper, base, build and peak in the documented proportions` | pass |
| C14 | `run unit / ✓ plan-generator > generateSessions weights Fácil and Longão in base and Tempo and Intervalado in b` | pass |
| C15 | `run unit / ✓ vdot > paceForVdot returns the correct pace for each session type` | pass |
| C16 | `run unit / ✓ plan-generator > computePlanWeeks supports exactly the four race types and rejects others` | pass |
| C17 | `run e2e / ok dashboard.spec.ts › shows the current week's sessions in date order with type, pace and distance` | pass |
| C18 | `run e2e / ok dashboard.spec.ts › a past session with no log shows as missed` | pass |
| C19 | `run e2e / ok dashboard.spec.ts › a logged session shows as done with the actual pace next to the planned pace` | pass |
| C20 | `run e2e / ok dashboard.spec.ts › opening the dashboard after a week ends reassesses before showing next week` | pass |
| C21 | `run e2e / ok dashboard.spec.ts › shows a retest prompt when the VDOT is 4 or more weeks old` | pass |
| C22 | `run e2e / ok logging.spec.ts › submitting a valid workout log marks the session done` | pass |
| C23 | `run e2e / ok logging.spec.ts › an out-of-range field is rejected and named in the error` | pass |
| C24 | `run e2e / ok logging.spec.ts › editing a log overwrites its stored values` | pass |
| C25 | `run e2e / ok logging.spec.ts › deleting a log reverts the session to pending or missed` | pass |
| C26 | `run e2e / ok logging.spec.ts › a session in an already-reassessed week can still be logged, edited and deleted` | pass |
| C27 | `run unit / ✓ weekly-adjustment > computeSignals flags pace, RPE and missed-ratio at their documented threshold` | pass |
| C28 | `run unit / ✓ weekly-adjustment > decide returns reduce and applyDecision cuts distance 20% and steps intensity` | pass |
| C29 | `run unit / ✓ weekly-adjustment > decide returns maintain and applyDecision clones the current week unchanged` | pass |
| C30 | `run unit / ✓ weekly-adjustment > decide returns progress and leaves the next week as originally generated` | pass |
| C31 | `run unit / ✓ weekly-adjustment > reassessIfDue persists a WeeklyAdjustment row with its signals, decision and ` | pass |
| C32 | `run unit / ✓ weekly-adjustment > reassessIfDue is a no-op when the week is already reassessed` | pass |
| C33 | `run unit / ✓ vdot > isRetestDue is true once the latest VdotHistory entry is 4 or more weeks old` | pass |
| C34 | `run e2e / ok dashboard.spec.ts › submitting a retest result updates the VDOT and future sessions' planned pace` | pass |
| C35 | `run e2e / ok dashboard.spec.ts › dismissing the retest prompt hides it today and shows it again on the next vi` | pass |
| C36 | `run e2e / ok history.spec.ts › shows a VDOT-over-time chart built from VdotHistory` | pass |
| C37 | `run e2e / ok history.spec.ts › shows actual-vs-planned pace and weekly adherence` | pass |
| C38 | `run e2e / ok history.spec.ts › selecting an archived plan shows its own charts and race result` | pass |
| C39 | `run e2e / ok history.spec.ts › a plan with no logged sessions shows an explicit empty state` | pass |
| C40 | `run unit / ✓ plan-lifecycle > archiveIfPast sets status to archived once raceDate is in the past` | pass |
| C41 | `run e2e / ok lifecycle.spec.ts › an archived plan with no race result shows a prompt asking for the finish tim` | pass |
| C42 | `run unit / ✓ plan-lifecycle > recordRaceResult saves the result and adds a VdotHistory entry with source race` | pass |
| C43 | `run unit / ✓ plan-lifecycle > initialVdotForNewPlan falls back to the archived plan's currentVdot when no race` | pass |
| C44 | `run e2e / ok lifecycle.spec.ts › a new plan defaults its VDOT from the last race result and lets the user edit` | pass |
| C45 | `run unit / ✓ plan-lifecycle > createNewPlan rejects a second active plan while one already exists` | pass |
| C46 | `run unit / ✓ plan-lifecycle > recalculateFromCurrentWeek regenerates only future weeks and leaves past Workout` | pass |
| C47 | `run e2e / ok settings.spec.ts › editing to an invalid race date or day count is rejected with the plan-creatio` | pass |
| C48 | `run unit / ✓ plan-lifecycle > recalculateFromCurrentWeek re-derives future sessions from currentVdot, not init` | pass |
| C49 | `run e2e / ok settings.spec.ts › shows the active plan's race type, date, days and current VDOT` | pass |
| C50 | `run e2e / ok settings.spec.ts › changing days from settings triggers the same recalculation as plan editing` | pass |
| C51 | `run e2e / ok settings.spec.ts › with no active plan, settings links to plan creation instead of showing empty ` | pass |
| C52 | `run unit / ✓ session-status > a future-dated WorkoutLog is accepted and the session is marked done` | pass |
| C53 | `run unit / ✓ weekly-adjustment > a week with zero logs resolves missed=true and pace/RPE as not-triggered` | pass |
| C54 | `run unit / ✓ vdot > isPlausibleResult rejects a physically impossible time for the given distance` | pass |
| C55 | `run e2e / ok dashboard.spec.ts › after the last taper week ends before the race date, the dashboard shows that` | pass |
| Build | `npm run build` | pass |
| Build | `npm run typecheck` | pass |
| Build | `npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ok 31 e2e\onboarding.spec.ts:26:1 › new plan offers guided test or manual time entry (12.1s)
  ok 32 e2e\onboarding.spec.ts:33:1 › guided test shows instructions and a result entry form (11.1s)
  ok 33 e2e\onboarding.spec.ts:56:1 › a 10km plan ~10 weeks out from a manual 5km time shows ~10 weeks with the expected phase proportions (29.6s)
  ok 34 e2e\onboarding.spec.ts:82:1 › a plan shorter than the recommended minimum still generates, with a visible warning (17.7s)
  ok 35 e2e\onboarding.spec.ts:103:1 › selecting fewer than 3 or more than 6 days is rejected with the 3-6 range explained (13.5s)
  ok 36 e2e\settings.spec.ts:16:1 › shows the active plan's race type, date, days and current VDOT (24.2s)
  ok 37 e2e\settings.spec.ts:33:1 › with no active plan, settings links to plan creation instead of showing empty fields (11.4s)
  ok 38 e2e\settings.spec.ts:54:1 › changing days from settings triggers the same recalculation as plan editing (52.7s)
  ok 39 e2e\settings.spec.ts:106:1 › editing to an invalid race date or day count is rejected with the plan-creation validation message (37.4s)

  Slow test file: e2e\dashboard.spec.ts (5.6m)
  Consider running tests from slow files in parallel. See: https://playwright.dev/docs/test-parallel
  39 passed (19.1m)
[WebServer] [next-auth][warn][NEXTAUTH_URL] 
[WebServer] https://next-auth.js.org/warnings#nextauth_url
```

`Run unit` - exit 0

```
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > recalculateFromCurrentWeek regenerates only future weeks and leaves past WorkoutLogs untouched
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > recalculateFromCurrentWeek re-derives future sessions from currentVdot, not initialVdot
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > recalculateFromCurrentWeek rejects an invalid day count with the plan-creation message, and a race date leaving no week
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > recalculateFromCurrentWeek settles the ended week's pending reassessment so it never pairs weeks with different day counts
 ✓ lib/domain/auth.test.ts > auth > verifyCredentials > returns { id } for correct credentials
 ✓ lib/domain/auth.test.ts > auth > verifyCredentials > returns null for incorrect credentials
 ✓ lib/domain/auth.test.ts > auth > stored passwordHash is bcrypt, never the plaintext password
 ✓ lib/domain/auth.test.ts > auth > getSeededUserId > returns the id of the single seeded account

 Test Files  7 passed (7)
      Tests  85 passed (85)
   Start at  21:11:07
   Duration  1.08s (transform 701ms, setup 0ms, collect 1.19s, tests 616ms, environment 1ms, prepare 1.18s)

The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.
```
