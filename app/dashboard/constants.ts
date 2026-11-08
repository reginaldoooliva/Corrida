// Shared between actions.ts and page.tsx. Kept out of actions.ts: a "use server" module may only
// export async functions, so a plain constant there breaks the whole module's export analysis.
export const RETEST_DISMISS_COOKIE = "retest_dismissed";
