import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '@/ds/utils';
import styles from './Kbd.module.css';

export interface KbdProps extends HTMLAttributes<HTMLElement> {
	children?: ReactNode;
}

/** Keyboard shortcut hint: `<Kbd>⌘K</Kbd>`. */
export function Kbd({ className, children, ...props }: KbdProps) {
	return (
		<kbd className={cx(styles.kbd, className)} {...props}>
			{children}
		</kbd>
	);
}
