import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useRepository } from '@/data';
import type { Page, User } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Combobox } from '@/ds/combobox';
import { IconCheck } from '@/ds/icons';
import { useDebounced } from './hooks';
import styles from './StressPickers.module.css';

/** Two lines with an avatar. Tall enough that a wrong estimate is visible, not subtle. */
const ROW_HEIGHT = 48;

export interface StressUserPickerProps {
	/** Marks the wrapper so a test can address one picker on a page that has several. */
	testId: string;
	label: string;
	placeholder?: string;
	pageSize?: number;
	multiple?: boolean;
	/**
	 * Preselect the item at this position in the unfiltered list, fetching pages until it exists.
	 * The point is scroll-to-selected-on-open: a value the popup has to travel thousands of rows to
	 * reach cannot be satisfied by rendering the first window and hoping.
	 */
	preselectIndex?: number;
}

/**
 * The workhorse of the stress routes: a real `<Combobox>` over the real repository, so every case
 * exercises whichever implementation `?impl=` resolved.
 */
export function StressUserPicker({
	testId,
	label,
	placeholder = 'Search people…',
	pageSize = 40,
	multiple = false,
	preselectIndex,
}: StressUserPickerProps) {
	const repository = useRepository();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<readonly User[]>([]);
	const [preselectSettled, setPreselectSettled] = useState(preselectIndex === undefined);
	const debouncedQuery = useDebounced(query);

	const search = useInfiniteQuery({
		queryKey: ['stress', 'users', debouncedQuery, pageSize],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.users.search(
				{ text: debouncedQuery === '' ? undefined : debouncedQuery },
				{ cursor: pageParam, limit: pageSize, signal },
			),
		getNextPageParam: (lastPage: Page<User>) => lastPage.nextCursor,
	});

	const items = useMemo(
		() => (search.data?.pages ?? []).flatMap((page) => page.items),
		[search.data],
	);

	const { hasNextPage, isFetchingNextPage, fetchNextPage } = search;

	// Page forward until the preselected row exists. Nothing here reaches past the repository into
	// the generator: the deep item is whatever the paged reads eventually hand back.
	useEffect(() => {
		if (preselectIndex === undefined || preselectSettled) {
			return;
		}

		const deep = items[preselectIndex];

		if (deep !== undefined) {
			setSelected([deep]);
			setPreselectSettled(true);
			return;
		}

		if (hasNextPage === true) {
			if (!isFetchingNextPage) {
				void fetchNextPage();
			}

			return;
		}

		// The dataset is smaller than the requested position — take the last row instead of
		// pretending the case ran.
		const last = items[items.length - 1];

		if (last !== undefined) {
			setSelected([last]);
			setPreselectSettled(true);
		}
	}, [preselectIndex, preselectSettled, items, hasNextPage, isFetchingNextPage, fetchNextPage]);

	const status = search.isPending
		? 'loading'
		: search.isError
			? 'error'
			: search.isFetchingNextPage
				? 'loading-more'
				: 'idle';

	const total = search.data?.pages[0]?.total;

	return (
		<div
			className={styles.picker}
			data-testid={testId}
			data-loaded={items.length}
			data-total={total ?? ''}
			data-preselected={selected.length > 0 ? 'true' : 'false'}
			data-preselect-settled={preselectSettled ? 'true' : 'false'}
		>
			<Combobox<User>
				items={items}
				itemKey={(user) => user.id}
				itemLabel={(user) => user.name}
				value={selected}
				onValueChange={setSelected}
				multiple={multiple}
				query={query}
				onQueryChange={setQuery}
				status={status}
				hasMore={search.hasNextPage}
				onEndReached={() => void search.fetchNextPage()}
				onRetry={() => void search.refetch()}
				total={total}
				estimateItemHeight={() => ROW_HEIGHT}
				placeholder={placeholder}
				label={label}
				emptyMessage="Nobody matches that."
				renderItem={(user, state) => (
					<>
						<Avatar name={user.name} initials={user.initials} hue={user.avatarHue} decorative />
						<span className={styles.rowText}>
							<span className={styles.rowPrimary}>{user.name}</span>
							<span className={styles.rowSecondary}>
								{user.title} · {user.team}
							</span>
						</span>
						{state.selected && <IconCheck className={styles.check} />}
					</>
				)}
			/>

			<p className={styles.status}>
				{items.length.toLocaleString()} loaded
				{total === undefined ? '' : ` of ${total.toLocaleString()}`}
				{preselectIndex === undefined
					? ''
					: ` · preselected #${preselectIndex.toLocaleString()}: ${
							selected[0]?.name ?? 'still paging…'
						}`}
			</p>
		</div>
	);
}
