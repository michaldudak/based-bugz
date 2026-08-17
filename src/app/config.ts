/**
 * The single place the product name lives (AGENTS.md — Conventions).
 * Referenced by the sidebar, page headers and document.title.
 */
export const APP_NAME = 'Based Bugz';

export const APP_TAGLINE = 'A realistic testbed for Base UI components';

/** Default dataset sizes; overridable per run with `?scale=`. */
export const DEFAULT_SCALE = {
	users: 5_000,
	issues: 10_000,
	labels: 200,
} as const;
