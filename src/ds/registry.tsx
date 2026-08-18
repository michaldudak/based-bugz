/**
 * The implementation seam, for both evaluated surfaces.
 *
 * `ds/` never imports `impls/` — the app supplies the registry instead. That keeps the layer rule
 * absolute (and lint-enforceable) while still letting `<Combobox>` and `<List>` resolve an
 * implementation at runtime from `?impl=`. Each implementation provides both components; switching
 * `?impl=` swaps the whole family, so you experience one PR's approach throughout the app rather
 * than a mixture.
 */

import { Suspense, createContext, use } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Spinner } from '@/ds/spinner';
import type { ComboboxProps } from './combobox/types';
import type { ListProps } from './list/types';

/** Implementations are stored opaquely: `React.lazy` cannot carry a generic signature. */
export type OpaqueComboboxImpl = ComponentType<ComboboxProps<never>>;
export type OpaqueListImpl = ComponentType<ListProps<never>>;

export interface ImplRegistry {
	/** Name of the implementation resolved from `?impl=`, for labelling measurements. */
	activeName: string;
	/** Every implementation available in this build. */
	available: readonly string[];
	Combobox: OpaqueComboboxImpl;
	List: OpaqueListImpl;
}

const RegistryContext = createContext<ImplRegistry | null>(null);

export function ImplProvider({
	registry,
	children,
}: {
	registry: ImplRegistry;
	children: ReactNode;
}) {
	return <RegistryContext value={registry}>{children}</RegistryContext>;
}

export function useImplRegistry(): ImplRegistry {
	const registry = use(RegistryContext);

	if (registry === null) {
		throw new Error(
			'No <ImplProvider> above this component. The app owns the implementation registry so ' +
				'that ds/ never imports impls/ (AGENTS.md — Import rules).',
		);
	}

	return registry;
}

export function ImplFallback() {
	return (
		<div style={{ display: 'flex', justifyContent: 'center', padding: '0.75rem' }}>
			<Spinner size={14} label="Loading implementation" />
		</div>
	);
}

export function ImplBoundary({ children }: { children: ReactNode }) {
	return <Suspense fallback={<ImplFallback />}>{children}</Suspense>;
}
