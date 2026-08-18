/**
 * pr-5173 List — scaffolding, not evidence.
 *
 * #5173 exposes no standalone virtualizer: everything it adds lives behind `<Combobox.Virtualizer>`
 * and the `internals/virtualization/` modules the package does not export. So the issues list is
 * wired straight to `@mui/x-virtualizer`, the same engine the PR's part drives internally, at the
 * layer the PR leaves to the app. The line count here measures that engine's raw ergonomics, not
 * what #5173's API costs (PLAN.md — Phase 9).
 *
 * The wiring mirrors what `ListVirtualizerAdapter`/`ListVirtualizer` do inside the canary, reduced
 * to what a flat, top-anchored list needs: `LayoutList` in its default uncontrolled mode, one
 * `RowEntry` per item, `getRowHeight: 'auto'` so every row is measured, and `observeRowHeight` per
 * mounted row. Row placement is the engine's flow spacer — `offsetTop` as the viewport's block
 * start padding — so rows stay in normal flow and `ListRowProps` carries only a measurement ref.
 */

import { Dimensions, LayoutList, Virtualization, useVirtualizer } from '@mui/x-virtualizer';
import type { RowEntry } from '@mui/x-virtualizer';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { listStyles as s } from '@/ds/list';
import type { ListProps, ListRowProps } from '@/ds/list';
import { cx } from '@/ds/utils';
import { useStableCallback } from './stable';

const DEFAULT_END_REACHED_THRESHOLD = 12;

/** Pixels rendered before and after the viewport. Matches the baseline's ~10 rows of overscan. */
const ROW_BUFFER_PX = 480;

/** Only used before the first item exists; every real estimate comes from the contract. */
const FALLBACK_ROW_HEIGHT = 44;

type VirtualizerApi = ReturnType<typeof useVirtualizer>['api'];

interface RowModel<T> {
	item: T;
	index: number;
}

/**
 * One row. Exists as a component rather than an inline element because the engine's measurement is
 * incremental: a row has to register its element with the ResizeObserver and push the measured
 * boundary forward, both of which are effects. It renders no DOM of its own — the contract's row
 * props go straight onto the feature layer's element.
 */
const ListRow = memo(function ListRow<T>(props: {
	apiRef: { current: VirtualizerApi | null };
	rowId: string;
	index: number;
	item: T;
	renderItem: (item: T, index: number, rowProps: ListRowProps) => ReactNode;
}) {
	const { apiRef, rowId, index, item, renderItem } = props;
	const cleanupRef = useRef<(() => void) | undefined>(undefined);

	const measureRef = useCallback(
		(element: HTMLElement | null) => {
			cleanupRef.current?.();
			cleanupRef.current =
				element === null ? undefined : apiRef.current?.rowsMeta.observeRowHeight(element, rowId);
		},
		[apiRef, rowId],
	);

	useLayoutEffect(() => {
		apiRef.current?.rowsMeta.setLastMeasuredRowIndex(index);
	}, [apiRef, index]);

	return renderItem(item, index, { ref: measureRef as never, 'data-index': index });
}) as <T>(props: {
	apiRef: { current: VirtualizerApi | null };
	rowId: string;
	index: number;
	item: T;
	renderItem: (item: T, index: number, rowProps: ListRowProps) => ReactNode;
}) => ReactNode;

export function Pr5173List<T>(props: ListProps<T>) {
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

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const apiRef = useRef<VirtualizerApi | null>(null);

	// The engine populates both refs itself through `containerProps.ref`; the instance only has to
	// outlive the renders, so it is created once.
	const layoutRef = useRef<LayoutList | null>(null);
	layoutRef.current ??= new LayoutList({ scroller: scrollRef, container: containerRef });
	const layout = layoutRef.current;

	const getItemKey = useStableCallback(itemKey);
	const getEstimate = useStableCallback(estimateItemHeight);
	const getRenderItem = useStableCallback(renderItem);

	const rows = useMemo(
		() => items.map((item, index) => ({ id: getItemKey(item), model: { item, index } })),
		[items, getItemKey],
	);

	const range = useMemo(
		() => (rows.length === 0 ? null : { firstRowIndex: 0, lastRowIndex: rows.length }),
		[rows.length],
	);

	const getRowHeight = useCallback(() => 'auto' as const, []);

	const getEstimatedRowHeight = useCallback(
		(row: RowEntry) => {
			const model = row.model as RowModel<T>;
			return getEstimate(model.item, model.index);
		},
		[getEstimate],
	);

	const renderRow = useCallback(
		(params: { id: unknown; model: RowModel<T>; rowIndex: number }) => (
			<ListRow<T>
				key={String(params.id)}
				apiRef={apiRef}
				rowId={String(params.id)}
				index={params.rowIndex}
				item={params.model.item}
				renderItem={getRenderItem}
			/>
		),
		[getRenderItem],
	);

	const firstItem = items[0];

	const virtualizer = useVirtualizer({
		layout,
		// The engine's scroll threshold, not a row height: every row reports `auto` and is measured.
		dimensions: {
			rowHeight: firstItem === undefined ? FALLBACK_ROW_HEIGHT : estimateItemHeight(firstItem, 0),
		},
		virtualization: { rowBufferPx: ROW_BUFFER_PX },
		rows,
		range,
		rowCount: rows.length,
		getRowHeight,
		getEstimatedRowHeight,
		renderRow: renderRow as never,
	});

	apiRef.current = virtualizer.api;

	const containerProps = virtualizer.store.use(LayoutList.selectors.containerProps);
	const contentHeight = virtualizer.store.use(Dimensions.selectors.contentHeight);
	const offsetTop = virtualizer.store.use(Virtualization.selectors.offsetTop);
	const renderContext = virtualizer.store.use(Virtualization.selectors.renderContext);

	/*
	 * Every cached measurement was taken under a layout that no longer exists, so drop the lot and
	 * rebuild the geometry from estimates. Reached through the ref rather than `virtualizer.api`:
	 * the engine returns a fresh api object on every render, so depending on it would re-run this
	 * on every commit — and this effect causes a commit.
	 */
	useEffect(() => {
		apiRef.current?.rowsMeta.resetRowHeights();
		apiRef.current?.forceUpdateRenderContext();
	}, [measureVersion]);

	// A different result set: keeping the old offset would drop the user into the middle of rows
	// they have not seen.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [resetKey]);

	const lastRenderedIndex = renderContext.lastRowIndex - 1;

	useEffect(() => {
		if (onEndReached && lastRenderedIndex >= items.length - endReachedThreshold) {
			onEndReached();
		}
	}, [onEndReached, lastRenderedIndex, items.length, endReachedThreshold]);

	const { ref: mergedRef, style: containerStyle, ...restContainerProps } = containerProps;

	/*
	 * `offsetTop` as block-start padding rather than a spacer element: the rows are `<li>`s and a
	 * sizing `<div>` cannot sit between them. `contentHeight` is the border-box height, so the
	 * trailing sentinel below lands at the end of the scrollable content at every scroll position.
	 */
	const viewportStyle: CSSProperties = {
		height: contentHeight,
		paddingTop: offsetTop,
	};

	return (
		<div
			{...restContainerProps}
			ref={mergedRef}
			className={cx(s.scroller, className)}
			style={containerStyle}
		>
			<ul className={s.viewport} style={viewportStyle} aria-label={ariaLabel}>
				{virtualizer.api.getters.getRows()}
			</ul>
			{trailing}
		</div>
	);
}

export default Pr5173List;
