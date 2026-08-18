/**
 * The assignee picker — the main consumer of the Combobox contract.
 *
 * It is the hard case on purpose (AGENTS.md — evaluation rule 9): two-line rows with an avatar, so
 * heights are genuinely variable; 5,000 users behind an async cursor-paged repository; and a
 * synthetic "Unassigned" row that belongs to the app rather than to the server, which means the
 * flat item list is heterogeneous in both shape and height.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useRepository } from '@/data';
import type { User, UserId } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Button } from '@/ds/button';
import { Combobox } from '@/ds/combobox';
import type { ComboboxStatus } from '@/ds/combobox';
import { IconCheck, IconClose, IconUser } from '@/ds/icons';
import { usePeopleSearch } from '@/features/people';
import type { AssigneeValue } from './useIssueFilters';
import styles from './AssigneePicker.module.css';

/** A person row is two lines plus an avatar; the synthetic row is one line. */
const USER_ROW_HEIGHT = 52;
const PLAIN_ROW_HEIGHT = 40;

type AssigneeOption = { kind: 'unassigned' } | { kind: 'user'; user: User };

const UNASSIGNED: AssigneeOption = { kind: 'unassigned' };
const UNASSIGNED_LABEL = 'Unassigned';
const NO_SELECTION: readonly AssigneeOption[] = [];

function optionKey(option: AssigneeOption): string {
	return option.kind === 'unassigned' ? 'unassigned' : option.user.id;
}

function optionLabel(option: AssigneeOption): string {
	return option.kind === 'unassigned' ? UNASSIGNED_LABEL : option.user.name;
}

export interface AssigneePickerProps {
	value: AssigneeValue;
	onChange: (value: AssigneeValue) => void;
	/** Offers the synthetic "Unassigned" row. Off for bulk assignment, where it means "clear". */
	allowUnassigned?: boolean;
	label?: string;
	placeholder?: string;
	/** Renders a button that resets the selection. The contract has no clear affordance of its own. */
	clearable?: boolean;
	id?: string;
	className?: string;
}

export function AssigneePicker({
	value,
	onChange,
	allowUnassigned = true,
	label = 'Assignee',
	placeholder = 'Anyone',
	clearable = true,
	id,
	className,
}: AssigneePickerProps) {
	const repository = useRepository();
	const [query, setQuery] = useState('');

	const selectedUserId: UserId | null = value?.kind === 'user' ? value.id : null;

	// A URL carries an id, but the contract's `value` is `readonly T[]` — so the picker cannot show
	// what is selected until it has fetched the whole entity behind that id.
	const selected = useQuery({
		queryKey: ['users', 'by-id', selectedUserId],
		queryFn: ({ signal }) =>
			selectedUserId === null
				? Promise.resolve<User[]>([])
				: repository.users.byIds([selectedUserId], { signal }),
		enabled: selectedUserId !== null,
		staleTime: Infinity,
	});

	const comboValue = useMemo<readonly AssigneeOption[]>(() => {
		if (value === null) {
			return NO_SELECTION;
		}

		if (value.kind === 'unassigned') {
			return [UNASSIGNED];
		}

		const user = selected.data?.[0];

		return user === undefined ? NO_SELECTION : [{ kind: 'user', user }];
	}, [value, selected.data]);

	/*
	 * Selecting an item makes the combobox write that item's label into the input, and the contract
	 * has exactly one `query` serving both "what the user typed" and "what the input displays". Left
	 * alone, choosing "Ada Lovelace" fires a server search for "Ada Lovelace" and reopening the popup
	 * shows a list of one. Treating the echo as an empty query is the workaround.
	 */
	const selectedLabel = comboValue[0] === undefined ? null : optionLabel(comboValue[0]);
	const typed = query.trim() === '' || query === selectedLabel ? '' : query.trim();

	// Debouncing is the hook's business now: it only makes sense when a network is involved, and
	// whether one is involved is exactly what the loading mode decides.
	const people = usePeopleSearch(typed);
	const search = people.query;

	const showUnassigned =
		allowUnassigned &&
		(search === '' || UNASSIGNED_LABEL.toLowerCase().includes(search.toLowerCase()));

	const items = useMemo<readonly AssigneeOption[]>(() => {
		const rows = people.items.map((user): AssigneeOption => ({ kind: 'user', user }));

		return showUnassigned ? [UNASSIGNED, ...rows] : rows;
	}, [people.items, showUnassigned]);

	const status: ComboboxStatus = people.status;

	// `total` is the server's count, but the list also carries a row the server has never heard of —
	// so the number the contract passes to `aria-setsize` has to be adjusted by hand.
	// Still adjusted by hand for the synthetic row. In eager mode the count is always known; in
	// paged mode it is whatever the repository chose to reveal.
	const total = people.total === undefined ? undefined : people.total + (showUnassigned ? 1 : 0);

	return (
		<div className={className}>
			<div className={styles.row}>
				<Combobox<AssigneeOption>
					items={items}
					itemKey={optionKey}
					itemLabel={optionLabel}
					value={comboValue}
					onValueChange={(next) => {
						const first = next[0];

						if (first === undefined) {
							onChange(null);
						} else if (first.kind === 'unassigned') {
							onChange({ kind: 'unassigned' });
						} else {
							onChange({ kind: 'user', id: first.user.id });
						}
					}}
					query={query}
					onQueryChange={setQuery}
					status={status}
					hasMore={people.hasMore}
					onEndReached={people.fetchMore}
					onRetry={people.retry}
					total={total}
					estimateItemHeight={(option) =>
						option.kind === 'user' ? USER_ROW_HEIGHT : PLAIN_ROW_HEIGHT
					}
					placeholder={placeholder}
					label={label}
					id={id}
					emptyMessage="Nobody matches that."
					renderItem={(option, state) =>
						option.kind === 'unassigned' ? (
							<>
								<span className={styles.unassignedIcon}>
									<IconUser />
								</span>
								<span className={styles.text}>
									<span className={styles.name}>{UNASSIGNED_LABEL}</span>
								</span>
								{state.selected && <IconCheck className={styles.check} />}
							</>
						) : (
							<>
								<Avatar
									name={option.user.name}
									initials={option.user.initials}
									hue={option.user.avatarHue}
									decorative
								/>
								<span className={styles.text}>
									<span className={styles.name}>{option.user.name}</span>
									<span className={styles.meta}>
										{option.user.title} · {option.user.team}
									</span>
								</span>
								{state.selected && <IconCheck className={styles.check} />}
							</>
						)
					}
				/>

				{clearable && value !== null && (
					<Button
						variant="ghost"
						size="sm"
						iconOnly
						aria-label={`Clear ${label.toLowerCase()} filter`}
						onClick={() => onChange(null)}
					>
						<IconClose size={14} />
					</Button>
				)}
			</div>
		</div>
	);
}
