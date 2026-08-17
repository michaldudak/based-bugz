import type { CSSProperties, ReactNode } from 'react';
import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import type { CheckboxRootProps } from '@base-ui/react/checkbox';
import { IconCheck } from '@/ds/icons';
import { cx } from '@/ds/utils';
import styles from './Checkbox.module.css';

export interface CheckboxProps extends Omit<
	CheckboxRootProps,
	'className' | 'style' | 'render' | 'children'
> {
	/**
	 * Inline label rendered beside the box. Omit it when the checkbox already sits
	 * inside a `<Field label="…">`, which labels it through Base UI instead.
	 */
	label?: ReactNode;
	className?: string;
	style?: CSSProperties;
}

/** A dash for the mixed state. Local rather than shared: nothing else needs it. */
function IconDash() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			aria-hidden="true"
			focusable="false"
		>
			<path d="M4.5 8h7" />
		</svg>
	);
}

export function Checkbox({ label, className, style, ...props }: CheckboxProps) {
	const box = (
		<BaseCheckbox.Root
			className={cx(styles.box, label == null && className)}
			style={label == null ? style : undefined}
			{...props}
		>
			{/*
			 * Base UI keeps the indicator mounted for both `checked` and `indeterminate`,
			 * so which glyph shows is a CSS question, not a conditional render.
			 */}
			<BaseCheckbox.Indicator className={styles.indicator}>
				<span className={styles.check}>
					<IconCheck size={12} />
				</span>
				<span className={styles.dash}>
					<IconDash />
				</span>
			</BaseCheckbox.Indicator>
		</BaseCheckbox.Root>
	);

	if (label == null) {
		return box;
	}

	return (
		<label className={cx(styles.root, className)} style={style}>
			{box}
			<span className={styles.label}>{label}</span>
		</label>
	);
}
