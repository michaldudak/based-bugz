/**
 * pr-5414 — the standalone `<ListVirtualizer>` dropped into `Combobox.List`.
 *
 * The component binds to whatever list publishes the virtualization host contexts, and
 * `Combobox.List` publishes one. So the combobox integration is genuinely declarative: no scroll
 * element, no measurement, no index maths, and — unlike the baseline — no bridge between keyboard
 * navigation and the virtualizer, because the host hands the virtualizer the active index and it
 * scrolls itself.
 *
 * What the API cannot express is the row model. The host publishes the *item* collection
 * (`Combobox.Root`'s `items`), and the renderer must return exactly one `Combobox.Item` per item,
 * so group headers, the create affordance and the loading row are not rows the virtualizer knows
 * about. Headers are folded into the following item's row; create and loading move out of the
 * scroll container entirely. Both are recorded findings, not softened contract (AGENTS.md rule 1).
 */

import { Combobox as BaseCombobox } from 'base-ui-5414/combobox';
import { ListVirtualizer } from 'base-ui-5414/list-virtualizer';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType, CSSProperties, ReactNode } from 'react';
import {
	ComboboxCreateContent,
	ComboboxEmpty,
	ComboboxErrorState,
	ComboboxFooter,
	ComboboxGroupHeader,
	ComboboxLoadingRow,
	buildRows,
	comboboxStyles as s,
	estimateRowHeight,
} from '@/ds/combobox';
import type { ComboboxProps, ComboboxRow } from '@/ds/combobox';
import { cx } from '@/ds/utils';

/** Items left below the viewport before the next page is requested. */
const END_REACHED_THRESHOLD = 6;

/**
 * `multiple` is a type-level discriminator on Root, but this app picks single vs multi at runtime
 * from one shared wrapper — the same cast the baseline needs, for the same reason.
 */
type AnyRootProps = Record<string, unknown> & { children?: ReactNode };
const Root = BaseCombobox.Root as unknown as ComponentType<AnyRootProps>;

/**
 * `Combobox.List` is the listbox *and* the flex child of the popup, but the scroll container is
 * the virtualizer inside it, so the listbox has to pass its constrained height through.
 */
const LISTBOX_STYLE: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	flex: 1,
	minHeight: 0,
};

/** Only the group variant is read, so the item type is irrelevant. */
const GROUP_ROW: ComboboxRow<never> = { kind: 'group', key: 'group', label: '' };

interface VirtualRowProps {
	/** Set when this item opens a group; the header shares the item's row. */
	groupLabel?: string | undefined;
	index: number;
	itemCount: number;
	/** Undefined unless another page is worth asking for, which is the whole gate. */
	onNearEnd?: (() => void) | undefined;
	children: ReactNode;
}

/**
 * There is no end-reached callback, and the virtualizer re-windows without re-rendering the
 * component that owns the collection — so proximity to the end can only be observed from inside a
 * mounted row.
 */
function VirtualRow({ groupLabel, index, itemCount, onNearEnd, children }: VirtualRowProps) {
	useEffect(() => {
		if (onNearEnd && index >= itemCount - 1 - END_REACHED_THRESHOLD) {
			onNearEnd();
		}
	}, [onNearEnd, index, itemCount]);

	return (
		<>
			{groupLabel !== undefined && <ComboboxGroupHeader label={groupLabel} />}
			{children}
		</>
	);
}

