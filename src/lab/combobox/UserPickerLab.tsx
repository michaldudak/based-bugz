import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useRepository } from '@/data';
import type { Page, User } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Checkbox } from '@/ds/checkbox';
import { Combobox, useComboboxImpl } from '@/ds/combobox';
import { IconCheck } from '@/ds/icons';
import styles from './UserPickerLab.module.css';

const PAGE_SIZE = 40;

/** Two-line rows are genuinely variable in height once names wrap — that is the point. */
const ESTIMATED_ROW_HEIGHT = 48;

function useDebounced(value: string, delay = 200): string {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}

export function UserPickerLab() {
	const repository = useRepository();
	const { activeName } = useComboboxImpl();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<readonly User[]>([]);
	const [multiple, setMultiple] = useState(false);
	const [grouped, setGrouped] = useState(false);
	const debouncedQuery = useDebounced(query);

	const search = useInfiniteQuery({
		queryKey: ['lab', 'users', debouncedQuery],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.users.search(
				{ text: debouncedQuery === '' ? undefined : debouncedQuery },
				{ cursor: pageParam, limit: PAGE_SIZE, signal },
			),
		getNextPageParam: (lastPage: Page<User>) => lastPage.nextCursor,
	});

	const items = useMemo(() => {
		const flat = (search.data?.pages ?? []).flatMap((page) => page.items);
		// Grouping requires items to arrive grouped; the server does not sort by team, so the lab
		// sorts what it has loaded. Rows genuinely reshuffle as pages arrive — a good stress case.
		return grouped ? flat.toSorted((a, b) => a.team.localeCompare(b.team)) : flat;
	}, [search.data, grouped]);

	const status = search.isPending
		? 'loading'
		: search.isError
			? 'error'
			: search.isFetchingNextPage
				? 'loading-more'
				: 'idle';

	return (
		<section className={styles.lab}>
			<header className={styles.header}>
				<h2 className={styles.title}>Assignee picker</h2>
				<p className={styles.note}>
					5,000 generated users, paged {PAGE_SIZE} at a time through the repository with simulated
					latency. Implementation: <code>{activeName}</code>.
				</p>
			</header>

			<div className={styles.controls}>
				<Checkbox
					label="Multiple"
					checked={multiple}
					onCheckedChange={(next) => {
						setMultiple(next);
						setSelected((current) => (next ? current : current.slice(0, 1)));
					}}
				/>
				<Checkbox label="Group by team" checked={grouped} onCheckedChange={setGrouped} />
			</div>

			<div className={styles.field}>
				<Combobox<User>
					items={items}
					itemKey={(user) => user.id}
					itemLabel={(user) => user.name}
					groupOf={grouped ? (user) => user.team : undefined}
					value={selected}
					onValueChange={setSelected}
					multiple={multiple}
					query={query}
					onQueryChange={setQuery}
					status={status}
					hasMore={search.hasNextPage}
					onEndReached={() => void search.fetchNextPage()}
					onRetry={() => void search.refetch()}
					total={search.data?.pages[0]?.total}
					estimateItemHeight={() => ESTIMATED_ROW_HEIGHT}
					placeholder="Search 5,000 people…"
					label="Assignee"
					emptyMessage="Nobody matches that."
					renderItem={(user, state) => (
						<>
							<Avatar name={user.name} initials={user.initials} hue={user.avatarHue} decorative />
							<span className={styles.rowText}>
								<span className={styles.rowName}>{user.name}</span>
								<span className={styles.rowMeta}>
									{user.title} · {user.team}
								</span>
							</span>
							{state.selected && <IconCheck className={styles.check} />}
						</>
					)}
				/>
			</div>

			<p className={styles.selection}>
				{selected.length === 0
					? 'Nothing selected.'
					: `Selected: ${selected.map((user) => user.name).join(', ')}`}
			</p>
		</section>
	);
}
