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

## Handoff
