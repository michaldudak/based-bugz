/**
 * Baseline List — TanStack Virtual, exactly the code the issues list shipped with before the
 * standalone surface joined the evaluation. This is the control; the code is a relocation, not a
 * rewrite.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { listStyles as s } from '@/ds/list';
import type { ListProps } from '@/ds/list';
import { cx } from '@/ds/utils';

const DEFAULT_END_REACHED_THRESHOLD = 12;

function rowStyle(start: number): CSSProperties {
	return {
		position: 'absolute',
		top: 0,
		insetInlineStart: 0,
		width: '100%',
		transform: `translateY(${start}px)`,
	};
}

export function BaselineList<T>(props: ListProps<T>) {
	const {
		items,
		itemKey,
		estimateItemHeight,
		renderItem,
		measureVersion,
		resetKey,
		onEndReached,
		endReachedThreshold = DEFAULT_END_REACHED_THRESHOLD,
		trailing,
		className,
		'aria-label': ariaLabel,
	} = props;

	const scrollRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: (index) => {
			const item = items[index];
			return item === undefined ? 44 : estimateItemHeight(item, index);
		},
		getItemKey: (index) => {
			const item = items[index];
			return item === undefined ? index : itemKey(item);
		},
		overscan: 10,
	});

	// A measureVersion change means every cached measurement was taken under a layout that no
	// longer exists (breakpoint crossing), so drop the lot.
	useEffect(() => {
		virtualizer.measure();
	}, [measureVersion, virtualizer]);

	// A resetKey change is a different result set; keeping the old scroll offset would drop the
	// user into the middle of rows they have not seen.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [resetKey]);

	const virtualItems = virtualizer.getVirtualItems();
	const lastVisibleIndex = virtualItems[virtualItems.length - 1]?.index ?? -1;

	useEffect(() => {
		if (onEndReached && lastVisibleIndex >= items.length - endReachedThreshold) {
			onEndReached();
		}
	}, [onEndReached, lastVisibleIndex, items.length, endReachedThreshold]);

	return (
		<div className={cx(s.scroller, className)} ref={scrollRef}>
			<ul
				className={s.viewport}
				style={{ height: virtualizer.getTotalSize() }}
				aria-label={ariaLabel}
			>
				{virtualItems.map((virtualItem) => {
					const item = items[virtualItem.index];

					if (item === undefined) {
						return null;
					}

					return renderItem(item, virtualItem.index, {
						ref: virtualizer.measureElement as never,
						style: rowStyle(virtualItem.start),
						'data-index': virtualItem.index,
					});
				})}
			</ul>
			{trailing}
		</div>
	);
}

export default BaselineList;
