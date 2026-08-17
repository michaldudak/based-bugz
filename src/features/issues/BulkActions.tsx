/**
 * The selection toolbar.
 *
 * Every action here is a real repository mutation carrying an `actorId`, so the activity log and a
 * later replay see the same events a single-issue edit would produce. Delete goes through an
 * AlertDialog and hands back an undo, because `issues.restore` exists precisely so a destructive
 * bulk action does not have to be final.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useCurrentUser } from '@/app/session';
import { useRepository } from '@/data';
import type { IssueId, IssuePatch, IssueStatus } from '@/data';
import { AlertDialog } from '@/ds/alert-dialog';
import { Button } from '@/ds/button';
import { IconChevronDown, IconTrash, IconUser } from '@/ds/icons';
import { Menu } from '@/ds/menu';
import { Popover } from '@/ds/popover';
import { useToast } from '@/ds/toast';
import { AssigneePicker } from './AssigneePicker';
import { STATUS_LABEL, STATUS_ORDER } from './meta';
import type { AssigneeValue } from './useIssueFilters';
import styles from './BulkActions.module.css';

function plural(count: number): string {
	return count === 1 ? '1 issue' : `${count.toLocaleString()} issues`;
}

export interface BulkActionsProps {
	selectedIds: readonly IssueId[];
	onClear: () => void;
}

export function BulkActions({ selectedIds, onClear }: BulkActionsProps) {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();
	const [assignOpen, setAssignOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const count = selectedIds.length;

	function refresh() {
		void queryClient.invalidateQueries({ queryKey: ['issues'] });
	}

	function reportFailure(action: string) {
		toast.show({
			title: `Could not ${action}`,
			description: 'The repository rejected the write — nothing was changed.',
			variant: 'error',
		});
	}

	const patch = useMutation({
		mutationFn: (input: { ids: readonly IssueId[]; patch: IssuePatch }) =>
			repository.issues.bulkUpdate(input.ids, input.patch, { actorId: currentUser.id }),
		onSuccess: (_updated, input) => {
			refresh();
			onClear();
			toast.show({ title: `Updated ${plural(input.ids.length)}`, variant: 'success' });
		},
		onError: () => reportFailure('update those issues'),
	});

	const remove = useMutation({
		mutationFn: (ids: readonly IssueId[]) =>
			Promise.all(ids.map((id) => repository.issues.delete(id, { actorId: currentUser.id }))),
		onSuccess: (_result, ids) => {
			refresh();
			onClear();
			toast.show({
				title: `Deleted ${plural(ids.length)}`,
				variant: 'success',
				timeout: 8000,
				action: { label: 'Undo', onClick: () => restore.mutate(ids) },
			});
		},
		onError: () => reportFailure('delete those issues'),
	});

	const restore = useMutation({
		mutationFn: (ids: readonly IssueId[]) =>
			Promise.all(ids.map((id) => repository.issues.restore(id, { actorId: currentUser.id }))),
		onSuccess: (_result, ids) => {
			refresh();
			toast.show({ title: `Restored ${plural(ids.length)}`, variant: 'success' });
		},
		onError: () => reportFailure('restore those issues'),
	});

	const busy = patch.isPending || remove.isPending || restore.isPending;

	function assign(value: AssigneeValue) {
		setAssignOpen(false);

		if (value === null) {
			return;
		}

		patch.mutate({
			ids: selectedIds,
			patch: { assigneeId: value.kind === 'unassigned' ? null : value.id },
		});
	}

	function setStatus(status: IssueStatus) {
		patch.mutate({ ids: selectedIds, patch: { status } });
	}

	return (
		<div className={styles.bar} role="toolbar" aria-label="Bulk actions">
			<span className={styles.count} aria-live="polite">
				{plural(count)} selected
			</span>

			<Menu
				trigger={
					<Button size="sm" disabled={busy}>
						Status
						<IconChevronDown size={14} />
					</Button>
				}
			>
				{STATUS_ORDER.map((status) => (
					<Menu.Item key={status} onClick={() => setStatus(status)}>
						{STATUS_LABEL[status]}
					</Menu.Item>
				))}
			</Menu>

			<Popover
				open={assignOpen}
				onOpenChange={setAssignOpen}
				align="start"
				className={styles.assignPopup}
				trigger={
					<Button size="sm" disabled={busy}>
						<IconUser size={14} />
						Assign
					</Button>
				}
			>
				<p className={styles.assignHint}>Assign {plural(count)} to…</p>
				<AssigneePicker
					value={null}
					onChange={assign}
					clearable={false}
					label="Bulk assignee"
					placeholder="Search people…"
				/>
			</Popover>

			<Button
				size="sm"
				variant="danger"
				disabled={busy}
				onClick={() => setConfirmOpen(true)}
				className={styles.delete}
			>
				<IconTrash size={14} />
				Delete
			</Button>

			<Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
				Clear selection
			</Button>

			<AlertDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				variant="danger"
				title={`Delete ${plural(count)}?`}
				description="They stop appearing in every list. Undo is offered for a few seconds afterwards."
				confirmLabel="Delete"
				loading={remove.isPending}
				onConfirm={() => remove.mutate(selectedIds)}
			/>
		</div>
	);
}
