/**
 * pr-5414 — `<ListVirtualizer>` outside a Base UI list.
 *
 * The component is context-only: it calls `useListVirtualization()`, which throws unless something
 * above it published a `ListVirtualizationHost` and a `ListVirtualizationListState`. Inside the
 * library, `Combobox.List` is that something. Outside it, the app has to be — which is what
 * everything above `Pr5414List` below is: a list root written by a consumer purely so a standalone
 * virtualizer has something to bind to.
 *
 * Two of the three primitives it needs (`ListVirtualizationHostContext`, and the registry factory
 * the host's `registry` field must come from) ship in the tarball but are not part of the package's
 * public API — `internals/virtualization/` is only importable here because this repo's postinstall
 * widens the exports map (PLAN.md — Phase 9). That is the finding this file exists to produce: the
 * standalone story is real, but it is not currently available to anyone who installs the package.
 */

import { ListVirtualizer } from 'base-ui-5414/list-virtualizer';
import {
	ListVirtualizationHostContext,
	ListVirtualizationListStateContext,
} from 'base-ui-5414/internals/virtualization/ListVirtualizationHostContext';
import type {
	ListVirtualizationHost,
	ListVirtualizationListState,
} from 'base-ui-5414/internals/virtualization/ListVirtualizationHostContext';
import { createListVirtualizationRegistry } from 'base-ui-5414/internals/virtualization/ListVirtualizationRegistry';
import {
	createContext,
	use,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useState,
} from 'react';
import type { ContextType, CSSProperties, ReactNode } from 'react';
import { listStyles as s } from '@/ds/list';
import type { ListProps, ListRowProps } from '@/ds/list';
import { cx } from '@/ds/utils';

const DEFAULT_END_REACHED_THRESHOLD = 12;

/**
 * The metadata a row reads. Derived from the host type rather than imported, so the standalone
 * path needs one internals module fewer than it otherwise would.
 */
type ItemMetadata = NonNullable<ContextType<ListVirtualizationHost['virtualItemContext']>>;

/**
 * The channel rows read their index and aria props from. The host owns this identity, so it is
 * ours to create — the library never exports one for consumers.
 */
const VirtualItemContext = createContext<ItemMetadata | undefined>(undefined);

/** The virtualizer owns every child of its scroll container, so `trailing` needs a wrapper. */
const FRAME_STYLE: CSSProperties = {
	display: 'flex',
	flexDirection: 'column',
	flex: 1,
	minHeight: 0,
};

interface VirtualRowProps<T> {
	item: T;
	index: number;
	itemCount: number;
	threshold: number;
	render: (item: T, index: number, rowProps: ListRowProps) => ReactNode;
	onNearEnd?: (() => void) | undefined;
	onEndInView: (inView: boolean) => void;
}

/**
 * One windowed row.
 *
 * It has three jobs, and only the first is rendering. The second is registering itself with the
 * row metadata, which is how the library's development-mode "exactly one item per renderer" check
 * is satisfied — a list root is expected to have an `<Item>` part that does this. The third is
 * reporting proximity to the end of the collection: there is no end-reached callback, and the
 * virtualizer re-windows without re-rendering this file's component, so a mounted row is the only
 * place that can observe it.
 */
