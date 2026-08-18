/**
 * pr-5173 — Base UI's built-in `<Combobox.Virtualizer>` part.
 *
 * The library owns the scroll container, measurement, windowing and index maths, so the app is
 * left with a renderer and the props that feed it. What the app gives up in exchange is visible
 * here: the part is the *only* thing `<Combobox.List>` may render items through, every renderer
 * must return exactly one `<Combobox.Item>`, and grouped collections are not supported at all.
 *
 * Consequences recorded rather than worked around (AGENTS.md — evaluation rule 1):
 *
 * - `groupOf` is **unexpressible**. The part warns on grouped collections and has no header row
 *   concept, so this implementation renders flat and says so in dev. Faking headers — sentinel
 *   entries, sticky overlays, one Item that draws two rows — would hide the finding.
 * - The create affordance and the trailing loading row are not `Combobox.Item`s, so they cannot be
 *   rows. They render as siblings *below* the listbox instead: outside the scrollport rather than
 *   appended to it. Keeping them inside `<Combobox.List>` would put non-`option` children in a
 *   `role="listbox"`, which is worse than moving them.
 * - Nothing reports the rendered range, so `onEndReached` is driven from a raw `scroll` listener on
 *   the part plus a post-commit check for the case where the whole page fits without scrolling.
 */

import { Combobox as BaseCombobox } from 'base-ui-5173/combobox';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType, CSSProperties, ReactNode, UIEvent } from 'react';
import {
	ComboboxCreateContent,
	ComboboxEmpty,
	ComboboxErrorState,
	ComboboxFooter,
	ComboboxLoadingRow,
	buildRows,
	comboboxStyles as s,
} from '@/ds/combobox';
import type { ComboboxProps } from '@/ds/combobox';
import { cx } from '@/ds/utils';
import { useStableCallback } from './stable';

/** Pixels of unscrolled content left below the viewport before the next page is requested. */
const END_REACHED_THRESHOLD_PX = 240;

/**
 * `multiple` is a type-level discriminator on Root (`ComboboxRoot<Value, Multiple>`), but this app
 * picks single vs multi at runtime from one shared wrapper. Same cast, and same reason, as the
 * baseline: there is no way to express a runtime choice without erasing Root's props.
 */
type AnyRootProps = Record<string, unknown> & { children?: ReactNode };
const Root = BaseCombobox.Root as unknown as ComponentType<AnyRootProps>;

/**
 * The virtualizer is the scrollport, so `<Combobox.List>` stops being the scroll container and
 * becomes a layout pass-through. Without this the part has no height constraint, renders every row
 * and warns about it — the shared `.list` class cannot reach it through an unstyled listbox.
 */
const LIST_STYLE: CSSProperties = {
	display: 'flex',
	flex: 1,
	flexDirection: 'column',
	minHeight: 0,
};

