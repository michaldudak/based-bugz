/**
 * The issue list — the standalone half of the evaluation.
 *
 * Virtualization is reached through `ds/list`, which resolves to the active implementation from
 * `?impl=` (PLAN.md — Phase 9). This file owns everything that is *not* virtualization: queries,
 * id resolution, selection, and the loading/empty/error states, which render in place of the list
 * rather than inside it so no implementation has to model them.
 *
 * Everything that narrows or orders the result happens in the repository. The only array operation
 * here is concatenating the pages React Query has already fetched.
 */

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router';
import { useRepository } from '@/data';
import type { Issue, IssueId, Label, LabelId, Page, User, UserId } from '@/data';
import { Button } from '@/ds/button';
import { Checkbox } from '@/ds/checkbox';
import { IconInbox, IconWarning } from '@/ds/icons';
import { List } from '@/ds/list';
import { Spinner } from '@/ds/spinner';
import { BulkActions } from './BulkActions';
import { IssueRow } from './IssueRow';
import { useMediaQuery } from './hooks';
import type { IssueFiltersApi } from './useIssueFilters';
import styles from './IssueList.module.css';

const PAGE_SIZE = 50;

/** Pre-measurement guesses. Stacked mobile rows are roughly three lines instead of one. */
const ROW_ESTIMATE = 44;
const ROW_ESTIMATE_STACKED = 104;

const STACKED_QUERY = '(max-width: 900px)';

const EMPTY_ISSUES: readonly Issue[] = [];

export interface IssueListProps {
	filters: IssueFiltersApi;
	selectedIds: ReadonlySet<IssueId>;
	onToggleSelected: (id: IssueId, selected: boolean) => void;
	onSelectAll: (ids: readonly IssueId[], selected: boolean) => void;
	onClearSelection: () => void;
}

