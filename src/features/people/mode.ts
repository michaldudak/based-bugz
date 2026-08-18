/**
 * How person pickers get their data — the second axis of the combobox evaluation.
 *
 * `paged` is the default: the picker asks the repository for a page at a time and requests more as
 * the viewport approaches the end. `eager` loads every person once, up front, and hands the
 * virtualizer a complete local array which it then filters itself.
 *
 * Both are real strategies real apps ship, and they stress a virtualization API in opposite ways.
 * Paged asks whether the API can cope with a list that grows underneath it and a count it may never
 * learn. Eager asks whether it can cope with a large static array and a result set that changes
 * wholesale on every keystroke, with no async boundary to hide behind.
 */

import { useSearchParams } from 'react-router';

export type PeopleLoadMode = 'paged' | 'eager';

export const PEOPLE_MODE_PARAM = 'people';

export const DEFAULT_PEOPLE_MODE: PeopleLoadMode = 'paged';

export function parsePeopleMode(params: URLSearchParams): PeopleLoadMode {
	return params.get(PEOPLE_MODE_PARAM) === 'eager' ? 'eager' : DEFAULT_PEOPLE_MODE;
}

/** Reads `?people=`. Lives here rather than in `app/` so `features/` stays self-contained. */
export function usePeopleLoadMode(): PeopleLoadMode {
	const [searchParams] = useSearchParams();
	return parsePeopleMode(searchParams);
}
