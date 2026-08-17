/**
 * Small hooks the issues feature needs. Deliberately not in `ds/` — none of them is a component,
 * and `ds/` is a record of what a Base UI user has to build, not a utility bin.
 *
 * Note what is absent: no `useDeferredValue`, no `startTransition`. Debouncing the *request* is a
 * data-fetching decision; deferring the *render* would paper over exactly the cost this app exists
 * to measure (AGENTS.md — evaluation rule 6).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/** Trailing-edge debounce. The pending timer resets on every change, so only a pause commits. */
export function useDebouncedValue<T>(value: T, delay = 200): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);

		return () => window.clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}

export interface DebouncedTextField {
	/** What the input shows — updates on every keystroke. */
	value: string;
	onChange: (next: string) => void;
	/** Commits immediately, for Enter and for a clear button. */
	flush: (next: string) => void;
}

/**
 * A text input whose value lives somewhere slow to write — here, the URL.
 *
 * Two directions have to work: typing pushes outward after a pause, and an outside change (the back
 * button, "Clear filters") pulls inward. The committed value is tracked in a ref so the two never
 * fight: an inbound value that equals what we last pushed is our own echo, not an edit.
 */
export function useDebouncedTextField(
	external: string,
	commit: (value: string) => void,
	delay = 200,
): DebouncedTextField {
	const [draft, setDraft] = useState(external);
	const committed = useRef(external);

	useEffect(() => {
		if (draft === committed.current) {
			return;
		}

		const timer = window.setTimeout(() => {
			committed.current = draft;
			commit(draft);
		}, delay);

		return () => window.clearTimeout(timer);
	}, [draft, delay, commit]);

	useEffect(() => {
		if (external !== committed.current) {
			committed.current = external;
			setDraft(external);
		}
	}, [external]);

	const flush = useCallback(
		(next: string) => {
			committed.current = next;
			setDraft(next);
			commit(next);
		},
		[commit],
	);

	return { value: draft, onChange: setDraft, flush };
}

/**
 * Layout branch in JS rather than CSS.
 *
 * A filter bar that collapses into a popover cannot be done with `display: none` — rendering both
 * copies would duplicate every control's id and mount two comboboxes fetching the same pages.
 */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

	useEffect(() => {
		const list = window.matchMedia(query);
		const update = () => setMatches(list.matches);

		update();
		list.addEventListener('change', update);

		return () => list.removeEventListener('change', update);
	}, [query]);

	return matches;
}
