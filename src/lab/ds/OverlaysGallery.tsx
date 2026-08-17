import { useState, type ReactNode } from 'react';
import { AlertDialog } from '@/ds/alert-dialog';
import { Button } from '@/ds/button';
import { Dialog } from '@/ds/dialog';
import {
	IconCheck,
	IconFilter,
	IconMore,
	IconPencil,
	IconSettings,
	IconSort,
	IconTag,
	IconTrash,
	IconUser,
} from '@/ds/icons';
import { Menu } from '@/ds/menu';
import { Popover } from '@/ds/popover';
import { ToastProvider, useToast } from '@/ds/toast';
import { Tooltip, TooltipProvider } from '@/ds/tooltip';
import styles from './OverlaysGallery.module.css';

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className={styles.section}>
			<h2 className={styles.heading}>{title}</h2>
			<div className={styles.row}>{children}</div>
		</section>
	);
}

function DialogSizes() {
	return (
		<>
			{(['sm', 'md', 'lg'] as const).map((size) => (
				<Dialog key={size} size={size}>
					<Dialog.Trigger>Dialog {size}</Dialog.Trigger>
					<Dialog.Title>Move issue to another project</Dialog.Title>
					<Dialog.Description>
						Watchers, labels and the comment thread move with it. Links from other issues keep
						resolving.
					</Dialog.Description>
					<p className={styles.body}>
						Size <code>{size}</code>. Below 640px every dialog becomes a bottom sheet, so this same
						markup is usable at 360px.
					</p>
					<Dialog.Actions>
						<Dialog.Close>Cancel</Dialog.Close>
						<Dialog.Close variant="primary">Move issue</Dialog.Close>
					</Dialog.Actions>
				</Dialog>
			))}

			<Dialog size="md" showCloseButton={false}>
				<Dialog.Trigger variant="ghost">No dismiss button</Dialog.Trigger>
				<Dialog.Title>Escape still works</Dialog.Title>
				<Dialog.Description>
					The corner dismiss is opt-out, not absent: Escape and the backdrop still close this.
				</Dialog.Description>
				<Dialog.Actions>
					<Dialog.Close variant="primary">Got it</Dialog.Close>
				</Dialog.Actions>
			</Dialog>
		</>
	);
}

function ControlledDialog() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button variant="ghost" onClick={() => setOpen(true)}>
				Controlled dialog
			</Button>
			<Dialog open={open} onOpenChange={setOpen} size="sm">
				<Dialog.Title>Controlled</Dialog.Title>
				<Dialog.Description>
					Opened from outside state, with no trigger inside the dialog at all.
				</Dialog.Description>
				<Dialog.Actions>
					<Dialog.Close>Close</Dialog.Close>
				</Dialog.Actions>
			</Dialog>
		</>
	);
}

function AlertDialogs() {
	const toast = useToast();

	return (
		<>
			<AlertDialog
				trigger={<Button variant="danger">Delete issue</Button>}
				title="Delete BB-241?"
				description="The issue and its 14 comments are removed. This cannot be undone."
				confirmLabel="Delete"
				variant="danger"
				onConfirm={() => toast.show({ title: 'Issue deleted', variant: 'error' })}
			/>
			<AlertDialog
				trigger={<Button>Publish changes</Button>}
				title="Publish 3 changes?"
				description="Everyone watching this project is notified."
				confirmLabel="Publish"
				onConfirm={() => toast.show({ title: 'Changes published', variant: 'success' })}
			/>
			<AlertDialog
				trigger={<Button variant="ghost">Confirming (loading)</Button>}
				title="Reindex the project?"
				description="The confirm button stays busy while the action is in flight."
				confirmLabel="Reindex"
				loading
			/>
		</>
	);
}

