# gestao-de-planos proofs

**HEAD**: 89e9591
**Tree**: dirty - docs/design/1000658478.jpg
**Shell**: C:/Program Files/Git\bin\bash.exe
**Result**: 39 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ plan-lifecycle > createNewPlan counts only active and paused plans toward the limit of 3` | pass |
| C2 | `run unit / ✓ plan-lifecycle > createPlan pauses the active plan so at most one stays active` | pass |
| C3 | `run e2e / ok plans.spec.ts › a fourth plan is refused with the 3-plan message` | pass |
| C4 | `run unit / ✓ plan-lifecycle > createNewPlan makes the new plan active and the previous one paused` | pass |
| C5 | `run e2e / ok plans.spec.ts › the plans screen lists each active and paused plan with race, date, weeks and sta` | pass |
| C6 | `run e2e / ok plans.spec.ts › following a paused plan makes it active and pauses the other` | pass |
| C7 | `run e2e / ok plans.spec.ts › the dashboard shows the current week of the plan just followed` | pass |
| C8 | `run e2e / ok plans.spec.ts › the dashboard never reassesses or prompts a retest for a paused plan` | pass |
| C9 | `run unit / ✓ plan-lifecycle > followPlan marks the plan's ended weeks reassessed without a WeeklyAdjustment` | pass |
| C10 | `run e2e / ok plans.spec.ts › opening the plans screen or the dashboard archives a paused plan whose race has p` | pass |
| C11 | `run e2e / ok plans.spec.ts › with only paused plans the dashboard shows the empty state linking to the plans s` | pass |
| C12 | `run e2e / ok plans.spec.ts › settings links to the plans screen` | pass |
| C13 | `run unit / ✓ plan-lifecycle > followPlan refuses a concurrent second activation without changing anything` | pass |
| C14 | `run unit / ✓ plan-lifecycle > followPlan, deletePlan and deleteSession refuse an id that is not the user's or ` | pass |
| C15 | `run e2e / ok delete.spec.ts › deleting a plan asks for confirmation with the spec text` | pass |
| C16 | `run e2e / ok delete.spec.ts › confirming deletes the plan and every row it owns` | pass |
| C17 | `run e2e / ok delete.spec.ts › cancelling the plan deletion keeps the plan and everything in it` | pass |
| C18 | `run unit / ✓ plan-lifecycle > deletePlan of the active plan leaves every other plan's status as it was` | pass |
| C19 | `run e2e / ok delete.spec.ts › every plan on the plans screen and every archived plan in history offers Excluir` | pass |
| C20 | `run e2e / ok delete.spec.ts › a deleted archived plan is no longer listed in history` | pass |
| C21 | `run e2e / ok delete.spec.ts › deleting a session asks for confirmation with the spec text` | pass |
| C22 | `run e2e / ok delete.spec.ts › confirming deletes the session and its log and the dashboard no longer shows it` | pass |
| C23 | `run unit / ✓ plan-lifecycle > a deleted session does not count as missed when its week is reassessed` | pass |
| C24 | `run e2e / ok delete.spec.ts › deleting the last session of a week is refused` | pass |
| C25 | `run e2e / ok recalc.spec.ts › postponing the race from settings rebuilds every week from the first` | pass |
| C26 | `run unit / ✓ plan-lifecycle > editPlan keeps every logged session with its log on its date and adds no session` | pass |
| C27 | `run unit / ✓ plan-lifecycle > editPlan derives the regenerated paces from currentVdot` | pass |
| C28 | `run unit / ✓ plan-lifecycle > editPlan keeps every reassessed week reassessed` | pass |
| C29 | `run unit / ✓ plan-lifecycle > editPlan refuses a race date that leaves fewer weeks than the current one` | pass |
| C30 | `run e2e / ok notes.spec.ts › a note typed when logging is saved to the log` | pass |
| C31 | `run e2e / ok notes.spec.ts › a note over 500 characters is refused with the spec message` | pass |
| C32 | `run unit / ✓ workout-log > parseNotes turns an empty or blank note into null` | pass |
| C33 | `run e2e / ok notes.spec.ts › editing a log shows its saved note in the field` | pass |
| C34 | `run e2e / ok notes.spec.ts › the dashboard card shows the note of a logged session` | pass |
| C35 | `run e2e / ok delete.spec.ts › the delete confirmation sits centered and whole on a phone screen` | pass |
| C36 | `run e2e / ok plans.spec.ts › with three plans the history fits a phone screen and its plan tabs scroll` | pass |
| Build | `npm run build` | pass |
| Build | `npm run typecheck` | pass |
| Build | `npm run lint` | pass |

## Output

`Run unit` - exit 0

```
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > editPlan keeps every logged session with its log on its date and adds no session on that day
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > editPlan derives the regenerated paces from currentVdot
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > editPlan keeps every reassessed week reassessed
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > editPlan refuses a race date that leaves fewer weeks than the current one
 ✓ lib/domain/plan-lifecycle.test.ts > plan-lifecycle > recalculateFromCurrentWeek > editPlan with an earlier race date drops the weeks past the new end
 ✓ lib/domain/auth.test.ts > auth > verifyCredentials > returns null for incorrect credentials
 ✓ lib/domain/auth.test.ts > auth > stored passwordHash is bcrypt, never the plaintext password
 ✓ lib/domain/auth.test.ts > auth > getSeededUserId > returns the id of the single seeded account

 Test Files  8 passed (8)
      Tests  111 passed (111)
   Start at  01:26:13
   Duration  1.09s (transform 697ms, setup 0ms, collect 1.37s, tests 713ms, environment 2ms, prepare 1.42s)

The CJS build of Vite's Node API is deprecated. See https://vite.dev/guide/troubleshooting.html#vite-cjs-node-api-deprecated for more details.
```

`Run e2e` - exit 0

```
  ok 16 e2e\plans.spec.ts:83:1 › the dashboard shows the current week of the plan just followed (54.8s)
  ok 17 e2e\plans.spec.ts:107:1 › a fourth plan is refused with the 3-plan message (53.3s)
  ok 18 e2e\plans.spec.ts:129:1 › the dashboard never reassesses or prompts a retest for a paused plan (45.2s)
  ok 19 e2e\plans.spec.ts:146:1 › opening the plans screen or the dashboard archives a paused plan whose race has passed (58.4s)
  ok 20 e2e\plans.spec.ts:169:1 › with only paused plans the dashboard shows the empty state linking to the plans screen (25.1s)
  ok 21 e2e\plans.spec.ts:181:1 › settings links to the plans screen (26.0s)
  ok 22 e2e\plans.spec.ts:195:1 › with three plans the history fits a phone screen and its plan tabs scroll (50.1s)
  ok 23 e2e\recalc.spec.ts:15:1 › postponing the race from settings rebuilds every week from the first (39.6s)

  Slow test file: e2e\plans.spec.ts (6.6m)
  Slow test file: e2e\delete.spec.ts (6.3m)
  Consider running tests from slow files in parallel. See: https://playwright.dev/docs/test-parallel
  23 passed (15.4m)
[WebServer] [next-auth][warn][NEXTAUTH_URL] 
[WebServer] https://next-auth.js.org/warnings#nextauth_url
```