function VirtualRow<T>({
	item,
	index,
	itemCount,
	threshold,
	render,
	onNearEnd,
	onEndInView,
}: VirtualRowProps<T>) {
	const metadata = use(VirtualItemContext);
	const registerItem = metadata?.registerItem;

	// Layout, not passive: the check that reads this count runs in the virtualizer's own layout
	// effect, which is a parent of this one.
	useLayoutEffect(() => registerItem?.(), [registerItem]);

	useEffect(() => {
		if (onNearEnd && index >= itemCount - threshold) {
			onNearEnd();
		}
	}, [onNearEnd, index, itemCount, threshold]);

	/*
	 * The last row doubles as the `trailing` gate. The contract wants trailing inside the scroll
	 * container, after the rows — a sentinel you scroll to. This virtualizer owns every child of
	 * its scroll element, so trailing lives outside it, and rendered unconditionally it becomes a
	 * permanently visible bar (with a cursor-paged repository, "has more" is almost always true).
	 * Mount state of the last row is the closest observable stand-in for "the end of the content
	 * is on screen": it includes overscan, exactly like the baseline's in-scroller sentinel, and
	 * when a new page lands this row stops being last and the cleanup hides the bar again.
	 */
	const isLast = index === itemCount - 1;

	useEffect(() => {
		if (!isLast) {
			return undefined;
		}

		onEndInView(true);
		return () => onEndInView(false);
	}, [isLast, onEndInView]);

	/*
	 * `data-index` and the aria pair come from the virtualizer; `role` does not. The virtualizer's
	 * scaffolding sits between the scroll container and the rows, so `<ul>`/`<li>` cannot span it
	 * and the list semantics have to be re-declared with ARIA on both ends.
	 */
	const rowProps = { ...metadata?.props, role: 'listitem' } as unknown as ListRowProps;

	return render(item, index, rowProps);
}

export function Pr5414List<T>(props: ListProps<T>) {
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

	/*
	 * The host is stable by contract — `<Item>` reads it to detect that it is inside a list, so a
	 * changing identity would re-render every row. The registry is per-list and mutable: the
	 * virtualizer writes its imperative handle into it on mount, which is how a list root reaches
	 * a virtualizer it does not render itself.
	 */
	const [host] = useState<ListVirtualizationHost>(() => ({
		componentName: 'List',
		registry: createListVirtualizationRegistry(),
		virtualItemContext: VirtualItemContext,
	}));

	/*
	 * Three of these five fields describe a combobox, not a list. A plain scrolling list has no
	 * active item, never needs every row mounted at once, and has nothing to scroll into view —
	 * but it must still say so, in the shape the virtualizer expects.
	 */
	const listState = useMemo<ListVirtualizationListState>(
		() => ({
			activeIndex: null,
			items,
			renderAllRows: false,
			renderAllRowsRestoreVersion: 0,
			scrollActiveIntoView: false,
		}),
		[items],
	);

	// A resetKey change is a different result set; the registry is the only route to the scroll
	// position, because the scroll element belongs to the virtualizer.
	useEffect(() => {
		host.registry.virtualizer?.resetScroll();
	}, [resetKey, host]);

	const [endInView, setEndInView] = useState(false);

	const renderRow = useCallback(
		(item: T, index: number) => (
			<VirtualRow
				item={item}
				index={index}
				itemCount={items.length}
				threshold={endReachedThreshold}
				render={renderItem}
				onNearEnd={onEndReached}
				onEndInView={setEndInView}
			/>
		),
		[items.length, endReachedThreshold, renderItem, onEndReached],
	);

	return (
		<div style={FRAME_STYLE}>
			<ListVirtualizationHostContext value={host}>
				<ListVirtualizationListStateContext value={listState}>
					<ListVirtualizer<T>
						/*
						 * There is no way to invalidate measurements, so the whole virtualizer is
						 * replaced when every cached height became wrong at once. It costs the
						 * scroll position — the contract asks for a cache drop, not a reset.
						 */
						key={measureVersion}
						className={cx(s.scroller, className)}
						/*
						 * A `<ul>` cannot be used: the virtualizer renders three of its own
						 * elements between this one and the rows, so the tag would be separated
						 * from its `<li>`s. The roles are the only way to keep the list semantics.
						 */
						// eslint-disable-next-line jsx-a11y/prefer-tag-over-role
						role="list"
						aria-label={ariaLabel}
						/*
						 * Both are consumed eagerly — the key callback is mapped over the whole
						 * collection to build the row array, and a per-item estimate function is
						 * materialized into a values array. Both caches key on callback identity, so
						 * the feature layer's inline arrows cost two O(n) passes per render.
						 */
						getItemKey={itemKey}
						estimatedItemHeight={estimateItemHeight}
					>
						{renderRow}
					</ListVirtualizer>
				</ListVirtualizationListStateContext>
			</ListVirtualizationHostContext>
			{endInView ? trailing : null}
		</div>
	);
}

export default Pr5414List;
