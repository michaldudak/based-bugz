/**
 * UI-affecting URL parameters. Data params (`seed`, `scale`, `latency`, `errorRate`, `fresh`) are
 * parsed separately in `@/data` — this layer never duplicates them.
 *
 * These live in the URL so any run is reproducible from its link (AGENTS.md — Conventions).
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type Direction = 'ltr' | 'rtl';

export interface UiParams {
	theme: ThemePreference;
	density: Density;
	dir: Direction;
	/** Which virtualization implementation the comboboxes resolve to. */
	impl: string;
}

export const DEFAULT_UI_PARAMS: UiParams = {
	theme: 'system',
	density: 'comfortable',
	dir: 'ltr',
	impl: 'baseline',
};

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
	return allowed.includes(value as T) ? (value as T) : fallback;
}

export function parseUiParams(search: string | URLSearchParams = window.location.search): UiParams {
	const params = typeof search === 'string' ? new URLSearchParams(search) : search;

	return {
		theme: oneOf(params.get('theme'), ['system', 'light', 'dark'], DEFAULT_UI_PARAMS.theme),
		density: oneOf(params.get('density'), ['comfortable', 'compact'], DEFAULT_UI_PARAMS.density),
		dir: oneOf(params.get('dir'), ['ltr', 'rtl'], DEFAULT_UI_PARAMS.dir),
		impl: params.get('impl')?.trim() || DEFAULT_UI_PARAMS.impl,
	};
}

/** Writes only non-default values, so a shared link stays readable. */
export function applyUiParams(params: URLSearchParams, ui: UiParams): URLSearchParams {
	const next = new URLSearchParams(params);

	for (const key of ['theme', 'density', 'dir', 'impl'] as const) {
		if (ui[key] === DEFAULT_UI_PARAMS[key]) {
			next.delete(key);
		} else {
			next.set(key, ui[key]);
		}
	}

	return next;
}
