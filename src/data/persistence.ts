/**
 * `localStorage` persistence for the event log, keyed by `(seed, scale)`.
 *
 * Edits surviving a reload is what makes dogfooding real — without it the app resets every refresh
 * and never stops feeling like a demo (AGENTS.md — Conventions). Writes are debounced so a burst of
 * bulk edits does not thrash storage, and flushed on `pagehide` so the last one is never lost.
 *
 * Everything read back is untrusted: it survived a deploy, a schema change and possibly a user with
 * devtools open. Anything that fails validation is dropped, never thrown on.
 */

import type { EventLog } from './event-log';
import type { ActivityEvent, Comment, Issue, IssueFieldValue, Label } from './types';
import { isEditableIssueField, isIssuePriority, isIssueStatus } from './types';

export const PERSISTENCE_VERSION = 1;

const DEFAULT_DEBOUNCE_MS = 250;

/** The slice of `Storage` we use. Narrow enough to fake in a test or a Node script. */
export interface EventStorage {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface PersistenceTarget {
	seed: string;
	scale: number;
	storage?: EventStorage | null;
}

export function eventLogStorageKey(seed: string, scale: number): string {
	return `basedbugz:events:v${PERSISTENCE_VERSION}:${encodeURIComponent(seed)}:${scale}`;
}

/** `null` when storage is unavailable — Safari private mode throws on access, not on use. */
export function browserEventStorage(): EventStorage | null {
	if (typeof globalThis.localStorage === 'undefined') {
		return null;
	}

	try {
		const probe = 'basedbugz:probe';
		globalThis.localStorage.setItem(probe, '1');
		globalThis.localStorage.removeItem(probe);
		return globalThis.localStorage;
	} catch {
		return null;
	}
}

/* -------------------------------------------------------------------------------------------- */
/* Validation                                                                                     */
/* -------------------------------------------------------------------------------------------- */

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isIssue(value: unknown): value is Issue {
	if (!isRecord(value)) {
		return false;
	}

	return (
		isNonEmptyString(value.id) &&
		typeof value.key === 'string' &&
		typeof value.title === 'string' &&
		typeof value.description === 'string' &&
		isIssueStatus(value.status) &&
		isIssuePriority(value.priority) &&
		(value.assigneeId === null || isNonEmptyString(value.assigneeId)) &&
		isNonEmptyString(value.reporterId) &&
		isStringArray(value.labelIds) &&
		isNonEmptyString(value.projectId) &&
		(value.estimate === null || isFiniteNumber(value.estimate)) &&
		isFiniteNumber(value.createdAt) &&
		isFiniteNumber(value.updatedAt)
	);
}

function isComment(value: unknown): value is Comment {
	if (!isRecord(value)) {
		return false;
	}

	return (
		isNonEmptyString(value.id) &&
		isNonEmptyString(value.issueId) &&
		isNonEmptyString(value.authorId) &&
		typeof value.body === 'string' &&
		isFiniteNumber(value.createdAt)
	);
}

function isLabel(value: unknown): value is Label {
	if (!isRecord(value)) {
		return false;
	}

	return isNonEmptyString(value.id) && typeof value.name === 'string' && isFiniteNumber(value.hue);
}

function isIssueFieldValue(value: unknown): value is IssueFieldValue {
	return (
		value === null || typeof value === 'string' || isFiniteNumber(value) || isStringArray(value)
	);
}

/** Shape validation only. Whether the referenced entities still exist is replay's problem. */
export function parseActivityEvent(value: unknown): ActivityEvent | null {
	if (!isRecord(value)) {
		return null;
	}

	if (
		!isNonEmptyString(value.id) ||
		!isFiniteNumber(value.at) ||
		!isNonEmptyString(value.actorId)
	) {
		return null;
	}

	const base = { id: value.id, at: value.at, actorId: value.actorId };

	switch (value.type) {
		case 'issue_created':
			return isNonEmptyString(value.issueId) && isIssue(value.issue)
				? { ...base, type: 'issue_created', issueId: value.issueId, issue: value.issue }
				: null;

		case 'issue_field_changed':
			return isNonEmptyString(value.issueId) &&
				isEditableIssueField(value.field) &&
				isIssueFieldValue(value.from) &&
				isIssueFieldValue(value.to)
				? {
						...base,
						type: 'issue_field_changed',
						issueId: value.issueId,
						field: value.field,
						from: value.from,
						to: value.to,
					}
				: null;

		case 'issue_commented':
			return isNonEmptyString(value.issueId) && isComment(value.comment)
				? { ...base, type: 'issue_commented', issueId: value.issueId, comment: value.comment }
				: null;

		case 'issue_deleted':
			return isNonEmptyString(value.issueId)
				? { ...base, type: 'issue_deleted', issueId: value.issueId }
				: null;

		case 'issue_restored':
			return isNonEmptyString(value.issueId)
				? { ...base, type: 'issue_restored', issueId: value.issueId }
				: null;

		case 'label_created':
			return isLabel(value.label) ? { ...base, type: 'label_created', label: value.label } : null;

		default:
			return null;
	}
}

/* -------------------------------------------------------------------------------------------- */
/* Load / clear / persist                                                                         */
/* -------------------------------------------------------------------------------------------- */

export function loadPersistedEvents(target: PersistenceTarget): ActivityEvent[] {
	const storage = target.storage ?? null;

	if (storage === null) {
		return [];
	}

	let raw: string | null;

	try {
		raw = storage.getItem(eventLogStorageKey(target.seed, target.scale));
	} catch {
		return [];
	}

	if (raw === null) {
		return [];
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}

	if (!isRecord(parsed) || parsed.v !== PERSISTENCE_VERSION || !Array.isArray(parsed.events)) {
		return [];
	}

	const events: ActivityEvent[] = [];

	for (const candidate of parsed.events) {
		const event = parseActivityEvent(candidate);

		if (event !== null) {
			events.push(event);
		}
	}

	return events;
}

export function clearPersistedEvents(target: PersistenceTarget): void {
	const storage = target.storage ?? null;

	if (storage === null) {
		return;
	}

	try {
		storage.removeItem(eventLogStorageKey(target.seed, target.scale));
	} catch {
		// A storage that refuses to delete is not worth failing a page load over.
	}
}

export interface PersistOptions extends PersistenceTarget {
	debounceMs?: number;
}

/**
 * Mirrors `log` into storage. Returns a disposer that flushes any pending write and detaches the
 * lifecycle listeners.
 */
export function persistEventLog(log: EventLog, options: PersistOptions): () => void {
	const storage = options.storage ?? null;

	if (storage === null) {
		return () => {};
	}

	const key = eventLogStorageKey(options.seed, options.scale);
	const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let pending: readonly ActivityEvent[] | null = null;

	function flush(): void {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}

		if (pending === null) {
			return;
		}

		const events = pending;
		pending = null;

		try {
			if (events.length === 0) {
				storage?.removeItem(key);
			} else {
				storage?.setItem(
					key,
					JSON.stringify({
						v: PERSISTENCE_VERSION,
						seed: options.seed,
						scale: options.scale,
						events,
					}),
				);
			}
		} catch {
			// Quota exceeded, or storage disabled mid-session. Dropping the write is strictly better
			// than taking down the app over a dogfooding convenience.
		}
	}

	function schedule(events: readonly ActivityEvent[]): void {
		pending = events;

		if (timer === null) {
			timer = setTimeout(() => {
				timer = null;
				flush();
			}, debounceMs);
		}
	}

	const unsubscribe = log.subscribe(schedule);
	const onHide = (): void => flush();
	const onVisibility = (): void => {
		if (globalThis.document?.visibilityState === 'hidden') {
			flush();
		}
	};

	globalThis.addEventListener?.('pagehide', onHide);
	globalThis.addEventListener?.('visibilitychange', onVisibility);

	return () => {
		unsubscribe();
		globalThis.removeEventListener?.('pagehide', onHide);
		globalThis.removeEventListener?.('visibilitychange', onVisibility);
		flush();
	};
}
