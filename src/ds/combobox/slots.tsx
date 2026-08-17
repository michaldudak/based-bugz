/**
 * Plain-DOM slots shared by every Combobox implementation.
 *
 * Nothing here renders a Base UI part. Parts from different aliased builds carry distinct React
 * context objects, so a shared shell that rendered them would fail to connect an implementation's
 * Root to this module's Input — or, worse, half-connect (AGENTS.md — evaluation rule 2).
 */

import type { ReactNode } from 'react';
import { IconPlus, IconWarning } from '@/ds/icons';
import { Spinner } from '@/ds/spinner';
import { cx } from '@/ds/utils';
import styles from './Combobox.module.css';

export { styles as comboboxStyles };

export function ComboboxGroupHeader({ label }: { label: string }) {
	return (
		<div className={styles.groupHeader} aria-hidden="true">
			{label}
		</div>
	);
}

export function ComboboxLoadingRow({ label = 'Loading more…' }: { label?: string }) {
	return (
		<div className={styles.status}>
			<Spinner size={14} />
			{label}
		</div>
	);
}

export function ComboboxEmpty({ children }: { children?: ReactNode }) {
	return <div className={styles.empty}>{children ?? 'No matches.'}</div>;
}

export function ComboboxErrorState({ onRetry }: { onRetry?: () => void }) {
	return (
		<div className={styles.errorState}>
			<IconWarning />
			<span>Could not load results.</span>
			{onRetry && (
				<button type="button" className={styles.createRow} onClick={onRetry}>
					Try again
				</button>
			)}
		</div>
	);
}

export function ComboboxCreateContent({ query, label }: { query: string; label?: ReactNode }) {
	return (
		<>
			<IconPlus />
			<span>{label ?? <>Create “{query}”</>}</span>
		</>
	);
}

export function ComboboxChip({ label, onRemove }: { label: ReactNode; onRemove?: () => void }) {
	return (
		<span className={styles.chip}>
			<span className={styles.chipLabel}>{label}</span>
			{onRemove && (
				<button
					type="button"
					className={styles.chipRemove}
					onClick={onRemove}
					aria-label={`Remove ${typeof label === 'string' ? label : 'selection'}`}
				>
					×
				</button>
			)}
		</span>
	);
}

/**
 * Row count footer. Renders "of many" when the server declined to count, which is the case the
 * whole contract is shaped around.
 */
export function ComboboxFooter({ shown, total }: { shown: number; total?: number }) {
	return (
		<div className={cx(styles.footer)}>
			{total === undefined
				? `${shown.toLocaleString()} shown`
				: `${shown.toLocaleString()} of ${total.toLocaleString()}`}
		</div>
	);
}
