/**
 * pr-5466 (mui/base-ui#5466) — the dual-mode `<Virtualizer>`, here in its context-binding mode.
 *
 * Dropped inside `<Combobox.List>` with no `items` of its own, the virtualizer takes the list's
 * filtered collection and its highlight from context. Everything the baseline hand-wires
 * disappears: no scroll element state, no `estimateSize`/`getItemKey` index lookups, no
 * `onItemHighlighted` → `scrollToIndex` bridge and therefore no item-index ↔ row-index mapping,
 * and no `virtualized` prop on Root.
 *
 * What it costs is that the windowed collection *is* the item collection. Rows that are not items —
 * group headers, the create affordance, the trailing loading row — have no place inside the
 * scrollport, so this file puts the headers inside the row of the item that opens a group, and
 * pins the create and loading rows below the scroll area (AGENTS.md — evaluation rule 1: the
 * contract stands, the adaptation is the finding).
 */

import { Combobox as BaseCombobox } from 'base-ui-5466/combobox';
import { Virtualizer } from 'base-ui-5466/virtualizer';
import { useCallback, useMemo, useState } from 'react';
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
import type { ComboboxProps } from '@/ds/combobox';
import { cx } from '@/ds/utils';
import { EndReachedSentinel } from './EndReached';

/** Rows left below the rendered window before the next page is requested. */
const END_REACHED_THRESHOLD = 6;

/**
 * Overscan is a pixel budget here, where the baseline's is a row count. With rows between 36px and
 * 52px the two cannot be made equal; this is roughly the baseline's 8 rows at the assignee
 * picker's estimate.
 */
const OVERSCAN_PX = 320;

/**
 * `Combobox.List` is the listbox, but no longer the scroll container: the virtualizer inside it is.
 * The shared `.list` class assumes the app owns the scrollport, so the listbox is left as a bare
 * flex wrapper that gives the virtualizer a bounded height inside the popup.
 */
const LIST_STYLE: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	flex: 1,
	minHeight: 0,
};

/**
 * The scrollport's height, which the shared `.list` class cannot supply here.
 *
 * Its `flex: 1` means `flex-basis: 0`, and the popup's height is its content's — so the scrollport
 * would be sized from the rows it decided to render, and the rows would be chosen from that height.
 * The rendered window does grow out of that loop over a frame or two, but the popup visibly grows
 * with it, and a surface resizing while a virtualizer measures rows is exactly what this project
 * agreed not to ship (AGENTS.md — Appearance).
 *
 * Sizing to the virtualizer's own `--total-size` breaks the loop the way the PR's documentation
 * describes: the whole collection is the natural height, the popup's `max-height` caps it, and the
 * scrollport shrinks into what is left — which is what the baseline's sized spacer does too.
 */
const SCROLLER_STYLE: CSSProperties = {
	flex: '0 1 auto',
	height: 'var(--total-size, auto)',
};

/**
 * Same runtime-vs-type mismatch as the baseline: `multiple` discriminates Root's props at the type
 * level, while this wrapper picks single or multi at runtime. One alias, one cast.
 */
type AnyRootProps = Record<string, unknown> & { children?: ReactNode };
const Root = BaseCombobox.Root as unknown as ComponentType<AnyRootProps>;

