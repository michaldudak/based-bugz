/**
 * The Select contract — the third evaluated surface.
 *
 * Like the Combobox and List contracts, it references nothing from Base UI or any virtualization
 * library (AGENTS.md — evaluation rule 1): the baseline satisfies it with stable Base UI and
 * TanStack Virtual, pr-5617 with the canary's `<Virtualizer>` inside `Select.List`. It is driven
 * by what the version field genuinely needs and nothing more.
 *
 * What makes this surface worth evaluating separately from the Combobox: there is no query box.
 * The collection is complete and local by the time the popup opens (reference data arriving in
 * one bulk read), so everything the Combobox routes through an async filter — typeahead, deep
 * scroll-to-selected on open, Home/End across the whole collection — has to work against rows
 * that have never been mounted.
 */

import type { ReactNode } from 'react';

export type SelectSize = 'sm' | 'md';

export interface SelectProps<T> {
	/** Every option, already ordered. A select popup has no paging: the list arrives whole. */
	items: readonly T[];
	itemKey: (item: T) => string;
	/** Accessible name of an option, and what keyboard typeahead matches on. */
	itemLabel: (item: T) => string;
	isItemDisabled?: (item: T) => boolean;

	value: T | null;
	onValueChange: (value: T | null) => void;

	/**
	 * Row content, from the feature layer so implementations cannot differ on markup. Selection
	 * and highlight are styled off the implementation's own state attributes, so no state object
	 * is passed here.
	 */
	renderItem: (item: T) => ReactNode;
	/** Echo of the selected item inside the trigger. Falls back to `itemLabel`. */
	renderValue?: (item: T) => ReactNode;
	/** Best-effort height before measurement, per item — a promise-free starting point. */
	estimateItemHeight: (item: T) => number;

	placeholder?: ReactNode;
	disabled?: boolean;
	required?: boolean;
	/** Form submission name, passed through to the implementation's root. */
	name?: string;
	/** Lands on the trigger, so an external `<label htmlFor>` can name it across packages. */
	id?: string;
	/** Fallback accessible name when no external label points at the trigger. */
	label?: string;
	size?: SelectSize;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** Merged onto the trigger. */
	className?: string;
}

/**
 * What an implementation is: a component satisfying the contract for any item type. The registry
 * stores these opaquely, because `React.lazy` cannot preserve a generic signature.
 */
export type SelectImplComponent = (props: SelectProps<never>) => ReactNode;
