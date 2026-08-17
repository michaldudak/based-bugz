/**
 * Filter and sort state, encoded in the URL.
 *
 * The whole point is that a filtered view is a link: paste it to someone and they see the same
 * rows, in the same order, against the same dataset — the `?seed=` / `?scale=` params ride along
 * untouched because every write copies the existing search string rather than replacing it.
 *
 * The shape handed back is deliberately two-faced. `query` is repository-shaped and goes straight
 * into `issues.list`; the flat fields next to it are control-shaped, because a `<Menu.CheckboxItem>`
 * wants a `readonly IssueStatus[]`, not an `IssueFilter`.
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { DEFAULT_ISSUE_SORT, isIssuePriority, isIssueStatus } from '@/data';
import type {
	IssueFilter,
	IssuePriority,
	IssueQuery,
	IssueSort,
	IssueStatus,
	LabelId,
	UserId,
} from '@/data';
import { formatSort, parseSort } from './meta';

/** The picker is single-select, and "nobody" is a choice rather than the absence of one. */
export type AssigneeValue = { kind: 'unassigned' } | { kind: 'user'; id: UserId } | null;

export const PARAM_TEXT = 'q';
export const PARAM_STATUS = 'status';
export const PARAM_PRIORITY = 'priority';
export const PARAM_ASSIGNEE = 'assignee';
export const PARAM_LABELS = 'label';
export const PARAM_LABEL_MATCH = 'labelMatch';
export const PARAM_SORT = 'sort';

/** Every parameter this hook owns. Used to clear filters without disturbing `?theme=` etc. */
const OWNED_PARAMS = [
	PARAM_TEXT,
	PARAM_STATUS,
	PARAM_PRIORITY,
	PARAM_ASSIGNEE,
	PARAM_LABELS,
	PARAM_LABEL_MATCH,
] as const;

const UNASSIGNED_TOKEN = 'none';

export interface IssueFiltersApi {
	/** Ready for `repository.issues.list`. Filtering never happens above this line. */
	query: IssueQuery;
	filter: IssueFilter;
	sort: IssueSort;
	/**
	 * Stable identity for the current view. Doubles as the React Query cache key and as the scope a
	 * row selection belongs to — selecting rows, then changing the filter, must not silently carry
	 * a selection over to a different set of issues.
	 */
	key: string;

	text: string;
	statuses: readonly IssueStatus[];
	priorities: readonly IssuePriority[];
	assignee: AssigneeValue;
	labelIds: readonly LabelId[];
	labelMatch: 'any' | 'all';

	/** How many filters are on, for the collapsed "Filters" button on small viewports. */
	activeCount: number;
	isFiltered: boolean;

	setText: (text: string) => void;
	setStatuses: (statuses: readonly IssueStatus[]) => void;
	setPriorities: (priorities: readonly IssuePriority[]) => void;
	setAssignee: (assignee: AssigneeValue) => void;
	setLabelIds: (labelIds: readonly LabelId[]) => void;
	setLabelMatch: (labelMatch: 'any' | 'all') => void;
	setSort: (sort: IssueSort) => void;
	clear: () => void;
}

/** Comma-separated, de-duplicated. Blank entries are dropped so `a,,b` is not three values. */
function splitList(raw: string): string[] {
	const parts = raw.split(',').map((part) => part.trim());

	return [...new Set(parts.filter((part) => part !== ''))];
}

function writeList(next: URLSearchParams, name: string, values: readonly string[]): void {
	if (values.length === 0) {
		next.delete(name);
	} else {
		next.set(name, values.join(','));
	}
}

