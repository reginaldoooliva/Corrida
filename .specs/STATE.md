# STATE

## Decisions

### AD-001
- **Decision**: All business logic lives in framework-agnostic `lib/domain/*` TypeScript modules; Server Actions (`app/**/actions.ts`) are thin adapters that only validate input (zod) and call `lib/domain/*`.
- **Reason**: Satisfies the project rule that every rule affecting what the user sees must run in a layer the test suite reaches directly; Server Actions alone are hard to unit-test in isolation.
- **Trade-off**: One extra layer of indirection per mutation/read compared to putting logic straight in the Server Action.
- **Scope**: All features and all Server Actions/Route Handlers in this app.
- **Date**: 2026-11-05
- **Status**: active

### AD-002
- **Decision**: Authentication uses NextAuth.js with a Credentials Provider checked against a single `User` row seeded from environment variables at deploy time; no signup/registration UI exists anywhere.
- **Reason**: Avoids hand-rolling session/cookie signing and the security edge cases that come with it, for a single-account app.
- **Trade-off**: Pulls in NextAuth as a dependency even though only one account will ever exist.
- **Scope**: Any feature that adds a protected page or route.
- **Date**: 2026-11-05
- **Status**: active

### AD-003
- **Decision**: Prisma's `datasource db` uses a pooled `DATABASE_URL` (Supabase PgBouncer, port 6543, transaction mode) for all runtime queries, and a separate `DIRECT_URL` (port 5432) for `prisma migrate`.
- **Reason**: PgBouncer in transaction mode does not support Prisma's migration engine; using the pooled URL everywhere risks connection exhaustion on Vercel's serverless functions.
- **Trade-off**: Two connection strings to keep straight in env config instead of one.
- **Scope**: `prisma/schema.prisma` and any future Prisma datasource configuration.
- **Date**: 2026-11-05
- **Status**: active

### AD-004
- **Decision**: Vitest is the unit-test runner for `lib/domain/*`; Playwright is used for the end-to-end UAT walk during Execute.
- **Reason**: `lib/domain/*` is plain/Prisma-backed TypeScript, a natural fit for Vitest; Playwright was already available in this environment for driving a real browser.
- **Trade-off**: None significant — first test-runner choice for a greenfield project, no competing convention existed.
- **Scope**: All features' unit and end-to-end tests.
- **Date**: 2026-11-05
- **Status**: active

### AD-005
- **Decision**: Até 3 planos não arquivados por usuário (`active` ou `paused`), com no máximo um `active`; substitui `LIFE-06` ("no máximo um plano `active`" continua, mas planos pausados passam a existir).
- **Reason**: Pergunta: "Hoje o app permite só um plano ativo. Como devem funcionar os até 3 planos?" - opção escolhida: "Até 3 salvos, 1 ativo (Recomendado)".
- **Trade-off**: Um novo status `paused` e regras para retomar um plano pausado (`PLANS-09`).
- **Scope**: `gestao-de-planos` e o ciclo de vida de planos de `coach-virtual`.
- **Date**: 2026-11-10
- **Status**: active

### AD-006
- **Decision**: Um treino excluído continua excluído quando o plano é recalculado (nova data da prova ou novos dias): o recálculo não recria treino no dia de um excluído (`DEL-12`).
- **Reason**: O Verifier mostrou que o recálculo recriava o treino excluído e a reavaliação o contava como perdido, o que `DEL-09` proíbe. Decidido pelo agente, com a feature delegada pelo usuário de ponta a ponta; reversível se o usuário preferir que o recálculo refaça a semana inteira.
- **Trade-off**: A exclusão de um treino não se desfaz: o dia fica sem treino naquela semana, também depois de um recálculo.
- **Scope**: `gestao-de-planos` (`rebuildWeeks`).
- **Date**: 2026-11-11
- **Status**: active

### AD-007
- **Decision**: O pace real não é digitado: é a duração dividida pela distância (segundos por km, arredondado), mostrado no formulário enquanto o corredor digita e gravado em `actualPaceSecPerKm` pela Server Action (`paceFromRun`, `lib/domain/pace.ts`). Substitui o campo "Pace (mm:ss por km)" de `LOG-01`/`LOG-02`.
- **Reason**: Pedido do usuário: "o Pace é calculado pelo tempo da atividade dividido pela distância [...] remova a necessidade de colocar o Pace e mostre o Pace após eu digitar os valores de distância e tempo" - o teclado numérico do celular não tem ":", então o campo não podia ser preenchido.
- **Trade-off**: A duração é em minutos inteiros, então o pace calculado tem precisão de alguns segundos por km (1 min em 8 km = 7,5 s/km).
- **Scope**: `coach-virtual` (registro do treino) e o painel/histórico que mostram o pace real.
- **Date**: 2026-11-11
- **Status**: active

### AD-008
- **Decision**: A duração do treino é registrada em minutos e segundos e gravada em segundos (`WorkoutLog.actualDurationSec`, migração `20261111150000_workout_duration_seconds`, que converte os registros existentes de minutos para segundos). O campo "Duração (min:seg)" aceita `42:28`, `42,28`, `42.28`, `42` (só minutos) e `1:02:28`; segundos de 00 a 59, até 600 minutos (`parseDuration`, `lib/domain/pace.ts`). Supera o trade-off de AD-007.
- **Reason**: Pedido do usuário: "Quero conseguir registrar os segundos do treino [...] Quero registrar 42,28 segundos" - com minutos inteiros não dava para registrar 42:28. A vírgula vale como separador porque o teclado numérico do celular não tem ":".
- **Trade-off**: `42,5` é recusado (ambíguo entre 42:05 e 42 min e meio); o corredor digita `42,05` ou `42,30`.
- **Scope**: `coach-virtual` (registro do treino).
- **Date**: 2026-11-11
- **Status**: active

## Handoff
