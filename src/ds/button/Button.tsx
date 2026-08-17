import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '@/ds/spinner';
import { cx } from '@/ds/utils';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant;
	size?: ButtonSize;
	/** Shows a spinner and blocks interaction without collapsing the button's width. */
	loading?: boolean;
	iconOnly?: boolean;
	fullWidth?: boolean;
	children?: ReactNode;
}

export function Button({
	variant = 'default',
	size = 'md',
	loading = false,
	iconOnly = false,
	fullWidth = false,
	disabled,
	className,
	children,
	type = 'button',
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={cx(
				styles.button,
				styles[variant],
				size !== 'md' && styles[size],
				iconOnly && styles.iconOnly,
				fullWidth && styles.fullWidth,
				className,
			)}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			{...props}
		>
			<span className={cx(styles.label, loading && styles.loadingLabel)}>{children}</span>
			{loading && (
				<span className={styles.spinner}>
					<Spinner size={size === 'sm' ? 12 : 14} />
				</span>
			)}
		</button>
	);
}
