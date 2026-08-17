import { cx } from '@/ds/utils';
import styles from './Spinner.module.css';

export interface SpinnerProps {
	size?: number;
	className?: string;
	/** Announce loading to assistive tech. Omit when a parent already labels the busy state. */
	label?: string;
}

export function Spinner({ size = 16, className, label }: SpinnerProps) {
	return (
		<svg
			className={cx(styles.spinner, className)}
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			role={label ? 'status' : undefined}
			aria-label={label}
			aria-hidden={label ? undefined : true}
		>
			<circle className={styles.track} cx="8" cy="8" r="6" />
			<path d="M14 8a6 6 0 0 0-6-6" />
		</svg>
	);
}
