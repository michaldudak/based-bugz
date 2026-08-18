import { ImplBoundary, useImplRegistry } from '@/ds/registry';
import type { ComboboxProps } from './types';

/**
 * Resolves the active virtualization implementation and hands it the contract, unchanged.
 *
 * This component deliberately contains no combobox behaviour: everything visible is either shared
 * CSS from `Combobox.module.css`, a slot from `slots.tsx`, or a row renderer passed down by the
 * feature layer. What differs between implementations is scroll container, measurement and index
 * maths — nothing else (AGENTS.md — evaluation rule 2).
 */
export function Combobox<T>(props: ComboboxProps<T>) {
	const { Combobox: Impl } = useImplRegistry();

	// The single cast in the system. `ComboboxProps<T>` uses T both co- and contravariantly, so it
	// cannot be assigned to the registry's opaque element type without one.
	const implProps = props as unknown as ComboboxProps<never>;

	return (
		<ImplBoundary>
			<Impl {...implProps} />
		</ImplBoundary>
	);
}
