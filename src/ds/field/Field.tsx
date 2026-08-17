import type { ReactNode } from 'react';
import { Field as BaseField } from '@base-ui/react/field';
import { cx } from '@/ds/utils';
import styles from './Field.module.css';

export interface FieldProps {
	/** The control this field labels. Any Base UI control wires itself up automatically. */
	children: ReactNode;
	label?: ReactNode;
	description?: ReactNode;
	/**
	 * An externally supplied error. When set, the field is marked invalid and this
	 * message always shows. When omitted, Base UI's own validation message is used.
	 */
	error?: ReactNode;
	disabled?: boolean;
	name?: string;
	/**
	 * Base UI's own prop name. Set `false` when the control is a button rather than an
	 * input — a `<Select>` trigger, for example — so label hover and label clicks do
	 * not leak onto it. The element switches to a `<span>` to match, which Base UI
	 * requires: `nativeLabel={false}` on an actual `<label>` is a hard error.
	 */
	nativeLabel?: boolean;
	className?: string;
}

/**
 * Label + control + description + error, wired together by Base UI's Field.
 *
 * The error slot is rendered unconditionally: with an `error` prop it is pinned open
 * (`match`), and without one it falls back to Base UI's validation message, so a
 * `required` control still reports itself.
 */
export function Field({
	children,
	label,
	description,
	error,
	disabled,
	name,
	nativeLabel,
	className,
}: FieldProps) {
	const errorProps = error != null ? { match: true as const, children: error } : {};

	return (
		<BaseField.Root
			className={cx(styles.root, className)}
			disabled={disabled}
			name={name}
			invalid={error != null ? true : undefined}
		>
			{label != null && (
				<BaseField.Label
					className={styles.label}
					nativeLabel={nativeLabel}
					render={nativeLabel === false ? <span /> : undefined}
				>
					{label}
				</BaseField.Label>
			)}
			{children}
			{description != null && (
				<BaseField.Description className={styles.description}>{description}</BaseField.Description>
			)}
			<BaseField.Error className={styles.error} {...errorProps} />
		</BaseField.Root>
	);
}
