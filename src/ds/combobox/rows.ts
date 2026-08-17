import type { ComboboxProps, ComboboxRow } from './types';

/**
 * Builds the flat row model from items. Shared by every implementation on purpose: grouping,
 * create-affordance placement and the trailing loading row are app behaviour, not virtualization
 * strategy, so implementations must not each invent their own (AGENTS.md — evaluation rule 2).
 */
export function buildRows<T>(props: ComboboxProps<T>): ComboboxRow<T>[] {
	const { items, itemKey, itemLabel, groupOf, query, onCreate, hasMore, status } = props;
	const rows: ComboboxRow<T>[] = [];
	let currentGroup: string | undefined;

	items.forEach((item, itemIndex) => {
		if (groupOf) {
			const group = groupOf(item);

			if (group !== undefined && group !== currentGroup) {
				currentGroup = group;
				rows.push({ kind: 'group', key: `group:${group}`, label: group });
			}
		}

		rows.push({ kind: 'item', key: `item:${itemKey(item)}`, item, itemIndex });
	});

	// Appended rather than pinned to the top: a create row that appears above the list shifts
	// every row down as you type, which moves the item under the highlight.
	const trimmed = query.trim();

	if (onCreate && trimmed !== '') {
		const exists = items.some((item) => itemLabel(item).toLowerCase() === trimmed.toLowerCase());

		if (!exists) {
			rows.push({ kind: 'create', key: `create:${trimmed}`, query: trimmed });
		}
	}

	if (hasMore === true || status === 'loading-more') {
		rows.push({ kind: 'loading', key: 'loading-more' });
	}

	return rows;
}

/** Height for a row before it is measured. */
export function estimateRowHeight<T>(row: ComboboxRow<T>, props: ComboboxProps<T>): number {
	switch (row.kind) {
		case 'item':
			return props.estimateItemHeight(row.item);
		case 'group':
			return props.groupHeaderHeight ?? 28;
		case 'create':
		case 'loading':
			return 36;
	}
}

/**
 * Row position for an item position. Implementations need this to honour keyboard navigation,
 * which counts items, while the virtualizer scrolls rows.
 */
export function rowIndexOfItem<T>(rows: readonly ComboboxRow<T>[], itemIndex: number): number {
	return rows.findIndex((row) => row.kind === 'item' && row.itemIndex === itemIndex);
}
