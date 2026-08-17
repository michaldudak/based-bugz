import type { CSSProperties, ReactNode } from 'react';
import { Input as BaseInput } from '@base-ui/react/input';
import type { InputProps as BaseInputProps } from '@base-ui/react/input';
import { cx } from '@/ds/utils';
import styles from './Input.module.css';

export type InputSize = 'sm' | 'md';

/*
 * `size` shadows the native `size` attribute (a character count nobody uses) so the
 * prop name stays consistent with Button. The native attribute is omitted rather
 * than renamed — a synonym would be worse than losing it.
 */
export interface InputProps extends Omit<
	BaseInputProps,
	'className' | 'style' | 'render' | 'size'
> {
	size?: InputSize;
	/** Decorative glyph on the leading edge. Never interactive — it does not take pointer events. */
	leadingIcon?: ReactNode;
	/** Trailing slot: a clear button, a unit, a shortcut hint. */
	trailing?: ReactNode;
	className?: string;
	style?: CSSProperties;
}

/**
 * Text input. The border, height and background live on the `<input>` itself so the
 * global `:focus-visible` ring wraps the visual box, and so `[data-invalid]` — which
 * Base UI puts on the control, not on any wrapper — can style it directly.
 */
export function Input({
	size = 'md',
	leadingIcon,
	trailing,
	className,
	style,
	...props
}: InputProps) {
	return (
		<span className={cx(styles.root, className)} style={style}>
			{leadingIcon != null && (
				<span className={styles.leading} aria-hidden="true">
					{leadingIcon}
				</span>
			)}
			<BaseInput
				className={cx(
					styles.input,
					size === 'sm' && styles.sm,
					leadingIcon != null && styles.hasLeading,
					trailing != null && styles.hasTrailing,
				)}
				{...props}
			/>
			{trailing != null && <span className={styles.trailing}>{trailing}</span>}
		</span>
	);
}
