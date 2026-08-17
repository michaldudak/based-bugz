/**
 * Baseline implementation — the control the three PRs must beat.
 *
 * Stable `@base-ui/react` wired to TanStack Virtual the way the docs describe: `virtualized` on
 * Root so Base UI stops owning scroll/measurement, `filter={null}` because the repository already
 * filtered, explicit `index` on each Item, and `onItemHighlighted` to drive the virtualizer when
 * keyboard navigation lands on a row that is not mounted.
 *
 * This is what a Base UI user writes today, so the cost of everything below is the number the
 * candidate APIs are competing against.
 */

import { Combobox as BaseCombobox } from '@base-ui/react/combobox';
import { useVirtualizer } from '@tanstack/react-virtual';
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
	rowIndexOfItem,
} from '@/ds/combobox';
import type { ComboboxProps, ComboboxRow } from '@/ds/combobox';
import { cx } from '@/ds/utils';

/** Rows left below the viewport before the next page is requested. */
const END_REACHED_THRESHOLD = 6;

/**
 * `multiple` is a type-level discriminator on Root (`ComboboxRoot<Value, Multiple>`), but this app
 * picks single vs multi at runtime from one shared wrapper. There is no way to express that
 * without erasing Root's props, so the cast is confined to this one alias.
 */
type AnyRootProps = Record<string, unknown> & { children?: ReactNode };
const Root = BaseCombobox.Root as unknown as ComponentType<AnyRootProps>;

function rowStyle(start: number): CSSProperties {
	return {
		position: 'absolute',
		top: 0,
		left: 0,
		width: '100%',
		transform: `translateY(${start}px)`,
	};
}

