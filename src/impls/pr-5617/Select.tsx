/**
 * pr-5617 — the `<Virtualizer>` in its context-binding mode, inside `Select.List`. This is the
 * surface the successor PR added on top of #5466: `Select.Root` takes the collection via `items`
 * and the virtualizer, dropped into the list with no `items` of its own, windows that collection
 * and follows the root's highlight.
 *
 * What the app never writes here: no scroll element wiring, no scroll-to-selected-on-open bridge,
 * no typeahead handling — the root navigates the full collection (`isItemDisabled` is on Root for
 * exactly that reason: keyboard navigation must skip disabled rows it has never mounted) and the
 * virtualizer scrolls wherever the highlight goes, mounted or not.
 */

import { Select as BaseSelect } from 'base-ui-5617/select';
import { Virtualizer } from 'base-ui-5617/virtualizer';
import type { CSSProperties } from 'react';
import { IconCheck, IconChevronDown } from '@/ds/icons';
import { selectStyles as s } from '@/ds/select';
import type { SelectProps } from '@/ds/select';
import { cx } from '@/ds/utils';

/**
 * Same pixel budget as the combobox impl: roughly eight rows of overscan at this popup's row
 * height, where the baseline reasons in row counts.
 */
const OVERSCAN_PX = 240;

/**
 * `Select.List` is the listbox but no longer the scroll container — the virtualizer inside it is.
 * The flex chain matters: without it the list overflows the popup instead of bounding the
 * scrollport, the virtualizer's viewport becomes the whole collection, and every row mounts —
 * silently, since a fully mounted list still looks correct.
 */
const LIST_STYLE: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	flex: 1,
	minHeight: 0,
};

/**
 * The scrollport sizes to the whole collection and lets the popup's `max-height` cap it — the
 * same `--total-size` contract as the combobox impl, breaking the same feedback loop between the
 * rendered window and the height that decides what to render (see `pr-5617/Combobox.tsx`).
 */
const SCROLLER_STYLE: CSSProperties = {
	flex: '0 1 auto',
	height: 'var(--total-size, auto)',
};

export function Pr5617Select<T>(props: SelectProps<T>) {
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

	return (
		<BaseSelect.Root<T>
			items={items as T[]}
			value={value}
			onValueChange={(next) => onValueChange(next)}
			isItemEqualToValue={(a, b) => itemKey(a) === itemKey(b)}
			// Root-level on purpose: keyboard navigation and typeahead must skip disabled items the
			// virtualizer has never mounted, which a `disabled` prop on a windowed Item cannot tell it.
			isItemDisabled={isItemDisabled}
			itemToStringLabel={itemLabel}
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
				<BaseSelect.Positioner className={s.positioner} sideOffset={4} align="start">
					<BaseSelect.Popup className={s.popup}>
						<BaseSelect.List style={LIST_STYLE}>
							<Virtualizer<T>
								getItemKey={itemKey}
								estimatedItemHeight={estimateItemHeight}
								overscanPx={OVERSCAN_PX}
								// The virtualizer is the scroll container, so the shared scrollport class
								// belongs to it rather than to a div of ours.
								className={s.list}
								style={SCROLLER_STYLE}
								// Options are exposed as children of the listbox; this scrollport is not a
								// step in the accessibility tree.
								role="presentation"
							>
								{(item) => (
									<BaseSelect.Item
										value={item}
										disabled={isItemDisabled?.(item) ?? false}
										className={s.item}
									>
										<BaseSelect.ItemIndicator className={s.indicator}>
											<IconCheck size={14} />
										</BaseSelect.ItemIndicator>
										<BaseSelect.ItemText className={s.itemText}>
											{renderItem(item)}
										</BaseSelect.ItemText>
									</BaseSelect.Item>
								)}
							</Virtualizer>
						</BaseSelect.List>
					</BaseSelect.Popup>
				</BaseSelect.Positioner>
			</BaseSelect.Portal>
		</BaseSelect.Root>
	);
}

export default Pr5617Select;
