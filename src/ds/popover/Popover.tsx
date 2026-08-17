import type { ReactElement, ReactNode } from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';
import type { PopoverPositionerProps, PopoverRootProps } from '@base-ui/react/popover';
import { cx } from '@/ds/utils';
import styles from './Popover.module.css';

export type PopoverSide = NonNullable<PopoverPositionerProps['side']>;
export type PopoverAlign = NonNullable<PopoverPositionerProps['align']>;

export interface PopoverProps {
	/**
	 * The element that opens the popover. Base UI's trigger has to be a sibling of the
	 * portal inside `Popover.Root`, so a wrapper that owns Root + Portal + Positioner +
	 * Popup can only receive it as a prop.
	 */
	trigger: ReactElement;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: PopoverRootProps['onOpenChange'];
	modal?: PopoverRootProps['modal'];
	side?: PopoverSide;
	align?: PopoverAlign;
	sideOffset?: number;
	alignOffset?: number;
	/** `openOnHover` lives on Base UI's trigger, so it is re-exposed here. */
	openOnHover?: boolean;
	arrow?: boolean;
	/** Merged onto the popup surface. */
	className?: string;
	children?: ReactNode;
}

/**
 * Root + Portal + Positioner + Popup, pre-assembled. `side` / `align` / `sideOffset` keep
 * Base UI's names and meaning; everything else about positioning is handled here.
 *
 * Enter/exit is opacity and translate only — never scale (AGENTS.md — Appearance).
 */
export function Popover({
	trigger,
	open,
	defaultOpen,
	onOpenChange,
	modal,
	side = 'bottom',
	align = 'center',
	sideOffset = 6,
	alignOffset = 0,
	openOnHover = false,
	arrow = false,
	className,
	children,
}: PopoverProps) {
	return (
		<BasePopover.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			modal={modal}
		>
			<BasePopover.Trigger render={trigger} openOnHover={openOnHover} />
			<BasePopover.Portal>
				<BasePopover.Positioner
					className={styles.positioner}
					side={side}
					align={align}
					sideOffset={sideOffset}
					alignOffset={alignOffset}
					collisionPadding={12}
				>
					<BasePopover.Popup className={cx(styles.popup, className)}>
						{arrow && <BasePopover.Arrow className={styles.arrow} />}
						{children}
					</BasePopover.Popup>
				</BasePopover.Positioner>
			</BasePopover.Portal>
		</BasePopover.Root>
	);
}
