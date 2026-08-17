/**
 * The Combobox contract.
 *
 * These types reference nothing from Base UI on purpose (AGENTS.md — evaluation rule 1): four
 * different package instances have to satisfy them, and types imported from one build would not
 * be assignable to another. They are also driven by what the app genuinely needs — an
 * implementation that cannot express one of these is a finding, not a reason to soften the type.
 */

import type { ReactNode } from 'react';

export interface ComboboxItemState {
	selected: boolean;
	highlighted: boolean;
	disabled: boolean;
}

/**
 * The flat row model every implementation virtualizes over.
 *
 * Two index spaces exist and must not be confused: `ComboboxRow` positions (what the virtualizer
 * measures and scrolls, group headers included) and `itemIndex` (position among items only, which
 * is what a combobox library's own keyboard navigation counts). Mapping between them is real work
 * and a genuine point of difference between implementations.
 */
export type ComboboxRow<T> =
	| { kind: 'group'; key: string; label: string }
	| { kind: 'item'; key: string; item: T; itemIndex: number }
	| { kind: 'create'; key: string; query: string }
	| { kind: 'loading'; key: string };

export type ComboboxStatus = 'idle' | 'loading' | 'loading-more' | 'error';

export interface ComboboxProps<T> {
	/**
	 * The items to display, already filtered and ordered by the server. Implementations must not
	 * filter: filtering client-side would silently turn the async path into a synchronous one.
	 * When `groupOf` is set, items must arrive grouped — headers are emitted on change of key.
	 */
	items: readonly T[];
	itemKey: (item: T) => string;
	/** Used for the accessible name and for typeahead. */
	itemLabel: (item: T) => string;
	groupOf?: (item: T) => string | undefined;
	isItemDisabled?: (item: T) => boolean;

	/** Always an array. Single-select passes at most one entry, which keeps impls uniform. */
	value: readonly T[];
	onValueChange: (value: readonly T[]) => void;
	multiple?: boolean;

	query: string;
	onQueryChange: (query: string) => void;

	status: ComboboxStatus;
	/** More pages exist. Deliberately separate from `total`, which is often unknown. */
	hasMore?: boolean;
	onEndReached?: () => void;
	onRetry?: () => void;
	/**
	 * Total matching rows, when the server knows it. Frequently `undefined` — an implementation
	 * that needs an item count upfront cannot be used here (AGENTS.md — evaluation rule 4).
	 */
	total?: number;

	/** Row rendering comes from the feature layer, so implementations cannot differ on markup. */
	renderItem: (item: T, state: ComboboxItemState) => ReactNode;
	/**
	 * Best-effort height before measurement. Rows are genuinely variable — a two-line assignee row
	 * is taller than a one-line label row — so this is a starting point, not a promise.
	 */
	estimateItemHeight: (item: T) => number;
	groupHeaderHeight?: number;

	onCreate?: (query: string) => void;
	createLabel?: (query: string) => ReactNode;

	renderChip?: (item: T) => ReactNode;

	placeholder?: string;
	emptyMessage?: ReactNode;
	disabled?: boolean;
	label?: string;
	id?: string;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Width of the popup. `anchor` matches the input; `content` sizes to the widest row. */
	popupWidth?: 'anchor' | 'content';
	className?: string;
}

/**
 * What an implementation is: a component satisfying the contract for any item type. The registry
 * stores these opaquely, because `React.lazy` cannot preserve a generic signature.
 */
export type ComboboxImplComponent = (props: ComboboxProps<never>) => ReactNode;
