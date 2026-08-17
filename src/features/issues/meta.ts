/**
 * Display metadata for the issue domain: the labels, badge variants and sort options the list and
 * the filter bar both need. Kept apart from the components so a status label is defined once.
 */

import type { CSSProperties } from 'react';
import { ISSUE_PRIORITIES, ISSUE_STATUSES } from '@/data';
import type { IssuePriority, IssueSort, IssueSortField, IssueStatus, SortDirection } from '@/data';
import type { BadgeVariant } from '@/ds/badge';

/**
 * A label's colour is per-instance data, so it is computed here and handed to CSS as a custom
 * property — the same trick `ds/avatar` uses, and what keeps raw colour values out of every
 * stylesheet but `tokens.css`.
 */
export function labelColorStyle(hue: number): CSSProperties {
	return {
		'--label-color': `light-dark(oklch(0.62 0.14 ${hue}), oklch(0.74 0.13 ${hue}))`,
		'--label-surface': `light-dark(oklch(0.95 0.03 ${hue}), oklch(0.28 0.05 ${hue}))`,
		'--label-text': `light-dark(oklch(0.4 0.09 ${hue}), oklch(0.9 0.06 ${hue}))`,
	} as CSSProperties;
}

export const STATUS_LABEL: Record<IssueStatus, string> = {
	backlog: 'Backlog',
	todo: 'Todo',
	in_progress: 'In progress',
	in_review: 'In review',
	done: 'Done',
	cancelled: 'Cancelled',
};

export const STATUS_VARIANT: Record<IssueStatus, BadgeVariant> = {
	backlog: 'neutral',
	todo: 'neutral',
	in_progress: 'info',
	in_review: 'warning',
	done: 'success',
	cancelled: 'danger',
};

export const PRIORITY_LABEL: Record<IssuePriority, string> = {
	none: 'No priority',
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	urgent: 'Urgent',
};

/** Ordered for menus: most urgent first, which is how people scan a priority list. */
export const PRIORITY_ORDER: readonly IssuePriority[] = ISSUE_PRIORITIES.toReversed();

export const STATUS_ORDER: readonly IssueStatus[] = ISSUE_STATUSES;

/* -------------------------------------------------------------------------------------------- */
/* Sort                                                                                           */
/* -------------------------------------------------------------------------------------------- */

/**
 * `field-direction`, so the whole sort round-trips through one URL parameter without percent
 * encoding. A colon would be escaped by `URLSearchParams`, which makes shared links unreadable.
 */
export type SortValue = `${IssueSortField}-${SortDirection}`;

export const SORT_FIELDS: readonly IssueSortField[] = [
	'created',
	'updated',
	'priority',
	'status',
	'title',
	'key',
];

export const SORT_FIELD_LABEL: Record<IssueSortField, string> = {
	created: 'Created',
	updated: 'Updated',
	priority: 'Priority',
	status: 'Status',
	title: 'Title',
	key: 'Key',
};

export const SORT_DIRECTIONS: readonly SortDirection[] = ['desc', 'asc'];

export const SORT_DIRECTION_LABEL: Record<SortDirection, string> = {
	desc: 'Descending',
	asc: 'Ascending',
};

export function formatSort(sort: IssueSort): SortValue {
	return `${sort.field}-${sort.direction}`;
}

/** `null` for anything unrecognised, so a hand-edited URL degrades to the default sort. */
export function parseSort(value: string | null): IssueSort | null {
	if (value === null) {
		return null;
	}

	const separator = value.lastIndexOf('-');

	if (separator < 0) {
		return null;
	}

	const field = value.slice(0, separator);
	const direction = value.slice(separator + 1);

	if (!SORT_FIELDS.includes(field as IssueSortField)) {
		return null;
	}

	if (direction !== 'asc' && direction !== 'desc') {
		return null;
	}

	return { field: field as IssueSortField, direction };
}

/* -------------------------------------------------------------------------------------------- */
/* Time                                                                                           */
/* -------------------------------------------------------------------------------------------- */

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
	['year', 365 * 24 * 60 * 60 * 1000],
	['month', 30 * 24 * 60 * 60 * 1000],
	['week', 7 * 24 * 60 * 60 * 1000],
	['day', 24 * 60 * 60 * 1000],
	['hour', 60 * 60 * 1000],
	['minute', 60 * 1000],
];

const relativeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** Compact "3 days ago" for a row; the exact timestamp goes in the `title`. */
export function formatRelativeTime(at: number, now: number = Date.now()): string {
	const delta = at - now;

	for (const [unit, ms] of RELATIVE_UNITS) {
		if (Math.abs(delta) >= ms) {
			return relativeFormat.format(Math.round(delta / ms), unit);
		}
	}

	return relativeFormat.format(0, 'second');
}

export function formatAbsoluteTime(at: number): string {
	return new Date(at).toLocaleString();
}
