import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useRepository } from '@/data';
import type { Issue, Page } from '@/data';
import { Badge } from '@/ds/badge';
import { Checkbox } from '@/ds/checkbox';
import { Combobox } from '@/ds/combobox';
import { IconCheck } from '@/ds/icons';
import { useDebounced } from './hooks';
import styles from './StressPickers.module.css';

const PAGE_SIZE = 40;

/** One line of wrapped title at the popup's width, plus the row's own padding. */
const LINE_HEIGHT = 18;
const ROW_CHROME = 30;
/** Rough characters per line at the popup width. Wrong on purpose for CJK, which is wider. */
const CHARS_PER_LINE = 46;
const MAX_ESTIMATED_LINES = 8;

/** What a caller writes when it has not thought about height at all. */
const NAIVE_HEIGHT = 36;

function estimateFromTitle(issue: Issue): number {
	const lines = Math.min(
		MAX_ESTIMATED_LINES,
		Math.max(1, Math.ceil(issue.title.length / CHARS_PER_LINE)),
	);

	return ROW_CHROME + lines * LINE_HEIGHT;
}

/**
 * Variable-height rows, from the seeded data rather than from a lab fixture.
 *
 * The generator puts a ~300-character title at issue index 3, an unbreakable 90-character word at
 * index 5 and a zero-width-space title at index 11, and the default sort is newest first — so the
 * first page of this picker contains all three without anybody scrolling for them (AGENTS.md —
 * evaluation rule 10).
 */
export function StressIssuePicker({ testId }: { testId: string }) {
	const repository = useRepository();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<readonly Issue[]>([]);
	const [naiveEstimate, setNaiveEstimate] = useState(false);
	const debouncedQuery = useDebounced(query);

	const search = useInfiniteQuery({
		queryKey: ['stress', 'issues', debouncedQuery],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.issues.list(
				{ filter: debouncedQuery === '' ? undefined : { text: debouncedQuery } },
				{ cursor: pageParam, limit: PAGE_SIZE, signal },
			),
		getNextPageParam: (lastPage: Page<Issue>) => lastPage.nextCursor,
	});

	const items = useMemo(
		() => (search.data?.pages ?? []).flatMap((page) => page.items),
		[search.data],
	);

	const status = search.isPending
		? 'loading'
		: search.isError
			? 'error'
			: search.isFetchingNextPage
				? 'loading-more'
				: 'idle';

	const total = search.data?.pages[0]?.total;

	return (
		<div className={styles.picker} data-testid={testId} data-loaded={items.length}>
			<div className={styles.controls}>
				<Checkbox
					label="Naive estimate (every row 36px)"
					checked={naiveEstimate}
					onCheckedChange={setNaiveEstimate}
				/>
			</div>

			<Combobox<Issue>
				items={items}
				itemKey={(issue) => issue.id}
				itemLabel={(issue) => issue.title}
				value={selected}
				onValueChange={setSelected}
				query={query}
				onQueryChange={setQuery}
				status={status}
				hasMore={search.hasNextPage}
				onEndReached={() => void search.fetchNextPage()}
				onRetry={() => void search.refetch()}
				total={total}
				estimateItemHeight={naiveEstimate ? () => NAIVE_HEIGHT : estimateFromTitle}
				popupWidth="anchor"
				placeholder="Search issues…"
				label="Issue"
				emptyMessage="No issue matches that."
				renderItem={(issue, state) => (
					// The wrapper is not decoration. `ds/combobox`'s `.item` centres its flex children,
					// which is right for a one-line row and wrong for an eight-line one, and the contract
					// exposes no hook for a row to say "align me to the top".
					<span className={styles.issueRow}>
						<Badge className={styles.issueKey}>{issue.key}</Badge>
						<span className={styles.issueTitle}>{issue.title}</span>
						{state.selected && <IconCheck className={styles.check} />}
					</span>
				)}
			/>

			<p className={styles.status}>
				{items.length.toLocaleString()} loaded
				{total === undefined ? '' : ` of ${total.toLocaleString()}`} · estimate:{' '}
				{naiveEstimate ? 'constant 36px' : 'derived from title length'}
			</p>
		</div>
	);
}
