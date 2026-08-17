import type { ReactElement, ReactNode } from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type {
	TooltipPositionerProps as BasePositionerProps,
	TooltipRootProps as BaseRootProps,
} from '@base-ui/react/tooltip';
import { cx } from '@/ds/utils';
import styles from './Tooltip.module.css';

export type TooltipSide = NonNullable<BasePositionerProps['side']>;
export type TooltipAlign = NonNullable<BasePositionerProps['align']>;

export interface TooltipProviderProps {
	children?: ReactNode;
	/** Hover delay before the first tooltip in a group opens. */
	delay?: number;
	closeDelay?: number;
	/** Window in which an adjacent tooltip opens instantly after one closes. */
	timeout?: number;
}

/**
 * Optional at the app root, but wanted: without it every tooltip re-serves its own hover
 * delay, so moving along a toolbar re-waits at each button. Base UI does not throw when it
 * is missing, which makes the shared-delay behaviour easy to lose by accident.
 */
export function TooltipProvider({
	children,
	delay = 400,
	closeDelay,
	timeout,
}: TooltipProviderProps) {
	return (
		<BaseTooltip.Provider delay={delay} closeDelay={closeDelay} timeout={timeout}>
			{children}
		</BaseTooltip.Provider>
	);
}

export interface TooltipProps {
	content: ReactNode;
	/**
	 * The element the tooltip describes. Base UI's trigger renders its own `<button>`, so
	 * this element is composed into it rather than wrapped by it — otherwise a `<Button>`
	 * child would end up nested inside another button.
	 */
	children: ReactElement;
	side?: TooltipSide;
	align?: TooltipAlign;
	sideOffset?: number;
	delay?: number;
	closeDelay?: number;
	/** Suppresses the tooltip without changing the trigger element. */
	disabled?: boolean;
	arrow?: boolean;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: BaseRootProps['onOpenChange'];
	/** Merged onto the popup surface. */
	className?: string;
}

/**
 * Root + Trigger + Portal + Positioner + Popup for the one-line case.
 * Enter/exit is opacity and translate only (AGENTS.md — Appearance).
 */
export function Tooltip({
	content,
	children,
	side = 'top',
	align = 'center',
	sideOffset = 6,
	delay,
	closeDelay,
	disabled,
	arrow = true,
	open,
	defaultOpen,
	onOpenChange,
	className,
}: TooltipProps) {
	return (
		<BaseTooltip.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			disabled={disabled}
		>
			<BaseTooltip.Trigger render={children} delay={delay} closeDelay={closeDelay} />
			<BaseTooltip.Portal>
				<BaseTooltip.Positioner
					className={styles.positioner}
					side={side}
					align={align}
					sideOffset={sideOffset}
					collisionPadding={12}
				>
					<BaseTooltip.Popup className={cx(styles.popup, className)}>
						{arrow && <BaseTooltip.Arrow className={styles.arrow} />}
						{content}
					</BaseTooltip.Popup>
				</BaseTooltip.Positioner>
			</BaseTooltip.Portal>
		</BaseTooltip.Root>
	);
}
