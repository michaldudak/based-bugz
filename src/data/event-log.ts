/**
 * The append-only log every mutation goes through.
 *
 * It is the only writable state in the data layer: generated entities are pure functions of
 * `(seed, index)`, and everything a user changes is an event replayed over them. That is what makes
 * undo-via-toast, reload survival and a future replay-to-server the same mechanism rather than
 * three (AGENTS.md — Conventions).
 */

import type { ActivityEvent, ActivityEventId } from './types';

export interface EventLog {
	/** Immutable snapshot, oldest first. */
	events(): readonly ActivityEvent[];
	append(event: ActivityEvent): void;
	appendAll(events: readonly ActivityEvent[]): void;
	clear(): void;
	/** Called after every mutation of the log, with the new snapshot. */
	subscribe(listener: (events: readonly ActivityEvent[]) => void): () => void;
}

export function createEventLog(initial: readonly ActivityEvent[] = []): EventLog {
	let events: ActivityEvent[] = [...initial];
	const listeners = new Set<(events: readonly ActivityEvent[]) => void>();

	function notify(): void {
		const snapshot = events;

		// Iterating the Set directly is safe: an entry removed during iteration is simply skipped.
		for (const listener of listeners) {
			listener(snapshot);
		}
	}

	return {
		events: () => events,

		append(event) {
			// A new array per append keeps `events()` snapshots safe to hold across an await.
			events = [...events, event];
			notify();
		},

		appendAll(incoming) {
			if (incoming.length === 0) {
				return;
			}

			events = [...events, ...incoming];
			notify();
		},

		clear() {
			if (events.length === 0) {
				return;
			}

			events = [];
			notify();
		},

		subscribe(listener) {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
	};
}

/**
 * Event ids only have to be unique within a log. They are minted once and then stored, so replay
 * reproduces them exactly — no id is ever recomputed from data that could have changed.
 */
export function createEventIdFactory(startAt = 0): () => ActivityEventId {
	let counter = startAt;

	return () => {
		counter += 1;
		return `e${Date.now().toString(36)}-${counter.toString(36)}`;
	};
}
