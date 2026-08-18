import { useCallback, useRef } from 'react';

/**
 * A referentially stable proxy for a contract callback.
 *
 * Both engines behind this implementation — `<Combobox.Virtualizer>` and `@mui/x-virtualizer`
 * directly — rebuild per-item geometry for the *whole* collection whenever `getItemKey` or the
 * estimate callback changes identity. The contract hands both down as inline arrows written at the
 * call site, so passing them straight through walks every loaded row on every render, inside the
 * library, where the app cannot see it.
 *
 * The ref is assigned during render on purpose: both engines read these callbacks while rendering
 * their own subtree, which happens after this component's render has published the latest value.
 */
export function useStableCallback<A extends unknown[], R>(
	callback: (...args: A) => R,
): (...args: A) => R {
	const ref = useRef(callback);
	ref.current = callback;

	return useCallback((...args: A) => ref.current(...args), []);
}
