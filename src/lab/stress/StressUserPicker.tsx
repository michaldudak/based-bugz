import { useEffect, useState } from 'react';
import type { User } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Combobox } from '@/ds/combobox';
import { IconCheck } from '@/ds/icons';
import { usePeopleSearch } from '@/features/people';
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
 * exercises whichever implementation `?impl=` resolved — under whichever loading strategy
 * `?people=` selects, which is what lets the lab isolate virtualization from loading.
 */
export function StressUserPicker({
	testId,
	label,
	placeholder = 'Search people…',
	pageSize,
	multiple = false,
	preselectIndex,
}: StressUserPickerProps) {
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<readonly User[]>([]);
	const [preselectSettled, setPreselectSettled] = useState(preselectIndex === undefined);

	const people = usePeopleSearch(query, { pageSize });
	const { items, hasMore, fetchMore, draining } = people;

	/*
	 * Walk to the preselected row. Paged mode pages forward until it exists; eager mode just waits
	 * for the drain to reach it. Nothing here reaches past the repository into the generator: the
	 * deep item is whatever the loading strategy eventually hands back.
	 */
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

		if (hasMore && fetchMore !== undefined) {
			fetchMore();
			return;
		}

		if (draining) {
			// Eager mode is still pulling pages; the items array will grow on its own.
			return;
		}

		// The dataset is smaller than the requested position — take the last row instead of
		// pretending the case ran.
		const last = items[items.length - 1];

		if (last !== undefined) {
			setSelected([last]);
			setPreselectSettled(true);
		}
	}, [preselectIndex, preselectSettled, items, hasMore, fetchMore, draining]);

	return (
		<div
			className={styles.picker}
			data-testid={testId}
			data-loaded={items.length}
			data-total={people.total ?? ''}
			data-people-mode={people.mode}
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
				status={people.status}
				hasMore={people.hasMore}
				onEndReached={people.fetchMore}
				onRetry={people.retry}
				total={people.total}
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
				{people.total === undefined ? '' : ` of ${people.total.toLocaleString()}`}
				{people.mode === 'eager' ? (draining ? ' · draining…' : ' · all in memory') : ''}
				{preselectIndex === undefined
					? ''
					: ` · preselected #${preselectIndex.toLocaleString()}: ${
							selected[0]?.name ?? 'still paging…'
						}`}
			</p>
		</div>
	);
}
