/**
 * The data-affecting slice of the URL control surface, so any run is reproducible from a link
 * (AGENTS.md — Conventions).
 *
 * Only `seed`, `scale`, `latency`, `errorRate` and `fresh` live here. `impl`, `theme`, `density`
 * and `dir` are app concerns and are parsed in the app layer — `data/` is the bottom layer and has
 * no opinion about how anything looks.
 */

export interface DataParams {
	/** Any string. Two runs with the same seed see byte-identical generated data. */
	seed: string;
	/**
	 * Absolute issue count. Every other entity count derives from it (see `datasetShape`), so the
	 * default of 10 000 yields 10k issues, 5k users, 200 labels and 12 projects.
	 */
	scale: number;
	/** Simulated round-trip in ms, applied with ±30% jitter. */
	latency: number;
	/** Probability in `[0, 1]` that any single call rejects, so rollbacks can be exercised. */
	errorRate: number;
	/** Clear the persisted event log for this `(seed, scale)` before starting. */
	fresh: boolean;
}

export const DEFAULT_DATA_PARAMS: DataParams = {
	seed: 'based-bugz',
	scale: 10_000,
	latency: 150,
	errorRate: 0,
	fresh: false,
};

export const MIN_SCALE = 1;
export const MAX_SCALE = 5_000_000;
export const MAX_LATENCY = 10_000;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function readNumber(source: URLSearchParams, key: string, fallback: number): number {
	const raw = source.get(key);

	if (raw === null || raw.trim() === '') {
		return fallback;
	}

	const value = Number(raw);

	return Number.isFinite(value) ? value : fallback;
}

/** `?fresh`, `?fresh=1` and `?fresh=true` all count. `?fresh=0` does not. */
function readFlag(source: URLSearchParams, key: string): boolean {
	const raw = source.get(key);

	if (raw === null) {
		return false;
	}

	return raw === '' || raw === '1' || raw.toLowerCase() === 'true';
}

export function parseDataParams(search?: string): DataParams {
	const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
	const source = new URLSearchParams(query);
	const seed = source.get('seed');

	return {
		seed: seed !== null && seed.length > 0 ? seed : DEFAULT_DATA_PARAMS.seed,
		scale: clamp(
			Math.round(readNumber(source, 'scale', DEFAULT_DATA_PARAMS.scale)),
			MIN_SCALE,
			MAX_SCALE,
		),
		latency: clamp(readNumber(source, 'latency', DEFAULT_DATA_PARAMS.latency), 0, MAX_LATENCY),
		errorRate: clamp(readNumber(source, 'errorRate', DEFAULT_DATA_PARAMS.errorRate), 0, 1),
		fresh: readFlag(source, 'fresh'),
	};
}

/**
 * The inverse, for the settings screen. Defaults are omitted so a link stays short and a run with
 * no data params in the URL is unambiguously the default one. `fresh` is never written back: it is
 * a one-shot action, not a setting.
 */
export function dataParamsToSearch(params: DataParams): URLSearchParams {
	const search = new URLSearchParams();

	if (params.seed !== DEFAULT_DATA_PARAMS.seed) {
		search.set('seed', params.seed);
	}

	if (params.scale !== DEFAULT_DATA_PARAMS.scale) {
		search.set('scale', String(params.scale));
	}

	if (params.latency !== DEFAULT_DATA_PARAMS.latency) {
		search.set('latency', String(params.latency));
	}

	if (params.errorRate !== DEFAULT_DATA_PARAMS.errorRate) {
		search.set('errorRate', String(params.errorRate));
	}

	return search;
}
