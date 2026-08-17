import type { ReactElement, ReactNode } from 'react';
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import type { AlertDialogRootProps } from '@base-ui/react/alert-dialog';
import { Button } from '@/ds/button';
import { cx } from '@/ds/utils';
import styles from './AlertDialog.module.css';

export type AlertDialogVariant = 'default' | 'danger';

export interface AlertDialogProps {
	/**
	 * The element that opens the dialog. Base UI requires the trigger to sit inside
	 * `AlertDialog.Root` next to the portal, so it arrives as a prop rather than as a child.
	 */
	trigger?: ReactElement;
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: AlertDialogRootProps['onOpenChange'];
	title: ReactNode;
	description?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	onConfirm?: () => void;
	/** `danger` paints the confirm button destructive and tints the surface. */
	variant?: AlertDialogVariant;
	/** Blocks confirmation while the action is in flight. */
	loading?: boolean;
	/** Merged onto the popup surface. */
	className?: string;
	/** Extra body content rendered under the description. */
	children?: ReactNode;
}

/**
 * The confirm-or-cancel case, collapsed to props. Root + Portal + Backdrop + Viewport +
 * Popup + Title + Description + both buttons are all pre-assembled; a call site that needs
 * more structure than this wants `@/ds/dialog`, not an escape hatch here.
 */
export function AlertDialog({
	trigger,
	open,
	defaultOpen,
	onOpenChange,
	title,
	description,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	onConfirm,
	variant = 'default',
	loading = false,
	className,
	children,
}: AlertDialogProps) {
	return (
		<BaseAlertDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
			{trigger ? <BaseAlertDialog.Trigger render={trigger} /> : null}
			<BaseAlertDialog.Portal>
				<BaseAlertDialog.Backdrop className={styles.backdrop} />
				<BaseAlertDialog.Viewport className={styles.viewport}>
					<BaseAlertDialog.Popup className={cx(styles.popup, styles[variant], className)}>
						<BaseAlertDialog.Title className={styles.title}>{title}</BaseAlertDialog.Title>
						{description ? (
							<BaseAlertDialog.Description className={styles.description}>
								{description}
							</BaseAlertDialog.Description>
						) : null}
						{children}
						<div className={styles.actions}>
							<BaseAlertDialog.Close render={<Button variant="default" />}>
								{cancelLabel}
							</BaseAlertDialog.Close>
							<BaseAlertDialog.Close
								disabled={loading}
								onClick={onConfirm}
								render={
									<Button variant={variant === 'danger' ? 'danger' : 'primary'} loading={loading} />
								}
							>
								{confirmLabel}
							</BaseAlertDialog.Close>
						</div>
					</BaseAlertDialog.Popup>
				</BaseAlertDialog.Viewport>
			</BaseAlertDialog.Portal>
		</BaseAlertDialog.Root>
	);
}
