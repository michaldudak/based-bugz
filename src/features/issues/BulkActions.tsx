/**
 * The selection toolbar.
 *
 * Every action here goes through the same hooks the detail page uses (`./mutations`), so a status
 * change across 40 rows and a status change on one issue produce identical events, identical cache
 * behaviour, and identical rollback on failure. Delete hands back an undo for the same reason
 * `issues.restore` exists: a destructive bulk action should not have to be final.
 */

import { useState } from 'react';
import type { IssueId, IssuePatch, IssueStatus } from '@/data';
import { AlertDialog } from '@/ds/alert-dialog';
import { Button } from '@/ds/button';
import { IconChevronDown, IconTrash, IconUser } from '@/ds/icons';
import { Menu } from '@/ds/menu';
import { Popover } from '@/ds/popover';
import { AssigneePicker } from './AssigneePicker';
import { STATUS_LABEL, STATUS_ORDER, formatIssueCount } from './meta';
import { useDeleteIssues, useUpdateIssues } from './mutations';
import type { AssigneeValue } from './useIssueFilters';
import styles from './BulkActions.module.css';

export interface BulkActionsProps {
	selectedIds: readonly IssueId[];
	onClear: () => void;
}

export function BulkActions({ selectedIds, onClear }: BulkActionsProps) {
	const [assignOpen, setAssignOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);

	const count = selectedIds.length;

	const update = useUpdateIssues();
	const remove = useDeleteIssues({ onDeleted: onClear });

	const busy = update.isPending || remove.isPending;

	/*
	 * The selection is dropped once the write lands, not when it is fired: a rejected bulk edit
	 * rolls the rows back, and rolling back into an empty toolbar would leave you with nothing to
	 * retry against.
	 */
	function apply(patch: IssuePatch) {
		update.mutate({ ids: selectedIds, patch }, { onSuccess: onClear });
	}

	function assign(value: AssigneeValue) {
		setAssignOpen(false);

		if (value === null) {
			return;
		}

		apply({ assigneeId: value.kind === 'unassigned' ? null : value.id });
	}

	function setStatus(status: IssueStatus) {
		apply({ status });
	}

	return (
		<div className={styles.bar} role="toolbar" aria-label="Bulk actions">
			<span className={styles.count} aria-live="polite">
				{formatIssueCount(count)} selected
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
				<p className={styles.assignHint}>Assign {formatIssueCount(count)} to…</p>
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
				title={`Delete ${formatIssueCount(count)}?`}
				description="They stop appearing in every list. Undo is offered for a few seconds afterwards."
				confirmLabel="Delete"
				loading={remove.isPending}
				onConfirm={() => remove.mutate({ ids: selectedIds })}
			/>
		</div>
	);
}
