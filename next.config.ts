import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // SPEC_DEVIATION: T1's scaffold enabled these two experimental Next.js 16 options. Discovered in
  // T27: with cacheComponents on, a client-side navigation after a Server Action redirect (e.g.
  // /plan/new/vdot -> /plan/new) can leave the previous route's <main> mounted underneath the new
  // one, so two pages' content exist in the DOM at once and the stale one intercepts clicks on
  // the new one. Every route in this app reads request-time data (searchParams, session, Prisma),
  // so static/partial prerendering buys nothing here; turning both off removes the bug.
};

export default nextConfig;
