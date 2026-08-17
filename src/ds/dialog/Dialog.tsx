import { Children, isValidElement, type ReactNode } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import type { DialogPopupProps, DialogRootProps } from '@base-ui/react/dialog';
import { Button, type ButtonProps } from '@/ds/button';
import { IconClose } from '@/ds/icons';
import { cx } from '@/ds/utils';
import styles from './Dialog.module.css';

export type DialogSize = 'sm' | 'md' | 'lg';

/**
 * The button-shaped half of a trigger/close. Base UI's `Trigger` and `Close` render
 * their own `<button>`, so composing them with `@/ds/button` means handing the element
 * to Base UI's `render` prop — the one place in `ds/` where `render` is used, and it is
 * never re-exposed to call sites (AGENTS.md — Design system conventions).
 */
interface DialogButtonProps {
	variant?: ButtonProps['variant'];
	size?: ButtonProps['size'];
	iconOnly?: boolean;
	fullWidth?: boolean;
	disabled?: boolean;
	id?: string;
	className?: string;
	children?: ReactNode;
	'aria-label'?: string;
}

export interface DialogTriggerProps extends DialogButtonProps {}

/**
 * Opens the dialog. Must be a direct child of `<Dialog>`: Base UI requires the trigger to
 * be a sibling of the portal inside `Dialog.Root`, so `<Dialog>` lifts these out of the
 * popup rather than rendering them with the rest of its children.
 */
export function DialogTrigger({
	variant,
	size,
	iconOnly,
	fullWidth,
	disabled,
	id,
	className,
	children,
	...props
}: DialogTriggerProps) {
	return (
		<BaseDialog.Trigger
			id={id}
			disabled={disabled}
			className={className}
			render={<Button variant={variant} size={size} iconOnly={iconOnly} fullWidth={fullWidth} />}
			{...props}
		>
			{children}
		</BaseDialog.Trigger>
	);
}

export interface DialogCloseProps extends DialogButtonProps {}

/** Closes the dialog. Styled as a `@/ds/button`, so it drops straight into `Dialog.Actions`. */
export function DialogClose({
	variant = 'default',
	size,
	iconOnly,
	fullWidth,
	disabled,
	id,
	className,
	children,
	...props
}: DialogCloseProps) {
	return (
		<BaseDialog.Close
			id={id}
			disabled={disabled}
			className={className}
			render={<Button variant={variant} size={size} iconOnly={iconOnly} fullWidth={fullWidth} />}
			{...props}
		>
			{children}
		</BaseDialog.Close>
	);
}

export interface DialogTitleProps {
	className?: string;
	children?: ReactNode;
}

export function DialogTitle({ className, children }: DialogTitleProps) {
	return <BaseDialog.Title className={cx(styles.title, className)}>{children}</BaseDialog.Title>;
}

export interface DialogDescriptionProps {
	className?: string;
	children?: ReactNode;
}

export function DialogDescription({ className, children }: DialogDescriptionProps) {
	return (
		<BaseDialog.Description className={cx(styles.description, className)}>
			{children}
		</BaseDialog.Description>
	);
}

export interface DialogActionsProps {
	className?: string;
	children?: ReactNode;
}

/** Footer row. Plain DOM — Base UI has no part for it. */
export function DialogActions({ className, children }: DialogActionsProps) {
	return <div className={cx(styles.actions, className)}>{children}</div>;
}

export interface DialogProps {
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: DialogRootProps['onOpenChange'];
	modal?: DialogRootProps['modal'];
	/** Popup width on viewports wider than the bottom-sheet breakpoint. */
	size?: DialogSize;
	/** Renders the dismiss button in the popup's top corner. */
	showCloseButton?: boolean;
	initialFocus?: DialogPopupProps['initialFocus'];
	finalFocus?: DialogPopupProps['finalFocus'];
	/** Merged onto the popup surface. */
	className?: string;
	children?: ReactNode;
}

function isTrigger(node: ReactNode): boolean {
	return isValidElement(node) && node.type === DialogTrigger;
}

/**
 * Root + Portal + Backdrop + Viewport + Popup in one component. Call sites write content,
 * never positioning.
 *
 * Enter/exit is opacity and translate only — a popup that scale-animates corrupts the row
 * heights any virtualizer inside it measures (AGENTS.md — Appearance).
 */
function DialogRoot({
	open,
	defaultOpen,
	onOpenChange,
	modal,
	size = 'md',
	showCloseButton = true,
	initialFocus,
	finalFocus,
	className,
	children,
}: DialogProps) {
	const nodes = Children.toArray(children);
	const triggers = nodes.filter((node) => isTrigger(node));
	const content = nodes.filter((node) => !isTrigger(node));

	return (
		<BaseDialog.Root
			open={open}
			defaultOpen={defaultOpen}
			onOpenChange={onOpenChange}
			modal={modal}
		>
			{triggers}
			<BaseDialog.Portal>
				<BaseDialog.Backdrop className={styles.backdrop} />
				<BaseDialog.Viewport className={styles.viewport}>
					<BaseDialog.Popup
						className={cx(styles.popup, styles[size], className)}
						initialFocus={initialFocus}
						finalFocus={finalFocus}
					>
						{content}
						{showCloseButton && (
							<BaseDialog.Close
								className={styles.dismiss}
								aria-label="Close"
								render={<Button variant="ghost" size="sm" iconOnly />}
							>
								<IconClose />
							</BaseDialog.Close>
						)}
					</BaseDialog.Popup>
				</BaseDialog.Viewport>
			</BaseDialog.Portal>
		</BaseDialog.Root>
	);
}

export const Dialog = Object.assign(DialogRoot, {
	Trigger: DialogTrigger,
	Title: DialogTitle,
	Description: DialogDescription,
	Actions: DialogActions,
	Close: DialogClose,
});
