import { ImplBoundary, useImplRegistry } from '@/ds/registry';
import type { SelectProps } from './types';

/**
 * Resolves the active implementation and hands it the contract, unchanged — the single-choice
 * counterpart of `ds/combobox/Combobox.tsx` and `ds/list/List.tsx`. No select behaviour lives
 * here. Selects over a handful of code-declared options use `StaticSelect` instead of paying for
 * the seam.
 */
export function Select<T>(props: SelectProps<T>) {
	const { Select: Impl } = useImplRegistry();

	// Same single cast as the other seams: the registry stores impls opaquely because
	// `React.lazy` cannot preserve a generic signature.
	const implProps = props as unknown as SelectProps<never>;

	return (
		<ImplBoundary>
			<Impl {...implProps} />
		</ImplBoundary>
	);
}
