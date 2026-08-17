import type { CSSProperties, ReactNode } from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import type { SwitchRootProps } from '@base-ui/react/switch';
import { cx } from '@/ds/utils';
import styles from './Switch.module.css';

export interface SwitchProps extends Omit<
	SwitchRootProps,
	'className' | 'style' | 'render' | 'children'
> {
	/** Inline label rendered beside the track. Omit inside a `<Field label="…">`. */
	label?: ReactNode;
	className?: string;
	style?: CSSProperties;
}

export function Switch({ label, className, style, ...props }: SwitchProps) {
	const track = (
		<BaseSwitch.Root
			className={cx(styles.track, label == null && className)}
			style={label == null ? style : undefined}
			{...props}
		>
			<BaseSwitch.Thumb className={styles.thumb} />
		</BaseSwitch.Root>
	);

	if (label == null) {
		return track;
	}

	return (
		<label className={cx(styles.root, className)} style={style}>
			{track}
			<span className={styles.label}>{label}</span>
		</label>
	);
}