function Popovers() {
	return (
		<>
			<Popover
				trigger={
					<Button>
						<IconFilter />
						Filter
					</Button>
				}
				side="bottom"
				align="start"
				arrow
			>
				<div className={styles.popoverBody}>
					<strong className={styles.popoverTitle}>Filter issues</strong>
					<p className={styles.muted}>
						Anchored bottom-start with an arrow. At 360px the popup is clamped to the viewport with
						a 12px margin.
					</p>
				</div>
			</Popover>

			<Popover trigger={<Button variant="ghost">Side: right</Button>} side="right" align="center">
				<div className={styles.popoverBody}>
					<strong className={styles.popoverTitle}>Right side</strong>
					<p className={styles.muted}>Flips to the left when it would collide.</p>
				</div>
			</Popover>

			<Popover
				trigger={<Button variant="ghost">Opens on hover</Button>}
				side="top"
				openOnHover
				arrow
			>
				<div className={styles.popoverBody}>
					<strong className={styles.popoverTitle}>Hover</strong>
					<p className={styles.muted}>
						<code>openOnHover</code> is a trigger prop in Base UI, so the wrapper re-exposes it.
					</p>
				</div>
			</Popover>

			<Popover trigger={<Button variant="ghost">Modal</Button>} modal side="bottom" align="end">
				<div className={styles.popoverBody}>
					<strong className={styles.popoverTitle}>Modal popover</strong>
					<p className={styles.muted}>Page scroll is locked while this is open.</p>
				</div>
			</Popover>
		</>
	);
}

const SORTS = ['Newest', 'Oldest', 'Priority'];

function Menus() {
	const [density, setDensity] = useState('comfortable');
	const [showClosed, setShowClosed] = useState(true);
	const [showMine, setShowMine] = useState(false);
	const toast = useToast();

	return (
		<>
			<Menu
				trigger={
					<Button variant="ghost" iconOnly aria-label="Issue actions">
						<IconMore />
					</Button>
				}
			>
				<Menu.Group label="Issue">
					<Menu.Item startIcon={<IconPencil />} shortcut="E">
						Edit title
					</Menu.Item>
					<Menu.Item startIcon={<IconUser />} shortcut="A">
						Assign to me
					</Menu.Item>
					<Menu.Submenu label="Add label" startIcon={<IconTag />}>
						<Menu.Item>bug</Menu.Item>
						<Menu.Item>regression</Menu.Item>
						<Menu.Separator />
						<Menu.Submenu label="Area">
							<Menu.Item>combobox</Menu.Item>
							<Menu.Item>dialog</Menu.Item>
							<Menu.Item>menu</Menu.Item>
						</Menu.Submenu>
					</Menu.Submenu>
				</Menu.Group>

				<Menu.Separator />

				<Menu.CheckboxItem checked={showClosed} onCheckedChange={setShowClosed}>
					Show closed
				</Menu.CheckboxItem>
				<Menu.CheckboxItem checked={showMine} onCheckedChange={setShowMine} shortcut="M">
					Only mine
				</Menu.CheckboxItem>

				<Menu.Separator />

				<Menu.RadioGroup label="Density" value={density} onValueChange={setDensity}>
					<Menu.RadioItem value="comfortable">Comfortable</Menu.RadioItem>
					<Menu.RadioItem value="compact">Compact</Menu.RadioItem>
				</Menu.RadioGroup>

				<Menu.Separator />

				<Menu.Item startIcon={<IconSettings />} disabled>
					Project settings
				</Menu.Item>
				<Menu.Item
					startIcon={<IconTrash />}
					shortcut="⌫"
					onClick={() => toast.show({ title: 'Issue deleted', variant: 'error' })}
				>
					Delete
				</Menu.Item>
			</Menu>

			<Menu
				trigger={
					<Button>
						<IconSort />
						Sort
					</Button>
				}
				align="end"
			>
				<Menu.RadioGroup defaultValue="Newest">
					{SORTS.map((sort) => (
						<Menu.RadioItem key={sort} value={sort}>
							{sort}
						</Menu.RadioItem>
					))}
				</Menu.RadioGroup>
			</Menu>

			<Menu trigger={<Button variant="ghost">Menu (side: top)</Button>} side="top">
				<Menu.Item startIcon={<IconCheck />}>Mark as done</Menu.Item>
				<Menu.Item startIcon={<IconFilter />}>Save this filter</Menu.Item>
			</Menu>

			<span className={styles.state}>
				density: {density} · closed: {String(showClosed)} · mine: {String(showMine)}
			</span>
		</>
	);
}

