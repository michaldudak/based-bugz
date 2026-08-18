/**
 * pr-5466 (mui/base-ui#5466) — the same `<Virtualizer>`, here in its standalone props mode.
 *
 * With `items` of its own it needs no list around it: it is the scroll container, it measures the
 * rows, and it hands each row the accessibility metadata the mounted window would otherwise lie
 * about. That is the whole of this file's virtualization — the rest is the four contract
 * requirements the API does not cover: paging (no end-reached callback, so it is observed from
 * inside the renderer), `resetKey` (scroll back to the top), `measureVersion` (no way to drop the
 * measurement cache short of remounting), and `trailing` (the scrollport's children belong to the
 * virtualizer, so it has to ride inside a row).
 */

import { Virtualizer } from 'base-ui-5466/virtualizer';
import type { VirtualizerActions, VirtualizerItemProps } from 'base-ui-5466/virtualizer';
import { useCallback, useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { listStyles as s } from '@/ds/list';
import type { ListProps, ListRowProps } from '@/ds/list';
import { cx } from '@/ds/utils';
import { EndReachedSentinel } from './EndReached';

const DEFAULT_END_REACHED_THRESHOLD = 12;

/** Roughly the baseline's 10-row overscan at this list's row estimate. */
const OVERSCAN_PX = 400;

/**
 * The virtualizer's scrollport takes no children of its own, so an empty collection has nowhere
 * inside it to put `trailing`. This column holds the two as siblings for that one case. Always
 * rendered: making the wrapper conditional would remount the virtualizer — and lose the scroll
 * position — the moment the load-more sentinel appeared.
 */
const FRAME_STYLE: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	flex: 1,
	minHeight: 0,
};

export function Pr5466List<T>(props: ListProps<T>) {
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

	const actionsRef = useRef<VirtualizerActions | null>(null);

	// A resetKey change is a different result set; keeping the old offset would drop the user into
	// the middle of rows they have not seen. `scrollToIndex` is the only imperative action exposed,
	// so "back to the top" is spelled as "scroll row 0 to the start".
	useEffect(() => {
		actionsRef.current?.scrollToIndex(0, { align: 'start' });
	}, [resetKey]);

	const requestMore = useCallback(() => {
		onEndReached?.();
	}, [onEndReached]);

	const renderRow = useCallback(
		(item: T, index: number, itemProps: VirtualizerItemProps) => {
			// `aria-posinset`, `aria-setsize` and `data-index` for a row the window may not be
			// mounting a moment later. The contract's row props are a subset, so they merge in
			// whole and the renderer spreads them blindly, as it does for every implementation.
			const rowProps: ListRowProps = { ...itemProps };

			return (
				<>
					{renderItem(item, index, rowProps)}
					{/*
					 * The contract puts `trailing` inside the scroll container, after the rows, and the
					 * only thing inside this scroll container is rows — so it rides along in the last
					 * one. Pinning it below the scrollport instead would leave the load-more sentinel
					 * on screen permanently, since another page nearly always exists.
					 */}
					{index === items.length - 1 && trailing}
					{index >= items.length - endReachedThreshold && (
						<EndReachedSentinel onReached={requestMore} />
					)}
				</>
			);
		},
		[renderItem, items.length, endReachedThreshold, requestMore, trailing],
	);

	return (
		<div style={FRAME_STYLE}>
			<Virtualizer
				// The only way to invalidate every cached measurement at once: there is no `measure()`
				// on the actions ref, and a row that is not mounted is never re-observed. Remounting
				// costs the scroll position, which a plain cache drop would have kept.
				key={measureVersion}
				actionsRef={actionsRef}
				items={items}
				getItemKey={itemKey}
				estimatedItemHeight={estimateItemHeight}
				overscanPx={OVERSCAN_PX}
				// Nothing in this list is "active": rows hold real focusable controls rather than a
				// roving highlight, and the app has no index to clamp.
				activeIndex={null}
				className={cx(s.scroller, className)}
				/*
				 * The scroll container is the virtualizer's own `<div>` and every row is wrapped in
				 * one of its generated `<div>`s, so the app cannot produce the `<ul>`/`<li>` pair the
				 * baseline renders. A role is the only lever left, and it is a weaker one: the rows
				 * are still `<li>` elements with a `<div>` for a DOM parent.
				 */
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
				role="list"
				aria-label={ariaLabel}
			>
				{renderRow}
			</Virtualizer>
			{/* No rows to carry it: the one case where `trailing` cannot be inside the scrollport. */}
			{items.length === 0 && trailing}
		</div>
	);
}

export default Pr5466List;
