/**
 * Opaque pagination cursors.
 *
 * The cursor carries the **sort key** of the last row on the previous page, not a bare offset.
 * With an offset, an edit that changes the sort key of a row you already scrolled past shifts every
 * later row by one and the next page silently skips or repeats an item — the exact subtlety
 * PLAN.md flags. With the sort key, resuming is a comparison against a value, and the worst an
 * intervening edit can do is move one row.
 *
 * It also carries a fingerprint of the query it was produced for. A cursor handed back with a
 * different filter or sort is rejected rather than quietly interpreted against the wrong sequence.
 *
 * The encoding is base64url over JSON — opaque to callers by convention, not by cryptography. It is
 * validated on decode because it round-trips through the URL and through `localStorage`.
 */

import { hash32 } from './rng';

export const CURSOR_VERSION = 1;

export type CursorKind =
	'users' | 'labels' | 'projects' | 'issues' | 'comments' | 'activity' | 'search';

/** A sort key has to survive JSON, so it is deliberately narrow. */
export type CursorKey = string | number | null;

export interface Cursor {
	/** Payload version. Bumping it invalidates every cursor in the wild. */
	v: number;
	/** Which query shape produced this cursor. */
	t: CursorKind;
	/** Fingerprint of the filter + sort. Guards against replaying a cursor across queries. */
	g: string;
	/** Position of the last row of the previous page in the underlying sequence. */
	i: number;
	/** That row's sort key. Absent for naturally ordered sequences. */
	k?: CursorKey;
	/** Result kind, for the heterogeneous command-palette sequence. */
	r?: string;
}

export interface CursorExpectation {
	t: CursorKind;
	g: string;
}

function toBase64Url(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = '';

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
	const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}

	return new TextDecoder().decode(bytes);
}

export function encodeCursor(cursor: Cursor): string {
	return toBase64Url(JSON.stringify(cursor));
}

function isCursorKey(value: unknown): value is CursorKey {
	return value === null || typeof value === 'string' || typeof value === 'number';
}

/**
 * `null` for anything that is not a well-formed cursor for `expected` — malformed base64, invalid
 * JSON, a stale version, or a cursor from a different query. Callers decide whether that is a
 * hard error or a reason to start from the beginning; the repository treats it as an error.
 */
export function decodeCursor(raw: string, expected: CursorExpectation): Cursor | null {
	let parsed: unknown;

	try {
		parsed = JSON.parse(fromBase64Url(raw));
	} catch {
		return null;
	}

	if (typeof parsed !== 'object' || parsed === null) {
		return null;
	}

	const candidate = parsed as Partial<Record<keyof Cursor, unknown>>;

	if (candidate.v !== CURSOR_VERSION || candidate.t !== expected.t || candidate.g !== expected.g) {
		return null;
	}

	if (typeof candidate.i !== 'number' || !Number.isInteger(candidate.i) || candidate.i < 0) {
		return null;
	}

	if (candidate.k !== undefined && !isCursorKey(candidate.k)) {
		return null;
	}

	if (candidate.r !== undefined && typeof candidate.r !== 'string') {
		return null;
	}

	return {
		v: CURSOR_VERSION,
		t: expected.t,
		g: expected.g,
		i: candidate.i,
		...(candidate.k === undefined ? {} : { k: candidate.k }),
		...(candidate.r === undefined ? {} : { r: candidate.r }),
	};
}

/** Key-sorted JSON, so `{ a: 1, b: 2 }` and `{ b: 2, a: 1 }` fingerprint identically. */
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') {
		return JSON.stringify(value ?? null);
	}

	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(',')}]`;
	}

	const entries = Object.entries(value)
		.filter(([, entryValue]) => entryValue !== undefined)
		.toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
		.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`);

	return `{${entries.join(',')}}`;
}

/** Short, stable identifier for a query, used as the cursor's guard. */
export function fingerprint(value: unknown): string {
	return hash32(stableStringify(value)).toString(36);
}
