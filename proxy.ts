import { withAuth } from "next-auth/middleware";

// SPEC_DEVIATION: tasks.md names this file `middleware.ts`, the pre-Next.js-16 convention.
// Reason: Next.js 16 (installed here) renamed and requires the file as `proxy.ts`; a plain
// `middleware.ts` build-fails with "deprecated, use proxy instead". Behavior is unchanged -
// NextAuth's withAuth still redirects any unauthenticated request matched below to /login.
export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/plan/:path*",
    "/plans",
    "/plans/:path*",
    "/history",
    "/history/:path*",
    "/settings",
    "/settings/:path*",
  ],
};
