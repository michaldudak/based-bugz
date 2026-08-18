/** Placeholder until the pr-5466 implementation lands (PLAN.md — Phase 9). */

import { comboboxStyles as s } from '@/ds/combobox';
import type { ComboboxProps } from '@/ds/combobox';

export function PendingCombobox<T>(props: ComboboxProps<T>) {
	return (
		<div className={s.control}>
			<input
				className={s.input}
				value={props.query}
				onChange={(event) => props.onQueryChange(event.target.value)}
				placeholder="pr-5466 Combobox is not implemented yet"
				aria-label={props.label}
				disabled
			/>
		</div>
	);
}

export default PendingCombobox;
