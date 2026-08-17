import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/ds/utils';
import styles from './Badge.module.css';

export type BadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
	children?: ReactNode;
}

/** Status pill. No Base UI counterpart — it is a styled span and nothing more. */
export function Badge({ variant = 'neutral', className, children, ...props }: BadgeProps) {
	return (
		<span className={cx(styles.badge, styles[variant], className)} {...props}>
			{children}
		</span>
	);
}