export function Pr5466Combobox<T>(props: ComboboxProps<T>) {
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

	/*
	 * The shared row model still decides *what* exists — where a group opens, whether a create row
	 * is offered, whether a loading row trails the list (AGENTS.md — evaluation rule 2). Only the
	 * item rows reach the virtualizer; the rest are read back off this array below.
	 */
	const rows = useMemo(
		() => buildRows({ items, itemKey, itemLabel, groupOf, query, onCreate, hasMore, status }),
		[items, itemKey, itemLabel, groupOf, query, onCreate, hasMore, status],
	);

	/*
	 * One pass over the model, because everything read off it is O(rows) and eager mode rebuilds
	 * the model on every keystroke:
	 *
	 * - `headings`: item index → the heading that opens at that item. A flat collection has no room
	 *   for header rows, so each header is rendered inside the row of the item it introduces.
	 * - `createQuery` / `hasLoadingRow`: the two rows that are not items at all.
	 */
	const { headings, createQuery, hasLoadingRow } = useMemo(() => {
		const map = new Map<number, string>();
		let pending: string | undefined;
		let create: string | undefined;
		let loading = false;

		for (const row of rows) {
			switch (row.kind) {
				case 'group':
					pending = row.label;
					break;
				case 'item':
					if (pending !== undefined) {
						map.set(row.itemIndex, pending);
						pending = undefined;
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

		return { headings: map, createQuery: create, hasLoadingRow: loading };
	}, [rows]);

	// The heights the shared model would have given the rows that no longer exist, so a row
	// carrying one of them is estimated at its real size rather than one too short.
	const headerHeight = estimateRowHeight<T>({ kind: 'group', key: '', label: '' }, props);
	const loadingHeight = estimateRowHeight<T>({ kind: 'loading', key: '' }, props);

	/*
	 * Purely to satisfy the contract's `ComboboxItemState.highlighted`: `Combobox.Item` takes
	 * `children` as a plain ReactNode, so a row renderer cannot be handed the item's own state.
	 * Unlike the baseline this is the *only* reason the highlight is tracked here — scrolling the
	 * highlighted item into view is the virtualizer's business now, so `rowIndexOfItem`,
	 * `scrollToIndex` and the `flushSync` they provoke are all gone.
	 */
	const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

	const handleHighlighted = useCallback((_item: unknown, details: { index: number }) => {
		setHighlightedIndex(details.index < 0 ? null : details.index);
	}, []);

	const selectedKeys = useMemo(() => new Set(value.map(itemKey)), [value, itemKey]);

	// Identity carries the guard, so a sentinel still mounted after a page lands asks again.
	const requestMore = useCallback(() => {
		if (hasMore === true && status === 'idle') {
			onEndReached?.();
		}
	}, [hasMore, status, onEndReached]);

	const lastIndex = items.length - 1;

	/*
	 * A function estimate is materialized for the *whole* collection every time its identity
	 * changes — the binding maps `items` through it and diffs the result — where the baseline's
	 * virtualizer calls its estimator per rendered index. Callers pass an inline arrow, so this
	 * identity changes on every render of this component, and with it that pass over every item.
	 */
	const estimatedItemHeight = useCallback(
		(item: T, index: number) =>
			estimateItemHeight(item) +
			(headings.has(index) ? headerHeight : 0) +
			(hasLoadingRow && index === lastIndex ? loadingHeight : 0),
		[estimateItemHeight, headings, headerHeight, hasLoadingRow, lastIndex, loadingHeight],
	);

	const renderRow = useCallback(
		(item: T, index: number) => {
			const heading = headings.get(index);
			const itemDisabled = isItemDisabled?.(item) ?? false;

			return (
				<>
					{heading !== undefined && <ComboboxGroupHeader label={heading} />}
					<BaseCombobox.Item
						value={item}
						disabled={itemDisabled}
						className={s.item}
						// The virtualizer supplies `aria-posinset` and `aria-setsize` (the loaded count).
						// The contract prefers the server's total when it knows one.
						aria-setsize={total ?? items.length}
					>
						{renderItem(item, {
							selected: selectedKeys.has(itemKey(item)),
							highlighted: highlightedIndex === index,
							disabled: itemDisabled,
						})}
					</BaseCombobox.Item>
					{/*
					 * The trailing loading row, riding along inside the last item's row. Pinning it under
					 * the scrollport instead would leave a spinner on screen for as long as another page
					 * exists — which, over a paged 5,000-person list, is always.
					 */}
					{hasLoadingRow && index === lastIndex && <ComboboxLoadingRow />}
					{index >= items.length - END_REACHED_THRESHOLD && (
						<EndReachedSentinel onReached={requestMore} />
					)}
				</>
			);
		},
		[
			hasLoadingRow,
			headings,
			highlightedIndex,
			isItemDisabled,
			itemKey,
			items.length,
			lastIndex,
			renderItem,
			requestMore,
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
			// The repository already filtered; without this Root would filter the page it was given
			// and the async path would quietly become a synchronous one. `virtualized` is deliberately
			// absent — it is the opt-out for third-party virtualizers and warns alongside this one.
			filter={null}
			multiple={multiple}
			value={multiple ? value : (value[0] ?? null)}
			onValueChange={handleValueChange}
			inputValue={query}
			onInputValueChange={onQueryChange}
			itemToStringLabel={itemLabel}
			isItemEqualToValue={(a: T, b: T) => itemKey(a) === itemKey(b)}
			// Keyboard navigation must skip disabled items it has never mounted, which the `disabled`
			// prop on a windowed Item cannot tell it.
			isItemDisabled={isItemDisabled}
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

						<BaseCombobox.List style={LIST_STYLE}>
							<Virtualizer
								getItemKey={itemKey}
								estimatedItemHeight={estimatedItemHeight}
								overscanPx={OVERSCAN_PX}
								// The virtualizer is the scroll container, so the shared scrollport class
								// belongs to it rather than to a div of ours.
								className={cx(s.list, popupWidth === 'content' && s.popupContent)}
								style={SCROLLER_STYLE}
								// Options are exposed as children of the listbox; this scrollport is not a
								// step in the accessibility tree.
								role="presentation"
							>
								{renderRow}
							</Virtualizer>
						</BaseCombobox.List>

						{/*
						 * Not a row. The virtualizer's collection holds items only and it owns every child
						 * of its scrollport, so the create affordance is pinned beneath the list. It has to
						 * be: an empty result is precisely when it matters, and then there is no row to
						 * carry it. Being always visible rather than 5,000 rows down is the accidental
						 * upside.
						 */}
						{createQuery !== undefined && (
							<button type="button" className={s.createRow} onClick={() => onCreate?.(createQuery)}>
								<ComboboxCreateContent query={createQuery} label={createLabel?.(createQuery)} />
							</button>
						)}

						<ComboboxFooter shown={items.length} total={total} />
					</BaseCombobox.Popup>
				</BaseCombobox.Positioner>
			</BaseCombobox.Portal>
		</Root>
	);
}

export default Pr5466Combobox;
