/**
 * The label picker: multi-select with chips, plus create-new.
 *
 * Where the assignee picker stresses row height, this one stresses everything around the list —
 * a value that is several entities wide, chips that have to be removable from outside the popup,
 * and an affordance whose whole job is to mutate the dataset the list is paging over.
 */

import { useMutation, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/app/session';
import { useRepository } from '@/data';
import type { Label, LabelId, Page } from '@/data';
import { Button } from '@/ds/button';
import { Combobox, ComboboxChip } from '@/ds/combobox';
import type { ComboboxStatus } from '@/ds/combobox';
import { IconCheck, IconClose } from '@/ds/icons';
import { useToast } from '@/ds/toast';
import { useDebouncedValue } from './hooks';
import { labelColorStyle } from './meta';
import styles from './LabelPicker.module.css';

const PAGE_SIZE = 40;
const ROW_HEIGHT = 36;

const NO_LABELS: readonly Label[] = [];

export interface LabelPickerProps {
	value: readonly LabelId[];
	onChange: (value: readonly LabelId[]) => void;
	label?: string;
	placeholder?: string;
	id?: string;
	className?: string;
}

export function LabelPicker({
	value,
	onChange,
	label = 'Labels',
	placeholder = 'Any label',
	id,
	className,
}: LabelPickerProps) {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();
	const [query, setQuery] = useState('');
	const search = useDebouncedValue(query.trim());

	// Same shape as the assignee picker: the URL holds ids, the contract wants entities.
	const selectedIds = useMemo(() => value.toSorted(), [value]);

	const selected = useQuery({
		queryKey: ['labels', 'by-ids', selectedIds],
		queryFn: ({ signal }) => repository.labels.byIds(selectedIds, { signal }),
		enabled: selectedIds.length > 0,
		staleTime: Infinity,
	});

	const labels = useInfiniteQuery({
		queryKey: ['labels', 'search', search],
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.labels.search(
				{ text: search === '' ? undefined : search },
				{ cursor: pageParam, limit: PAGE_SIZE, signal },
			),
		getNextPageParam: (lastPage: Page<Label>) => lastPage.nextCursor,
	});

	const items = useMemo<readonly Label[]>(
		() => (labels.data?.pages ?? []).flatMap((page) => page.items),
		[labels.data],
	);

	const create = useMutation({
		mutationFn: (name: string) => repository.labels.create({ name }, { actorId: currentUser.id }),
		onSuccess: (created) => {
			onChange([...value, created.id]);
			setQuery('');
			void queryClient.invalidateQueries({ queryKey: ['labels'] });
			toast.show({ title: `Created “${created.name}”`, variant: 'success' });
		},
		onError: () => {
			toast.show({
				title: 'Could not create that label',
				description: 'The repository rejected the write. Try again.',
				variant: 'error',
			});
		},
	});

	/*
	 * The contract's `status` describes the *list*, and `onCreate` is fire-and-forget — there is no
	 * way to tell it a write is in flight. Folding "creating" into `loading` would blank the list,
	 * so the pending state is surfaced next to the field instead.
	 */
	const status: ComboboxStatus = labels.isPending
		? 'loading'
		: labels.isError
			? 'error'
			: labels.isFetchingNextPage
				? 'loading-more'
				: 'idle';

	function removeLabel(labelId: LabelId) {
		onChange(value.filter((current) => current !== labelId));
	}

	return (
		<div className={className}>
			<div className={styles.row}>
				<Combobox<Label>
					multiple
					items={items}
					itemKey={(item) => item.id}
					itemLabel={(item) => item.name}
					value={selected.data ?? NO_LABELS}
					onValueChange={(next) => onChange(next.map((item) => item.id))}
					query={query}
					onQueryChange={setQuery}
					status={status}
					hasMore={labels.hasNextPage}
					onEndReached={() => void labels.fetchNextPage()}
					onRetry={() => void labels.refetch()}
					total={labels.data?.pages[0]?.total}
					estimateItemHeight={() => ROW_HEIGHT}
					placeholder={value.length === 0 ? placeholder : undefined}
					label={label}
					id={id}
					emptyMessage="No label matches that."
					onCreate={(name) => create.mutate(name)}
					createLabel={(name) => `Create label “${name}”`}
					renderChip={(item) => (
						<ComboboxChip label={item.name} onRemove={() => removeLabel(item.id)} />
					)}
					renderItem={(item, state) => (
						<>
							<span className={styles.swatch} style={labelColorStyle(item.hue)} />
							<span className={styles.name}>{item.name}</span>
							{state.selected && <IconCheck className={styles.check} />}
						</>
					)}
				/>

				{value.length > 0 && (
					<Button
						variant="ghost"
						size="sm"
						iconOnly
						aria-label="Clear label filter"
						onClick={() => onChange([])}
					>
						<IconClose size={14} />
					</Button>
				)}
			</div>

			{create.isPending && <p className={styles.pending}>Creating label…</p>}
		</div>
	);
}
