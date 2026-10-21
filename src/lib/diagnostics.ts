/**
 * TEST ONLY (branch test-no-focus-sync). When true, the calendar sync code does not refresh when the
 * window regains focus or the page becomes visible. Used to find out whether those refreshes cause the
 * black screen when the keyboard opens. Not meant to be merged.
 */
export const DIAGNOSTIC_NO_FOCUS_REFRESH: boolean = true;