export function IssueList({
	filters,
	selectedIds,
	onToggleSelected,
	onSelectAll,
	onClearSelection,
}: IssueListProps) {
	const repository = useRepository();
	const stacked = useMediaQuery(STACKED_QUERY);
	const { search } = useLocation();

	const issuesQuery = useInfiniteQuery({
		// `filters.key` is the whole filter and sort, serialized — the cursor the repository hands
		// back is only valid for the query that produced it, so the two must never drift apart.
		queryKey: ['issues', 'list', filters.key],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.issues.list(filters.query, { cursor: pageParam, limit: PAGE_SIZE, signal }),
		getNextPageParam: (lastPage: Page<Issue>) => lastPage.nextCursor,
	});

	const issues = useMemo<readonly Issue[]>(
		() => issuesQuery.data?.pages.flatMap((page) => page.items) ?? EMPTY_ISSUES,
		[issuesQuery.data],
	);

	/*
	 * Assignees and labels come back as ids. Resolving them in one batched read per set of loaded
	 * rows is what a server-backed client would do; `keepPreviousData` keeps the avatars on screen
	 * while the superset for a newly loaded page is in flight.
	 */
	const assigneeIds = useMemo(
		() => [...new Set(issues.flatMap((issue) => issue.assigneeId ?? []))].toSorted(),
		[issues],
	);

	const labelIds = useMemo(
		() => [...new Set(issues.flatMap((issue) => issue.labelIds.slice(0, 3)))].toSorted(),
		[issues],
	);

	const usersQuery = useQuery({
		queryKey: ['users', 'by-ids', assigneeIds],
		queryFn: ({ signal }) => repository.users.byIds(assigneeIds, { signal }),
		enabled: assigneeIds.length > 0,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	const labelsQuery = useQuery({
		queryKey: ['labels', 'by-ids', labelIds],
		queryFn: ({ signal }) => repository.labels.byIds(labelIds, { signal }),
		enabled: labelIds.length > 0,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	const usersById = useMemo<ReadonlyMap<UserId, User>>(
		() => new Map((usersQuery.data ?? []).map((user) => [user.id, user])),
		[usersQuery.data],
	);

	const labelsById = useMemo<ReadonlyMap<LabelId, Label>>(
		() => new Map((labelsQuery.data ?? []).map((label) => [label.id, label])),
		[labelsQuery.data],
	);

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = issuesQuery;

	// The List reports proximity to the end; whether that means anything is decided here.
	const handleEndReached = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			void fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const loadedIds = useMemo(() => issues.map((issue) => issue.id), [issues]);
	const selectedLoaded = loadedIds.reduce(
		(count, id) => (selectedIds.has(id) ? count + 1 : count),
		0,
	);
	const allLoadedSelected = loadedIds.length > 0 && selectedLoaded === loadedIds.length;

	/*
	 * `total` is absent whenever a filter is on, because counting matches would mean walking the
	 * whole dataset (AGENTS.md — evaluation rule 4). "N shown" is the honest reading; inventing a
	 * denominator would be a lie the repository deliberately refuses to tell.
	 */
	const total = issuesQuery.data?.pages[0]?.total;
	const countLabel =
		total === undefined
			? `${loadedIds.length.toLocaleString()} shown`
			: `${loadedIds.length.toLocaleString()} of ${total.toLocaleString()}`;

	const isEmpty = !issuesQuery.isPending && !issuesQuery.isError && issues.length === 0;
	const showList = !issuesQuery.isPending && !issuesQuery.isError && !isEmpty;

	// The toolbar acts on the whole selection, including rows scrolled out of the window.
	const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

	const renderItem = useCallback(
		(issue: Issue, index: number, rowProps: Parameters<typeof IssueRow>[0]['rowProps']) => (
			<IssueRow
				key={issue.id}
				issue={issue}
				usersById={usersById}
				labelsById={labelsById}
				selected={selectedIds.has(issue.id)}
				onToggleSelected={onToggleSelected}
				search={search}
				position={index + 1}
				setSize={total ?? -1}
				rowProps={rowProps}
			/>
		),
		[usersById, labelsById, selectedIds, onToggleSelected, search, total],
	);

	return (
		<section className={styles.list} aria-label="Issues">
			<div className={styles.header}>
				<Checkbox
					checked={allLoadedSelected}
					indeterminate={selectedLoaded > 0 && !allLoadedSelected}
					disabled={loadedIds.length === 0}
					onCheckedChange={(next) => onSelectAll(loadedIds, next)}
					aria-label="Select every loaded issue"
				/>
				<span className={styles.count}>{countLabel}</span>
				{/* Never claims to have selected rows that were never fetched. */}
				{hasNextPage && selectedLoaded > 0 && (
					<span className={styles.hint}>loaded rows only — {issues.length} of them so far</span>
				)}
				{!issuesQuery.isPending && issuesQuery.isFetching && !issuesQuery.isFetchingNextPage && (
					<span className={styles.headerStatus}>
						<Spinner size={12} />
						Updating
					</span>
				)}
			</div>

			{issuesQuery.isPending && (
				<div className={styles.state}>
					<Spinner size={18} label="Loading issues" />
				</div>
			)}

			{issuesQuery.isError && (
				<div className={styles.state}>
					<IconWarning />
					<p>Could not load issues.</p>
					<Button onClick={() => void issuesQuery.refetch()}>Try again</Button>
				</div>
			)}

			{isEmpty && (
				<div className={styles.state}>
					<IconInbox />
					<p>{filters.isFiltered ? 'No issues match these filters.' : 'No issues yet.'}</p>
					{filters.isFiltered && <Button onClick={filters.clear}>Clear filters</Button>}
				</div>
			)}

			{showList && (
				<List<Issue>
					items={issues}
					itemKey={(issue) => issue.id}
					estimateItemHeight={() => (stacked ? ROW_ESTIMATE_STACKED : ROW_ESTIMATE)}
					renderItem={renderItem}
					measureVersion={stacked ? 'stacked' : 'wide'}
					resetKey={filters.key}
					onEndReached={handleEndReached}
					aria-label="Issue results"
					trailing={
						hasNextPage || isFetchingNextPage ? (
							<div className={styles.sentinel}>
								<Spinner size={14} />
								Loading more…
							</div>
						) : undefined
					}
				/>
			)}

			{/*
			 * The selection toolbar floats over the list rather than appearing above it. Inserting a
			 * panel into the flow pushed every row down at the exact moment you were clicking rows —
			 * the second checkbox you reached for was no longer where you left it.
			 */}
			{selectedList.length > 0 && (
				<div className={styles.selectionLayer}>
					<BulkActions selectedIds={selectedList} onClear={onClearSelection} />
				</div>
			)}
		</section>
	);
}
