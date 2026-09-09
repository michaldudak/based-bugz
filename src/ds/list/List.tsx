import { ImplBoundary, useImplRegistry } from '@/ds/registry';
import type { ListProps } from './types';

/**
 * Resolves the active implementation and hands it the contract, unchanged — the standalone
 * counterpart of `ds/combobox/Combobox.tsx`. No list behaviour lives here.
 */
export function List<T>(props: ListProps<T>) {
	const { List: Impl } = useImplRegistry();

	// Same single cast as the Combobox seam: the registry stores impls opaquely because
	// `React.lazy` cannot preserve a generic signature.
	const implProps = props as unknown as ListProps<never>;

	return (
		<ImplBoundary>
			<Impl {...implProps} />
		</ImplBoundary>
	);
}
