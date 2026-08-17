import type { CSSProperties } from 'react';
import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { cx } from '@/ds/utils';
import styles from './Avatar.module.css';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
	/** The person or thing the avatar stands for. Used for the accessible name. */
	name: string;
	/** Override the derived initials, e.g. for scripts where slicing is wrong. */
	initials?: string;
	/** 0–360. Omitted, it is derived from `name`, so the same name is always the same colour. */
	hue?: number;
	size?: AvatarSize;
	/**
	 * Hide from assistive tech. Set this wherever the name is already visible next to
	 * the avatar — otherwise every row in a list announces its owner twice.
	 */
	decorative?: boolean;
	className?: string;
	style?: CSSProperties;
}

/** Stable, seedless hue: the same name always lands on the same colour. */
function hueFromName(name: string): number {
	let hash = 5381;

	for (let index = 0; index < name.length; index += 1) {
		hash = (hash * 33) ^ name.codePointAt(index)!;
	}

	return Math.abs(hash) % 360;
}

function initialsFromName(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);

	if (words.length === 0) {
		return '?';
	}

	// Code points, not char codes: a two-byte first letter must survive.
	const first = [...words[0]!][0] ?? '';
	const last = words.length > 1 ? ([...words[words.length - 1]!][0] ?? '') : '';

	return (first + last).toUpperCase();
}

/**
 * Initials-only avatar. The colour is computed here rather than in CSS, so the
 * stylesheet holds no raw colour value and the hue can vary per instance.
 */
export function Avatar({
	name,
	initials,
	hue,
	size = 'md',
	decorative = false,
	className,
	style,
}: AvatarProps) {
	const resolvedHue = hue ?? hueFromName(name);
	const colors = {
		'--avatar-bg': `light-dark(oklch(0.9 0.05 ${resolvedHue}), oklch(0.33 0.05 ${resolvedHue}))`,
		'--avatar-fg': `light-dark(oklch(0.4 0.09 ${resolvedHue}), oklch(0.9 0.07 ${resolvedHue}))`,
	} as CSSProperties;

	return (
		<BaseAvatar.Root
			className={cx(styles.root, styles[size], className)}
			style={{ ...colors, ...style }}
			aria-hidden={decorative || undefined}
		>
			{/* The initials are shorthand for the name; only one of them should be read out. */}
			<span aria-hidden="true">{initials ?? initialsFromName(name)}</span>
			{!decorative && <span className={styles.srOnly}>{name}</span>}
		</BaseAvatar.Root>
	);
}
