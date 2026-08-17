import type { CSSProperties } from 'react';
import { Separator as BaseSeparator } from '@base-ui/react/separator';
import type { SeparatorProps as BaseSeparatorProps } from '@base-ui/react/separator';
import { cx } from '@/ds/utils';
import styles from './Separator.module.css';

export interface SeparatorProps extends Omit<BaseSeparatorProps, 'className' | 'style' | 'render'> {
	className?: string;
	style?: CSSProperties;
}

/** A 1px rule. `orientation` drives both the ARIA role and the axis, via `data-orientation`. */
export function Separator({ className, ...props }: SeparatorProps) {
	return <BaseSeparator className={cx(styles.separator, className)} {...props} />;
}