export function Pr5173Combobox<T>(props: ComboboxProps<T>) {
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

	useEffect(() => {
		if (import.meta.env.DEV && groupOf !== undefined) {
			console.warn(
				'[pr-5173] <Combobox.Virtualizer> does not support grouped collections, so `groupOf` ' +
					'is ignored and the list renders flat (AGENTS.md — evaluation rule 1).',
			);
		}
	}, [groupOf]);

	/*
	 * The part owns every item row, so the shared row model is consulted only for the two rows it
	 * cannot own. With `groupOf` left out the model is items-then-tail, so the tail is whatever
	 * follows the items: at most a create row and a loading row.
	 */
	const rows = useMemo(
		() => buildRows({ items, itemKey, itemLabel, query, onCreate, hasMore, status }),
		[items, itemKey, itemLabel, query, onCreate, hasMore, status],
	);

	const tail = rows.slice(items.length);
	const createRow = tail.find((row) => row.kind === 'create');
	const showLoadingRow = tail.some((row) => row.kind === 'loading');

	const getItemKey = useStableCallback(itemKey);
	const estimatedItemHeight = useStableCallback(estimateItemHeight);

	/*
	 * Same bridge the baseline needs, minus the scrolling half: `Item`'s children are a plain
	 * ReactNode, so a row renderer that wants `highlighted` cannot be handed it by the library.
	 * The virtualizer does scroll the highlighted row into view by itself, which is the one piece
	 * of that bridge this API removes.
	 */
	const [highlightedItemIndex, setHighlightedItemIndex] = useState<number | null>(null);

	const handleHighlighted = useCallback((_item: unknown, details: { index: number }) => {
		setHighlightedItemIndex(details.index < 0 ? null : details.index);
	}, []);

	const selectedKeys = useMemo(() => new Set(value.map(itemKey)), [value, itemKey]);

	// The part mounts with the popup, so a ref would still be null on the render that wants to
	// measure it. State forces the re-render that lets the end-reached check run.
	const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

	const maybeRequestMore = useCallback(
		(element: HTMLElement) => {
			if (hasMore !== true || status !== 'idle' || onEndReached === undefined) {
				return;
			}

			if (
				element.scrollHeight - element.scrollTop - element.clientHeight <=
				END_REACHED_THRESHOLD_PX
			) {
				onEndReached();
			}
		},
		[hasMore, status, onEndReached],
	);

	// A page that does not fill the scrollport produces no scroll event, so opening the popup on a
	// short first page would otherwise never ask for a second one.
	useEffect(() => {
		if (scrollElement !== null) {
			maybeRequestMore(scrollElement);
		}
	}, [scrollElement, items.length, maybeRequestMore]);

	const handleScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => {
			maybeRequestMore(event.currentTarget);
		},
		[maybeRequestMore],
	);

	function handleValueChange(next: unknown) {
		if (multiple) {
			onValueChange((next ?? []) as readonly T[]);
		} else {
			onValueChange(next === null || next === undefined ? [] : [next as T]);
		}
	}

	const showEmpty = status === 'idle' && items.length === 0 && createRow === undefined;

	return (
		<Root
			items={items}
			// The repository already filtered. Without this, Base UI would filter the page it was
			// given and the async path would quietly become a synchronous one.
			filter={null}
			// No `virtualized` prop: that one is for external virtualizers, and setting it alongside
			// the built-in part warns.
			multiple={multiple}
			value={multiple ? value : (value[0] ?? null)}
			onValueChange={handleValueChange}
			inputValue={query}
			onInputValueChange={onQueryChange}
			itemToStringLabel={itemLabel}
			isItemEqualToValue={(a: T, b: T) => itemKey(a) === itemKey(b)}
			// Disabled state has to live on Root rather than on the Item: an unmounted row still has
			// to be skipped by keyboard navigation, and only Root knows about rows it cannot see.
			isItemDisabled={isItemDisabled === undefined ? undefined : (item: T) => isItemDisabled(item)}
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
							<BaseCombobox.Virtualizer
								ref={setScrollElement}
								className={cx(s.list, popupWidth === 'content' && s.popupContent)}
								onScroll={handleScroll}
								getItemKey={getItemKey}
								estimatedItemHeight={estimatedItemHeight}
							>
								{(item: T, index: number) => (
									<BaseCombobox.Item
										value={item}
										className={s.item}
										// The part supplies `aria-posinset` and a set size of "rows loaded so
										// far". The contract knows better: `total` when the server counted,
										// and it is deliberately allowed to be unknown.
										aria-setsize={total ?? items.length}
									>
										{renderItem(item, {
											selected: selectedKeys.has(itemKey(item)),
											highlighted: highlightedItemIndex === index,
											disabled: isItemDisabled?.(item) ?? false,
										})}
									</BaseCombobox.Item>
								)}
							</BaseCombobox.Virtualizer>
						</BaseCombobox.List>

						{/*
						 * Below the listbox rather than appended to it: neither row is an item, and the
						 * virtualizer must be the only thing rendering items inside `Combobox.List`.
						 */}
						{createRow !== undefined && (
							<button
								type="button"
								className={s.createRow}
								onClick={() => onCreate?.(createRow.query)}
							>
								<ComboboxCreateContent
									query={createRow.query}
									label={createLabel?.(createRow.query)}
								/>
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

export default Pr5173Combobox;