export function Pr5414Combobox<T>(props: ComboboxProps<T>) {
	const {
		items,
		itemKey,
		itemLabel,
		groupOf,
		isItemDisabled,
		value,
		onValueChange,
		multiple = false,
		query,
		onQueryChange,
		status,
		hasMore,
		onEndReached,
		onRetry,
		total,
		renderItem,
		estimateItemHeight,
		onCreate,
		createLabel,
		renderChip,
		placeholder,
		emptyMessage,
		disabled,
		label,
		id,
		open,
		onOpenChange,
		popupWidth = 'anchor',
		className,
	} = props;

	// The shared row model still decides *what* the list contains — grouping, the create
	// affordance and the trailing loading row are app behaviour (AGENTS.md rule 2). Only their
	// placement changes, because this API windows items rather than rows.
	const rows = useMemo(
		() => buildRows({ items, itemKey, itemLabel, groupOf, query, onCreate, hasMore, status }),
		[items, itemKey, itemLabel, groupOf, query, onCreate, hasMore, status],
	);

	const { groupLabels, createQuery, hasLoadingRow } = useMemo(() => {
		const labels = new Map<number, string>();
		let pendingGroup: string | undefined;
		let create: string | undefined;
		let loading = false;

		for (const row of rows) {
			switch (row.kind) {
				case 'group':
					pendingGroup = row.label;
					break;
				case 'item':
					if (pendingGroup !== undefined) {
						labels.set(row.itemIndex, pendingGroup);
						pendingGroup = undefined;
					}
					break;
				case 'create':
					create = row.query;
					break;
				case 'loading':
					loading = true;
					break;
			}
		}

		return { groupLabels: labels, createQuery: create, hasLoadingRow: loading };
	}, [rows]);

	/*
	 * The row model's loading row means "there is more below", which reads correctly as the last
	 * row of a scrolling list and as a permanent bar under one does not. Outside the scroll
	 * container it can only be shown while a page is actually in flight.
	 */
	const showLoadingRow = hasLoadingRow && status === 'loading-more';

	/*
	 * Same cost as the baseline: `Item`'s children are plain ReactNode, so a row renderer that
	 * wants `highlighted` cannot be given it by the library. Tracking it here re-renders the
	 * mounted window on every arrow key.
	 */
	const [highlightedItemIndex, setHighlightedItemIndex] = useState<number | null>(null);

	const handleHighlighted = useCallback(
		(_item: unknown, details: { reason: string; index: number }) => {
			setHighlightedItemIndex(details.index < 0 ? null : details.index);
		},
		[],
	);

	const selectedKeys = useMemo(() => new Set(value.map(itemKey)), [value, itemKey]);

	const nearEnd = hasMore === true && status === 'idle' ? onEndReached : undefined;

	// A folded-in header is part of its item's row, so it is part of that row's estimate too.
	const groupHeaderHeight = estimateRowHeight(GROUP_ROW, props);
	const estimatedItemHeight = useCallback(
		(item: T, index: number) =>
			estimateItemHeight(item) + (groupLabels.has(index) ? groupHeaderHeight : 0),
		[estimateItemHeight, groupLabels, groupHeaderHeight],
	);

	const renderRow = useCallback(
		(item: T, index: number) => {
			const itemDisabled = isItemDisabled?.(item) ?? false;

			return (
				<VirtualRow
					groupLabel={groupLabels.get(index)}
					index={index}
					itemCount={items.length}
					onNearEnd={nearEnd}
				>
					<BaseCombobox.Item
						value={item}
						disabled={itemDisabled}
						className={s.item}
						// The host publishes the loaded count; the contract knows when the server
						// counted the matches and when it declined to.
						aria-setsize={total ?? items.length}
					>
						{renderItem(item, {
							selected: selectedKeys.has(itemKey(item)),
							highlighted: highlightedItemIndex === index,
							disabled: itemDisabled,
						})}
					</BaseCombobox.Item>
				</VirtualRow>
			);
		},
		[
			groupLabels,
			highlightedItemIndex,
			isItemDisabled,
			itemKey,
			items.length,
			nearEnd,
			renderItem,
			selectedKeys,
			total,
		],
	);

	function handleValueChange(next: unknown) {
		if (multiple) {
			onValueChange((next ?? []) as readonly T[]);
		} else {
			onValueChange(next === null || next === undefined ? [] : [next as T]);
		}
	}

	const showEmpty = status === 'idle' && rows.length === 0;

	return (
		<Root
			items={items}
			// The repository already filtered. Base UI filtering the page it was handed would turn
			// the async path into a synchronous one.
			filter={null}
			multiple={multiple}
			value={multiple ? value : (value[0] ?? null)}
			onValueChange={handleValueChange}
			inputValue={query}
			onInputValueChange={onQueryChange}
			itemToStringLabel={itemLabel}
			isItemEqualToValue={(a: T, b: T) => itemKey(a) === itemKey(b)}
			// Keyboard navigation has to skip disabled items it cannot see, and a windowed item is
			// unmounted more often than not — so `disabled` on the Item is not enough here.
			isItemDisabled={isItemDisabled ? (item: T) => isItemDisabled(item) : undefined}
			open={open}
			onOpenChange={onOpenChange}
			onItemHighlighted={handleHighlighted}
			disabled={disabled}
		>
			<BaseCombobox.Chips className={cx(s.control, className)}>
				{multiple &&
					value.map((selected) => (
						<span key={itemKey(selected)}>{renderChip?.(selected) ?? itemLabel(selected)}</span>
					))}
				<BaseCombobox.Input
					id={id}
					className={s.input}
					placeholder={placeholder}
					aria-label={label}
				/>
			</BaseCombobox.Chips>

			<BaseCombobox.Portal>
				<BaseCombobox.Positioner className={s.positioner} sideOffset={4} align="start">
					<BaseCombobox.Popup className={s.popup}>
						{status === 'error' && <ComboboxErrorState onRetry={onRetry} />}
						{status === 'loading' && <ComboboxLoadingRow label="Searching…" />}
						{showEmpty && <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>}

						<BaseCombobox.List style={LISTBOX_STYLE}>
							<ListVirtualizer<T>
								className={cx(s.list, popupWidth === 'content' && s.popupContent)}
								getItemKey={itemKey}
								estimatedItemHeight={estimatedItemHeight}
							>
								{renderRow}
							</ListVirtualizer>
						</BaseCombobox.List>

						{/*
						 * Neither of these is an item, so neither can be a virtualized row: the
						 * renderer must return exactly one `Combobox.Item`, and the virtualizer
						 * owns every child of the scroll container. They sit under the list
						 * instead of scrolling with it.
						 */}
						{createQuery !== undefined && (
							<button type="button" className={s.createRow} onClick={() => onCreate?.(createQuery)}>
								<ComboboxCreateContent query={createQuery} label={createLabel?.(createQuery)} />
							</button>
						)}
						{showLoadingRow && <ComboboxLoadingRow />}

						<ComboboxFooter shown={items.length} total={total} />
					</BaseCombobox.Popup>
				</BaseCombobox.Positioner>
			</BaseCombobox.Portal>
		</Root>
	);
}

export default Pr5414Combobox;
