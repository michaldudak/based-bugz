import { useEffect, useState } from 'react';

/**
 * Plain `setTimeout` debounce.
 *
 * Deliberately not `useDeferredValue` and deliberately not wrapped in `startTransition`: those are
 * the standard way to make a slow list feel fast, and using them in the lab that measures pickers
 * would flatter whichever implementation is under test (AGENTS.md — evaluation rule 6).
 */
export function useDebounced<T>(value: T, delay = 200): T {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}
