/**
 * Paging sentinel, needed by both of this PR's modes.
 *
 * `<Virtualizer>` never reports which rows it currently has mounted — there is no end-reached
 * callback, and the rendered window is internal state the surrounding component does not re-render
 * for. The only view of it is the row renderer itself, so "the end is in sight" has to be observed
 * from inside a row: the last few rows of the collection render this, and mounting it *is* the
 * signal.
 *
 * `onReached` is expected to carry the caller's own guard (whether another page exists, whether one
 * is already in flight) in its identity, so a sentinel that stays mounted across a load asks again
 * exactly when the answer could have changed.
 */

import { useEffect } from 'react';

export function EndReachedSentinel({ onReached }: { onReached: () => void }) {
	useEffect(() => {
		onReached();
	}, [onReached]);

	return null;
}