export function useIssueFilters(): IssueFiltersApi {
	const [searchParams, setSearchParams] = useSearchParams();

	// Read through the raw strings rather than the `URLSearchParams` object: React Router hands back
	// a new instance on every render, so memoizing on it would memoize nothing.
	const textParam = searchParams.get(PARAM_TEXT) ?? '';
	const statusParam = searchParams.get(PARAM_STATUS) ?? '';
	const priorityParam = searchParams.get(PARAM_PRIORITY) ?? '';
	const assigneeParam = searchParams.get(PARAM_ASSIGNEE) ?? '';
	const labelsParam = searchParams.get(PARAM_LABELS) ?? '';
	const labelMatchParam = searchParams.get(PARAM_LABEL_MATCH) ?? '';
	const sortParam = searchParams.get(PARAM_SORT) ?? '';

	const text = textParam.trim();

	const statuses = useMemo<readonly IssueStatus[]>(
		() => splitList(statusParam).filter(isIssueStatus),
		[statusParam],
	);

	const priorities = useMemo<readonly IssuePriority[]>(
		() => splitList(priorityParam).filter(isIssuePriority),
		[priorityParam],
	);

	const labelIds = useMemo<readonly LabelId[]>(() => splitList(labelsParam), [labelsParam]);

	const assignee = useMemo<AssigneeValue>(() => {
		if (assigneeParam === '') {
			return null;
		}

		return assigneeParam === UNASSIGNED_TOKEN
			? { kind: 'unassigned' }
			: { kind: 'user', id: assigneeParam };
	}, [assigneeParam]);

	const labelMatch: 'any' | 'all' = labelMatchParam === 'all' ? 'all' : 'any';

	const sort = useMemo<IssueSort>(() => parseSort(sortParam) ?? DEFAULT_ISSUE_SORT, [sortParam]);

	const filter = useMemo<IssueFilter>(() => {
		const next: IssueFilter = {};

		if (text !== '') {
			next.text = text;
		}

		if (statuses.length > 0) {
			next.status = statuses;
		}

		if (priorities.length > 0) {
			next.priority = priorities;
		}

		if (assignee?.kind === 'user') {
			next.assigneeIds = [assignee.id];
		}

		if (assignee?.kind === 'unassigned') {
			next.unassigned = true;
		}

		if (labelIds.length > 0) {
			next.labelIds = labelIds;
			next.labelMatch = labelMatch;
		}

		return next;
	}, [text, statuses, priorities, assignee, labelIds, labelMatch]);

	const query = useMemo<IssueQuery>(() => ({ filter, sort }), [filter, sort]);

	const activeCount =
		(text === '' ? 0 : 1) +
		(statuses.length > 0 ? 1 : 0) +
		(priorities.length > 0 ? 1 : 0) +
		(assignee === null ? 0 : 1) +
		(labelIds.length > 0 ? 1 : 0);

	const key = useMemo(
		() =>
			JSON.stringify([
				text,
				statuses,
				priorities,
				assigneeParam,
				labelIds,
				labelMatch,
				sort.field,
				sort.direction,
			]),
		[text, statuses, priorities, assigneeParam, labelIds, labelMatch, sort],
	);

	/**
	 * `replace` for the text field only: a debounced search box would otherwise stack one history
	 * entry per pause in typing, and the back button would walk letter by letter.
	 */
	const update = useCallback(
		(mutate: (next: URLSearchParams) => void, replace = false) => {
			setSearchParams(
				(current) => {
					const next = new URLSearchParams(current);
					mutate(next);
					return next;
				},
				{ replace },
			);
		},
		[setSearchParams],
	);

	const setText = useCallback(
		(value: string) => {
			update((next) => {
				if (value.trim() === '') {
					next.delete(PARAM_TEXT);
				} else {
					next.set(PARAM_TEXT, value);
				}
			}, true);
		},
		[update],
	);

	const setStatuses = useCallback(
		(value: readonly IssueStatus[]) => update((next) => writeList(next, PARAM_STATUS, value)),
		[update],
	);

	const setPriorities = useCallback(
		(value: readonly IssuePriority[]) => update((next) => writeList(next, PARAM_PRIORITY, value)),
		[update],
	);

	const setAssignee = useCallback(
		(value: AssigneeValue) =>
			update((next) => {
				if (value === null) {
					next.delete(PARAM_ASSIGNEE);
				} else {
					next.set(PARAM_ASSIGNEE, value.kind === 'unassigned' ? UNASSIGNED_TOKEN : value.id);
				}
			}),
		[update],
	);

	const setLabelIds = useCallback(
		(value: readonly LabelId[]) =>
			update((next) => {
				writeList(next, PARAM_LABELS, value);

				// `labelMatch` alone selects nothing, so it must not outlive the labels it qualifies.
				if (value.length === 0) {
					next.delete(PARAM_LABEL_MATCH);
				}
			}),
		[update],
	);

	const setLabelMatch = useCallback(
		(value: 'any' | 'all') =>
			update((next) => {
				if (value === 'any') {
					next.delete(PARAM_LABEL_MATCH);
				} else {
					next.set(PARAM_LABEL_MATCH, value);
				}
			}),
		[update],
	);

	const setSort = useCallback(
		(value: IssueSort) =>
			update((next) => {
				const formatted = formatSort(value);

				if (formatted === formatSort(DEFAULT_ISSUE_SORT)) {
					next.delete(PARAM_SORT);
				} else {
					next.set(PARAM_SORT, formatted);
				}
			}),
		[update],
	);

	const clear = useCallback(
		() =>
			update((next) => {
				for (const name of OWNED_PARAMS) {
					next.delete(name);
				}
			}),
		[update],
	);

	return {
		query,
		filter,
		sort,
		key,
		text,
		statuses,
		priorities,
		assignee,
		labelIds,
		labelMatch,
		activeCount,
		isFiltered: activeCount > 0,
		setText,
		setStatuses,
		setPriorities,
		setAssignee,
		setLabelIds,
		setLabelMatch,
		setSort,
		clear,
	};
}