export function BaselineCombobox<T>(props: ComboboxProps<T>) {
	const {
		items,
		itemKey,
		itemLabel,
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
	 * State, not a ref. Base UI mounts the popup lazily on open, so the scroll container does not
	 * exist during the render that creates the virtualizer. With a ref, `getScrollElement()`
	 * returns null, no re-render follows, and the list renders a correctly-sized spacer containing
	 * zero rows — a blank popup with a working scrollbar. A callback ref forces the re-render that
	 * lets the virtualizer measure.
	 */
	const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
	const rows = useMemo(() => buildRows(props), [props]);

	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => scrollElement,
		estimateSize: (index) => {
			const row = rows[index];
			return row === undefined ? 36 : estimateRowHeight(row, props);
		},
		getItemKey: (index) => rows[index]?.key ?? index,
		overscan: 8,
	});

	const virtualRows = virtualizer.getVirtualItems();

	/*
	 * Base UI hands item state to `className`/`render` as a function, but `Item`'s children are
	 * plain ReactNode — so a row renderer that needs `highlighted` cannot receive it from the
	 * library. Tracking it here costs a re-render of the mounted window on every arrow key, which
	 * is the price of satisfying the contract with this API.
	 */
	const [highlightedItemIndex, setHighlightedItemIndex] = useState<number | null>(null);

	// Keyboard navigation counts items; the virtualizer scrolls rows. Without this bridge,
	// arrowing onto an unmounted row moves the highlight somewhere the user cannot see.
	const handleHighlighted = useCallback(
		(_item: unknown, details: { reason: string; index: number }) => {
			setHighlightedItemIndex(details.index < 0 ? null : details.index);

			if (details.reason !== 'keyboard' || details.index < 0) {
				return;
			}

			const rowIndex = rowIndexOfItem(rows, details.index);

			if (rowIndex >= 0) {
				virtualizer.scrollToIndex(rowIndex, { align: 'auto' });
			}
		},
		[rows, virtualizer],
	);

	const selectedKeys = useMemo(() => new Set(value.map(itemKey)), [value, itemKey]);

	const lastVirtualRow = virtualRows[virtualRows.length - 1];
	const lastIndex = lastVirtualRow?.index ?? 0;

	useEffect(() => {
		if (
			hasMore === true &&
			status === 'idle' &&
			onEndReached &&
			lastIndex >= rows.length - 1 - END_REACHED_THRESHOLD
		) {
			onEndReached();
		}
	}, [hasMore, status, onEndReached, lastIndex, rows.length]);

	function handleValueChange(next: unknown) {
		if (multiple) {
			onValueChange((next ?? []) as readonly T[]);
		} else {
			onValueChange(next === null || next === undefined ? [] : [next as T]);
		}
	}

	function renderRow(row: ComboboxRow<T>, virtualIndex: number, start: number) {
		const style = rowStyle(start);

		switch (row.kind) {
			case 'group':
				// A plain element inside the listbox: Base UI's Group/GroupLabel parts expect to wrap
				// their items, which a flat virtualized row model cannot do. Hidden from assistive
				// tech, and items carry aria-posinset/setsize so position is still announced.
				return (
					<div
						key={row.key}
						ref={virtualizer.measureElement}
						data-index={virtualIndex}
						role="presentation"
						className={s.row}
						style={style}
					>
						<ComboboxGroupHeader label={row.label} />
					</div>
				);

			case 'item':
				return (
					<BaseCombobox.Item
						key={row.key}
						ref={virtualizer.measureElement}
						data-index={virtualIndex}
						index={row.itemIndex}
						value={row.item}
						disabled={isItemDisabled?.(row.item) ?? false}
						className={cx(s.item, s.row)}
						style={style}
						aria-setsize={total ?? items.length}
						aria-posinset={row.itemIndex + 1}
					>
						{renderItem(row.item, {
							selected: selectedKeys.has(itemKey(row.item)),
							highlighted: highlightedItemIndex === row.itemIndex,
							disabled: isItemDisabled?.(row.item) ?? false,
						})}
					</BaseCombobox.Item>
				);

			case 'create':
				return (
					<button
						key={row.key}
						ref={virtualizer.measureElement}
						data-index={virtualIndex}
						type="button"
						className={cx(s.createRow, s.row)}
						style={style}
						onClick={() => onCreate?.(row.query)}
					>
						<ComboboxCreateContent query={row.query} label={createLabel?.(row.query)} />
					</button>
				);

			case 'loading':
				return (
					<div
						key={row.key}
						ref={virtualizer.measureElement}
						data-index={virtualIndex}
						className={s.row}
						style={style}
					>
						<ComboboxLoadingRow />
					</div>
				);
		}
	}

	const showEmpty = status === 'idle' && rows.length === 0;

	return (
		<Root
			items={items}
			virtualized
			// The repository already filtered. Without this, Base UI would filter the page it was
			// given and the async path would quietly become a synchronous one.
			filter={null}
			multiple={multiple}
			value={multiple ? value : (value[0] ?? null)}
			onValueChange={handleValueChange}
			inputValue={query}
			onInputValueChange={onQueryChange}
			itemToStringLabel={itemLabel}
			isItemEqualToValue={(a: T, b: T) => itemKey(a) === itemKey(b)}
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
						<div
							ref={setScrollElement}
							className={cx(s.list, popupWidth === 'content' && s.popupContent)}
						>
							{status === 'error' && <ComboboxErrorState onRetry={onRetry} />}
							{status === 'loading' && <ComboboxLoadingRow label="Searching…" />}
							{showEmpty && <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>}

							<BaseCombobox.List
								className={s.viewport}
								style={{ height: virtualizer.getTotalSize() }}
							>
								{virtualRows.map((virtualRow) => {
									const row = rows[virtualRow.index];
									return row === undefined
										? null
										: renderRow(row, virtualRow.index, virtualRow.start);
								})}
							</BaseCombobox.List>
						</div>

						<ComboboxFooter shown={items.length} total={total} />
					</BaseCombobox.Popup>
				</BaseCombobox.Positioner>
			</BaseCombobox.Portal>
		</Root>
	);
}

export default BaselineCombobox;
