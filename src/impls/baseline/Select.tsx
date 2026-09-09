/**
 * Baseline Select — stable Base UI + TanStack Virtual, the control for the Select surface.
 *
 * There is no documented recipe to follow here, and that absence is itself the finding: stable
 * Select has no `virtualized` opt-out and no `onItemHighlighted`, the two props the documented
 * Combobox recipe leans on. What follows is the assembly a user makes from the combobox recipe by
 * analogy — own scrollport, spacer sized to the total, absolutely positioned windowed items — and
 * whatever keyboard behaviour falls out is what stable Select users get today: navigation and
 * typeahead see only the mounted window, because items register as they mount and nothing tells
 * the root about the rest of the collection.
 */

import { Select as BaseSelect } from '@base-ui/react/select';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { IconCheck, IconChevronDown } from '@/ds/icons';
import { selectStyles as s } from '@/ds/select';
import type { SelectProps } from '@/ds/select';
import { cx } from '@/ds/utils';

function rowStyle(start: number): CSSProperties {
	return {
		position: 'absolute',
		top: 0,
		insetInlineStart: 0,
		width: '100%',
		transform: `translateY(${start}px)`,
	};
}

export function BaselineSelect<T>(props: SelectProps<T>) {
	const {
		items,
		itemKey,
		itemLabel,
		isItemDisabled,
		value,
		onValueChange,
		renderItem,
		renderValue,
		estimateItemHeight,
		placeholder = 'Select…',
		disabled,
		required,
		name,
		id,
		label,
		size = 'md',
		open,
		onOpenChange,
		className,
	} = props;

	/*
	 * State, not a ref, for the same reason as the baseline Combobox: the popup mounts lazily on
	 * open, so a plain ref would leave `getScrollElement()` returning null with no re-render to
	 * recover — a blank popup with a correctly sized scrollbar.
	 */
	const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollElement,
		estimateSize: (index) => {
			const item = items[index];
			return item === undefined ? 28 : estimateItemHeight(item);
		},
		getItemKey: (index) => {
			const item = items[index];
			return item === undefined ? index : itemKey(item);
		},
		overscan: 8,
	});

	const selectedIndex = useMemo(
		() => (value === null ? -1 : items.findIndex((item) => itemKey(item) === itemKey(value))),
		[items, itemKey, value],
	);

	/*
	 * Scroll-to-selected on open, by hand. Stable Select scrolls the selected item into view
	 * itself — but only if the item is mounted, and a deep selection is thousands of rows below
	 * the initial window. `scrollElement` doubles as the open signal, because the scrollport only
	 * exists while the popup does.
	 */
	useEffect(() => {
		if (scrollElement !== null && selectedIndex >= 0) {
			virtualizer.scrollToIndex(selectedIndex, { align: 'center' });
		}
	}, [scrollElement, selectedIndex, virtualizer]);

	const virtualItems = virtualizer.getVirtualItems();

	/*
	 * The anchor row: the selected item, kept mounted whenever the window does not contain it —
	 * which includes the entire time the popup is closed, when the hidden scrollport measures
	 * 0×0 and the window is empty. Without it no selection survives: stable Select treats "the
	 * selected value is not among the registered items" as "the item was removed" and resets the
	 * value to null the moment the window moves or the popup closes (the Positioner's map-change
	 * cleanup) — Enter and pointer selection both visibly commit, then immediately revert
	 * (FINDINGS.md). Positioned from the estimate and never measured, because it only exists to
	 * stay registered.
	 */
	const selectedItem = selectedIndex >= 0 ? items[selectedIndex] : undefined;
	const anchorNeeded =
		selectedItem !== undefined &&
		!virtualItems.some((virtualItem) => virtualItem.index === selectedIndex);

	return (
		<BaseSelect.Root<T>
			value={value}
			onValueChange={(next) => onValueChange(next)}
			isItemEqualToValue={(a, b) => itemKey(a) === itemKey(b)}
			itemToStringLabel={itemLabel}
			// Objects all serialize alike without this, and the form value would be garbage.
			itemToStringValue={itemKey}
			disabled={disabled}
			required={required}
			name={name}
			open={open}
			onOpenChange={onOpenChange}
		>
			<BaseSelect.Trigger
				id={id}
				aria-label={label}
				className={cx(s.trigger, size === 'sm' && s.sm, className)}
			>
				<BaseSelect.Value className={s.value}>
					{(current: T | null) => {
						if (current == null) {
							return placeholder;
						}

						return <span className={s.text}>{renderValue?.(current) ?? itemLabel(current)}</span>;
					}}
				</BaseSelect.Value>
				<BaseSelect.Icon className={s.chevron}>
					<IconChevronDown size={14} />
				</BaseSelect.Icon>
			</BaseSelect.Trigger>
			<BaseSelect.Portal>
				<BaseSelect.Positioner
					className={s.positioner}
					sideOffset={4}
					align="start"
					alignItemWithTrigger={false}
				>
					<BaseSelect.Popup className={s.popup}>
						<div ref={setScrollElement} className={s.list}>
							{/*
							 * The spacer is a plain div inside the listbox, not the List itself, because
							 * `Select.List` silently swallows the `style` prop in 1.7.0 — the sized-spacer
							 * assembly that works on `Combobox.List` renders a 0-height list here
							 * (FINDINGS.md). `role="presentation"` keeps the extra layer out of the
							 * listbox's required option/group children.
							 */}
							<BaseSelect.List className={s.viewport}>
								<div
									role="presentation"
									style={{ position: 'relative', height: virtualizer.getTotalSize() }}
								>
									{anchorNeeded && (
										<BaseSelect.Item
											value={selectedItem}
											className={s.item}
											style={rowStyle(selectedIndex * estimateItemHeight(selectedItem))}
											aria-posinset={selectedIndex + 1}
											aria-setsize={items.length}
										>
											<BaseSelect.ItemIndicator className={s.indicator}>
												<IconCheck size={14} />
											</BaseSelect.ItemIndicator>
											<BaseSelect.ItemText className={s.itemText}>
												{renderItem(selectedItem)}
											</BaseSelect.ItemText>
										</BaseSelect.Item>
									)}
									{virtualItems.map((virtualItem) => {
										const item = items[virtualItem.index];

										if (item === undefined) {
											return null;
										}

										return (
											<BaseSelect.Item
												key={virtualItem.key}
												ref={virtualizer.measureElement}
												data-index={virtualItem.index}
												value={item}
												disabled={isItemDisabled?.(item) ?? false}
												className={s.item}
												style={rowStyle(virtualItem.start)}
												// The mounted window is all the library can count, so honest
												// positions have to be supplied from the full collection.
												aria-posinset={virtualItem.index + 1}
												aria-setsize={items.length}
											>
												<BaseSelect.ItemIndicator className={s.indicator}>
													<IconCheck size={14} />
												</BaseSelect.ItemIndicator>
												<BaseSelect.ItemText className={s.itemText}>
													{renderItem(item)}
												</BaseSelect.ItemText>
											</BaseSelect.Item>
										);
									})}
								</div>
							</BaseSelect.List>
						</div>
					</BaseSelect.Popup>
				</BaseSelect.Positioner>
			</BaseSelect.Portal>
		</BaseSelect.Root>
	);
}

export default BaselineSelect;
