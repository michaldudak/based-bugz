/**
 * The List contract — the standalone half of the evaluation.
 *
 * Like the Combobox contract, it references nothing from Base UI or any virtualization library:
 * the baseline satisfies it with TanStack Virtual, pr-5173 with `@mui/x-virtualizer`, pr-5414 by
 * publishing a virtualization host of its own, pr-5466 with `<Virtualizer items>`. It is driven by
 * what the issues list genuinely needs and nothing more (AGENTS.md — evaluation rule 1).
 */

import type { CSSProperties, ReactNode, Ref } from 'react';

/**
 * Props an implementation hands to each row, to be spread onto the row's outermost element.
 * Implementations differ in what they need here — a measurement ref and a positioning transform
 * for approaches where the app owns row placement, possibly nothing for approaches that wrap and
 * position rows themselves. Renderers must spread it blindly and never depend on its contents.
 */
export interface ListRowProps {
	ref?: Ref<never>;
	style?: CSSProperties;
	'data-index'?: number;
}

export interface ListProps<T> {
	items: readonly T[];
	itemKey: (item: T) => string;
	/** Best-effort height before measurement; rows are variable and get measured after mount. */
	estimateItemHeight: (item: T, index: number) => number;
	/** Row rendering comes from the feature layer, so implementations cannot differ on markup. */
	renderItem: (item: T, index: number, rowProps: ListRowProps) => ReactNode;
	/**
	 * Changes when every cached measurement became invalid at once — crossing a layout breakpoint
	 * that reflows rows, for instance. Implementations drop their measurement caches on change.
	 */
	measureVersion?: number | string;
	/**
	 * Identity of the result set. When it changes the implementation scrolls back to the top:
	 * keeping the old offset would drop the user into the middle of rows they have not seen.
	 */
	resetKey?: string;
	/** Called when the viewport nears the end of `items`. The feature layer decides what it means. */
	onEndReached?: () => void;
	/** Rows still below the viewport when `onEndReached` fires. */
	endReachedThreshold?: number;
	/** Rendered inside the scroll container, after the rows — the load-more sentinel lives here. */
	trailing?: ReactNode;
	/** Merged onto the scroll container, which the implementation owns. */
	className?: string;
	'aria-label'?: string;
}