function Tooltips() {
	return (
		<>
			<Tooltip content="Edit the issue title">
				<Button variant="ghost" iconOnly aria-label="Edit">
					<IconPencil />
				</Button>
			</Tooltip>
			<Tooltip content="Filter the list" side="bottom">
				<Button variant="ghost" iconOnly aria-label="Filter">
					<IconFilter />
				</Button>
			</Tooltip>
			<Tooltip content="Assign" side="right">
				<Button variant="ghost" iconOnly aria-label="Assign">
					<IconUser />
				</Button>
			</Tooltip>
			<Tooltip content="No arrow, and it opens without delay" arrow={false} delay={0}>
				<Button variant="ghost">Instant tooltip</Button>
			</Tooltip>
			<Tooltip
				content="Tooltips wrap: this one is long enough to hit the 18rem clamp and keep wrapping."
				side="bottom"
				align="start"
			>
				<Button variant="ghost">Long tooltip</Button>
			</Tooltip>
		</>
	);
}

function Toasts() {
	const toast = useToast();
	const [count, setCount] = useState(0);

	return (
		<>
			<Button
				onClick={() => {
					setCount((prev) => prev + 1);
					toast.show({
						title: `Issue BB-${240 + count} updated`,
						description: 'Priority changed to High.',
					});
				}}
			>
				Show toast
			</Button>

			<Button
				variant="primary"
				onClick={() =>
					toast.show({
						title: 'Issue moved to Done',
						description: 'BB-241 · Combobox drops focus after filtering',
						variant: 'success',
						timeout: 10_000,
						action: {
							label: 'Undo',
							onClick: () => toast.show({ title: 'Move undone', variant: 'info' }),
						},
					})
				}
			>
				Toast with undo
			</Button>

			<Button
				variant="danger"
				onClick={() =>
					toast.show({
						title: 'Could not save',
						description: 'The repository rejected the write.',
						variant: 'error',
						timeout: 0,
						action: { label: 'Retry', onClick: () => toast.show({ title: 'Retrying…' }) },
					})
				}
			>
				Sticky error toast
			</Button>

			<Button
				variant="ghost"
				onClick={() => {
					const id = toast.show({ title: 'Saving…', timeout: 0 });
					window.setTimeout(
						() => toast.update(id, { title: 'Saved', variant: 'success', timeout: 4000 }),
						1200,
					);
				}}
			>
				Toast that updates
			</Button>

			<Button variant="ghost" onClick={() => toast.dismiss()}>
				Dismiss latest
			</Button>
		</>
	);
}

/**
 * Every overlay in `ds/`, in the variants worth eyeballing. Renders standalone — the
 * providers it needs are wrapped by `OverlaysGalleryPage` below, and the app root mounts
 * the same two providers once.
 */
export function OverlaysGallery() {
	return (
		<div className={styles.root}>
			<header className={styles.header}>
				<h1 className={styles.title}>Overlays</h1>
				<p className={styles.muted}>
					Dialog, alert dialog, popover, menu, tooltip and toast. Check this at 360×640 and in both
					themes before calling any of them done.
				</p>
			</header>

			<Section title="Dialog">
				<DialogSizes />
				<ControlledDialog />
			</Section>

			<Section title="Alert dialog">
				<AlertDialogs />
			</Section>

			<Section title="Popover">
				<Popovers />
			</Section>

			<Section title="Menu">
				<Menus />
			</Section>

			<Section title="Tooltip">
				<Tooltips />
			</Section>

			<Section title="Toast">
				<Toasts />
			</Section>
		</div>
	);
}

/** The gallery with its providers, for mounting the route directly. */
export function OverlaysGalleryPage() {
	return (
		<TooltipProvider>
			<ToastProvider>
				<OverlaysGallery />
			</ToastProvider>
		</TooltipProvider>
	);
}
