import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '@/ds/spinner';
import { cx } from '@/ds/utils';
import styles from './Button.module.css';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonAppearance {
	variant?: ButtonVariant;
	size?: ButtonSize;
	iconOnly?: boolean;
	fullWidth?: boolean;
}

function appearanceClassName(
	{ variant = 'default', size = 'md', iconOnly = false, fullWidth = false }: ButtonAppearance,
	className?: string,
) {
	return cx(
		styles.button,
		styles[variant],
		size !== 'md' && styles[size],
		iconOnly && styles.iconOnly,
		fullWidth && styles.fullWidth,
		className,
	);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonAppearance {
	/** Shows a spinner and blocks interaction without collapsing the button's width. */
	loading?: boolean;
	children?: ReactNode;
}

export function Button({
	variant,
	size = 'md',
	loading = false,
	iconOnly,
	fullWidth,
	disabled,
	className,
	children,
	type = 'button',
	...props
}: ButtonProps) {
	return (
		<button
			type={type}
			className={appearanceClassName({ variant, size, iconOnly, fullWidth }, className)}
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

export interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement>, ButtonAppearance {
	href: string;
	children?: ReactNode;
}

/**
 * A link wearing the button's clothes. It exists because a navigation that looks like a button
 * still has to be an anchor — middle-click, copy address and the browser's own affordances all
 * come from the element, not from the styling. There is no `loading` state: a link has nothing
 * to wait for.
 */
export function ButtonLink({
	variant,
	size,
	iconOnly,
	fullWidth,
	className,
	children,
	...props
}: ButtonLinkProps) {
	return (
		<a
			className={appearanceClassName({ variant, size, iconOnly, fullWidth }, className)}
			{...props}
		>
			<span className={styles.label}>{children}</span>
		</a>
	);
}
