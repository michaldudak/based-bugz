import { useMemo, useState } from 'react';
import type { User } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Checkbox } from '@/ds/checkbox';
import { Combobox } from '@/ds/combobox';
import { useImplRegistry } from '@/ds/registry';
import { IconCheck } from '@/ds/icons';
import { Page } from '@/ds/page';
import { usePeopleSearch } from '@/features/people';
import styles from './UserPickerLab.module.css';

/** Two-line rows are genuinely variable in height once names wrap — that is the point. */
const ESTIMATED_ROW_HEIGHT = 48;

export function UserPickerLab() {
	const { activeName } = useImplRegistry();
	const [query, setQuery] = useState('');
	const [selected, setSelected] = useState<readonly User[]>([]);
	const [multiple, setMultiple] = useState(false);
	const [grouped, setGrouped] = useState(false);

	const people = usePeopleSearch(query);

	const items = useMemo(() => {
		const flat = people.items;
		// Grouping requires items to arrive grouped; the server does not sort by team, so the lab
		// sorts what it has loaded. Rows genuinely reshuffle as pages arrive — a good stress case.
		return grouped ? flat.toSorted((a, b) => a.team.localeCompare(b.team)) : flat;
	}, [people.items, grouped]);

	return (
		<Page.Section className={styles.lab}>
			<Page.SectionTitle>Assignee picker</Page.SectionTitle>
			<Page.Description>
				5,000 generated users through the repository, with simulated latency. Implementation:{' '}
				<code>{activeName}</code>, loading: <code>{people.mode}</code>
				{people.mode === 'eager' &&
					(people.draining
						? ` — draining, ${people.loadedCount.toLocaleString()} in memory so far`
						: ` — all ${people.loadedCount.toLocaleString()} in memory`)}
				.
			</Page.Description>

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
					status={people.status}
					hasMore={people.hasMore}
					onEndReached={people.fetchMore}
					onRetry={people.retry}
					total={people.total}
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
		</Page.Section>
	);
}
