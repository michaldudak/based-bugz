import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { foldText, matchesUserText, useRepository } from '@/data';
import type { Page, User } from '@/data';
import type { ComboboxStatus } from '@/ds/combobox';
import { usePeopleLoadMode } from './mode';
import type { PeopleLoadMode } from './mode';

/** Default page size while paging on demand. Small enough that a page boundary is felt, not hidden. */
const PAGED_PAGE_SIZE = 40;

export interface PeopleSearchOptions {
	/** Paged mode only — eager mode always drains at the repository's maximum page size. */
	pageSize?: number;
}

/** Only paged mode debounces, and only because it is protecting the network. */
const PAGED_DEBOUNCE_MS = 200;

function useDebounced(value: string, delay: number, enabled: boolean): string {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		if (!enabled) {
			return;
		}

		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay, enabled]);

	return enabled ? debounced : value;
}

export interface PeopleSearchResult {
	items: readonly User[];
	status: ComboboxStatus;
	/** Always false in eager mode: the picker never drives loading there. */
	hasMore: boolean;
	/** Undefined in eager mode, so the contract's `onEndReached` is left unwired. */
	fetchMore: (() => void) | undefined;
	retry: () => void;
	total: number | undefined;
	mode: PeopleLoadMode;
	/** Eager mode only: how many people are in memory so far. */
	loadedCount: number;
	/** Eager mode only: true while the single bulk request is in flight. */
	loadingAll: boolean;
	/**
	 * The query actually in effect. In paged mode it lags the typed text by the debounce; in eager
	 * mode it is the typed text. Callers whose own rows depend on the query — a synthetic
	 * "Unassigned" row, say — must key off this rather than the raw input.
	 */
	query: string;
}

/**
 * People for a picker, under whichever loading strategy `?people=` selects.
 *
 * Both queries are declared unconditionally and one is disabled, because hooks cannot be called
 * conditionally — switching mode therefore remounts nothing and the two strategies share the same
 * component tree, which is what makes them comparable.
 */
export function usePeopleSearch(
	rawQuery: string,
	options: PeopleSearchOptions = {},
): PeopleSearchResult {
	const repository = useRepository();
	const mode = usePeopleLoadMode();
	const pageSize = options.pageSize ?? PAGED_PAGE_SIZE;

	/*
	 * Debouncing exists to spare the network, and eager mode has no network left to spare: the list
	 * is already in memory. Keeping the delay there would only add latency to a local array scan —
	 * and would hide the cost this mode exists to expose. So every keystroke scans all 5,000 people
	 * and rebuilds the row model synchronously, with no deferred rendering to soften it
	 * (evaluation rule 6). If that is slow, it is supposed to feel slow.
	 */
	const search = useDebounced(rawQuery, PAGED_DEBOUNCE_MS, mode === 'paged');

	/* ---- paged: one page at a time, driven by the viewport ---------------------------------- */

	const paged = useInfiniteQuery({
		queryKey: ['people', 'paged', search, pageSize],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.users.search(
				{ text: search === '' ? undefined : search },
				{ cursor: pageParam, limit: pageSize, signal },
			),
		getNextPageParam: (lastPage: Page<User>) => lastPage.nextCursor,
		enabled: mode === 'paged',
	});

	/* ---- eager: everyone, in one simulated request ------------------------------------------ */

	const eager = useQuery({
		// The whole people list, fetched once and reused for every query and every picker on the
		// page. One round-trip on purpose: draining pages would spend seconds of simulated latency
		// measuring the fake network, and the strategy exists to measure virtualization instead.
		queryKey: ['people', 'all'],
		queryFn: ({ signal }) => repository.users.all({ signal }),
		enabled: mode === 'eager',
		staleTime: Infinity,
		gcTime: Infinity,
	});

	const everyone = useMemo(() => eager.data ?? [], [eager.data]);

	const eagerItems = useMemo(() => {
		if (search === '') {
			return everyone;
		}

		// The repository's own predicate, so paged and eager return identical rows for a query.
		// Filtering happens on every keystroke with no async boundary and no deferred rendering
		// (evaluation rule 6) — if scanning the array is slow, it is supposed to feel slow.
		const needle = foldText(search);
		return everyone.filter((user) => matchesUserText(user, needle));
	}, [everyone, search]);

	if (mode === 'eager') {
		return {
			items: eagerItems,
			// A drain in progress is still usable: rows already loaded render immediately, so this
			// only reports 'loading' before the first page lands.
			status: eager.isPending ? 'loading' : eager.isError ? 'error' : 'idle',
			hasMore: false,
			fetchMore: undefined,
			retry: () => void eager.refetch(),
			// Eager mode always knows the count exactly — the contrast with paged is the point.
			total: eagerItems.length,
			mode,
			loadedCount: everyone.length,
			loadingAll: eager.isPending,
			query: search,
		};
	}

	const pagedItems = (paged.data?.pages ?? []).flatMap((page) => page.items);

	return {
		items: pagedItems,
		status: paged.isPending
			? 'loading'
			: paged.isError
				? 'error'
				: paged.isFetchingNextPage
					? 'loading-more'
					: 'idle',
		hasMore: paged.hasNextPage,
		fetchMore: () => void paged.fetchNextPage(),
		retry: () => void paged.refetch(),
		total: paged.data?.pages[0]?.total,
		mode,
		loadedCount: pagedItems.length,
		loadingAll: false,
		query: search,
	};
}
