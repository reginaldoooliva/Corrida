import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // SPEC_DEVIATION: T1's scaffold enabled these two experimental Next.js 16 options. Discovered in
  // T27: with cacheComponents on, a client-side navigation after a Server Action redirect (e.g.
  // /plan/new/vdot -> /plan/new) can leave the previous route's <main> mounted underneath the new
  // one, so two pages' content exist in the DOM at once and the stale one intercepts clicks on
  // the new one. Every route in this app reads request-time data (searchParams, session, Prisma),
  // so static/partial prerendering buys nothing here; turning both off removes the bug.

  // `next build` sizes its page-data workers from free physical memory (11 on the dev machine), and
  // each one reserves its own V8 heap: with other processes holding most of Windows' commit limit,
  // the workers died with "Zone Allocation failed - process out of memory" (2026-11-10). Two
  // workers build every route of this app in seconds; Vercel's build machines are not slowed.
  experimental: { cpus: 2 },
};

export default nextConfig;
