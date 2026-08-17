/**
 * The implementation seam.
 *
 * `ds/` never imports `impls/` — the app supplies the registry instead. That keeps the layer rule
 * absolute (and lint-enforceable) while still letting the combobox resolve an implementation at
 * runtime from `?impl=`.
 */

import { Suspense, createContext, use } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Spinner } from '@/ds/spinner';
import type { ComboboxProps } from './types';
import styles from './Combobox.module.css';

/** Implementations are stored opaquely: `React.lazy` cannot carry a generic signature. */
export type OpaqueComboboxImpl = ComponentType<ComboboxProps<never>>;

export interface ComboboxImplRegistry {
	/** The implementation resolved for this run, from `?impl=`. */
	active: OpaqueComboboxImpl;
	/** Name of the active implementation, for labelling measurements. */
	activeName: string;
	/** Every implementation available in this build. */
	available: readonly string[];
}

const RegistryContext = createContext<ComboboxImplRegistry | null>(null);

export function ComboboxImplProvider({
	registry,
	children,
}: {
	registry: ComboboxImplRegistry;
	children: ReactNode;
}) {
	return <RegistryContext value={registry}>{children}</RegistryContext>;
}

export function useComboboxImpl(): ComboboxImplRegistry {
	const registry = use(RegistryContext);

	if (registry === null) {
		throw new Error(
			'<Combobox> needs a <ComboboxImplProvider>. The app owns the implementation registry so ' +
				'that ds/ never imports impls/ (AGENTS.md — Import rules).',
		);
	}

	return registry;
}

export function ComboboxImplFallback() {
	return (
		<div className={styles.status}>
			<Spinner size={14} label="Loading implementation" />
		</div>
	);
}

export function ComboboxImplBoundary({ children }: { children: ReactNode }) {
	return <Suspense fallback={<ComboboxImplFallback />}>{children}</Suspense>;
}
