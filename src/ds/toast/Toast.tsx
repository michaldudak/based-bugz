import { useMemo, type ReactNode } from 'react';
import { Toast as BaseToast } from '@base-ui/react/toast';
import { IconClose } from '@/ds/icons';
import styles from './Toast.module.css';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastAction {
	label: string;
	onClick: () => void;
}

export interface ShowToastOptions {
	title?: ReactNode;
	description?: ReactNode;
	/** Renders the trailing button. Pressing it runs `onClick` and dismisses the toast. */
	action?: ToastAction;
	variant?: ToastVariant;
	/** Milliseconds until auto-dismiss; `0` keeps the toast until it is dismissed. */
	timeout?: number;
	/** `high` announces urgently. */
	priority?: 'low' | 'high';
	/** Reusing an id updates that toast in place and restarts its timer. */
	id?: string;
}

export interface ToastApi {
	/** Queues a toast and returns its id. */
	show: (options: ShowToastOptions) => string;
	/** Dismisses one toast, or the most recent one when called without an id. */
	dismiss: (id?: string) => void;
	/** Patches a live toast — for optimistic flows that resolve later. */
	update: (id: string, options: Omit<ShowToastOptions, 'id'>) => void;
}

/**
 * Base UI takes the action button as *data* on the toast (`actionProps`) rather than as JSX
 * in the renderer, and it does not close the toast when that button is pressed. Both are
 * handled here so `show({ action })` behaves the way an undo affordance has to.
 *
 * Only the manager's methods are captured, never its `toasts` array: `useToastManager()`
 * returns both from one object, so keeping the whole thing in the dependency list would
 * hand every caller a new API object each time any toast appears or leaves.
 */
export function useToast(): ToastApi {
	const { add, close, update } = BaseToast.useToastManager();

	return useMemo<ToastApi>(() => {
		function build(options: ShowToastOptions, getId: () => string | undefined) {
			const { action, variant, ...rest } = options;
			return {
				...rest,
				type: variant,
				actionProps: action
					? {
							children: action.label,
							onClick: () => {
								action.onClick();
								const id = getId();
								if (id !== undefined) {
									close(id);
								}
							},
						}
					: undefined,
			};
		}

		return {
			show(options) {
				// The action handler needs an id that `add` has not returned yet, so it reads
				// this cell lazily instead of capturing the value.
				const cell: { id?: string } = {};
				cell.id = add(build(options, () => cell.id));
				return cell.id;
			},
			dismiss(id) {
				close(id);
			},
			update(id, options) {
				update(
					id,
					build(options, () => id),
				);
			},
		};
	}, [add, close, update]);
}

export interface ToastProviderProps {
	children?: ReactNode;
	/** Default auto-dismiss delay in milliseconds. */
	timeout?: number;
	/** Toasts past this count collapse behind the stack instead of unmounting. */
	limit?: number;
}

function ToastList() {
	const { toasts } = BaseToast.useToastManager();

	return toasts.map((toast) => (
		<BaseToast.Root key={toast.id} toast={toast} className={styles.toast}>
			<BaseToast.Content className={styles.content}>
				<div className={styles.text}>
					{toast.title ? <BaseToast.Title className={styles.title} /> : null}
					{toast.description ? <BaseToast.Description className={styles.description} /> : null}
				</div>
				<BaseToast.Action className={styles.action} />
				<BaseToast.Close className={styles.close} aria-label="Dismiss">
					<IconClose size={14} />
				</BaseToast.Close>
			</BaseToast.Content>
		</BaseToast.Root>
	));
}

/**
 * Provider + Portal + Viewport + the renderer for every toast. Mount once at the app root;
 * `useToast()` works anywhere beneath it.
 */
export function ToastProvider({ children, timeout, limit }: ToastProviderProps) {
	return (
		<BaseToast.Provider timeout={timeout} limit={limit}>
			{children}
			<BaseToast.Portal>
				<BaseToast.Viewport className={styles.viewport}>
					<ToastList />
				</BaseToast.Viewport>
			</BaseToast.Portal>
		</BaseToast.Provider>
	);
}
