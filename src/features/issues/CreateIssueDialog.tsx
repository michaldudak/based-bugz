/**
 * The create dialog.
 *
 * It holds a draft rather than writing on every change — the opposite of the detail page, and the
 * reason both exist: an issue that does not yet have an id cannot be edited in place, so this is
 * the one screen in the feature with a submit button.
 *
 * Opening it is two-sourced: the "New issue" button on the list, and `?new=1` from the command
 * palette. The param is the palette's `NEW_ISSUE_PARAM`, honoured rather than re-declared.
 */

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { IssuePriority, IssueStatus, LabelId, ProjectId, UserId } from '@/data';
import { Button } from '@/ds/button';
import { Dialog } from '@/ds/dialog';
import { Field } from '@/ds/field';
import { Input } from '@/ds/input';
import { Textarea } from '@/ds/textarea';
import { useToast } from '@/ds/toast';
import {
	AssigneeField,
	LabelsField,
	PriorityField,
	ProjectField,
	StatusField,
} from './IssueFields';
import { useCreateIssue } from './mutations';
import { issuePath } from './routes';
import styles from './CreateIssueDialog.module.css';

interface Draft {
	title: string;
	description: string;
	status: IssueStatus;
	priority: IssuePriority;
	assigneeId: UserId | null;
	labelIds: readonly LabelId[];
	projectId: ProjectId | null;
}

const EMPTY_DRAFT: Draft = {
	title: '',
	description: '',
	status: 'backlog',
	priority: 'none',
	assigneeId: null,
	labelIds: [],
	projectId: null,
};

export interface CreateIssueDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function CreateIssueDialog({ open, onOpenChange }: CreateIssueDialogProps) {
	const navigate = useNavigate();
	const location = useLocation();
	const toast = useToast();
	const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
	/** Errors appear on the first submit, not while you are still filling the form in. */
	const [submitted, setSubmitted] = useState(false);
	const [wasOpen, setWasOpen] = useState(open);

	/*
	 * Reset on the closed → open edge, adjusting state during render rather than in an effect: the
	 * popup unmounts on close, so there is nothing to see mid-animation, and "New issue" must never
	 * greet you with what you typed and abandoned last time.
	 */
	if (open !== wasOpen) {
		setWasOpen(open);

		if (open) {
			setDraft(EMPTY_DRAFT);
			setSubmitted(false);
		}
	}

	const create = useCreateIssue({
		onCreated: (issue) => {
			onOpenChange(false);
			toast.show({
				title: `Created ${issue.key}`,
				description: issue.title,
				variant: 'success',
				action: { label: 'Open', onClick: () => navigate(issuePath(issue.id, location.search)) },
			});
		},
	});

	function update(patch: Partial<Draft>): void {
		setDraft((current) => ({ ...current, ...patch }));
	}

	const title = draft.title.trim();
	const titleError = submitted && title === '' ? 'An issue needs a title.' : undefined;
	const projectError = submitted && draft.projectId === null ? 'Pick a project.' : undefined;

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();
		setSubmitted(true);

		if (title === '' || draft.projectId === null) {
			return;
		}

		create.mutate({
			title,
			description: draft.description.trim(),
			status: draft.status,
			priority: draft.priority,
			assigneeId: draft.assigneeId,
			labelIds: draft.labelIds,
			projectId: draft.projectId,
		});
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange} size="lg">
			<Dialog.Title>New issue</Dialog.Title>
			<Dialog.Description>
				It lands in the same backlog as everything else, and survives a reload.
			</Dialog.Description>

			<form className={styles.form} onSubmit={handleSubmit} noValidate>
				<Field label="Title" error={titleError}>
					<Input
						value={draft.title}
						onValueChange={(next) => update({ title: next })}
						placeholder="Combobox drops the highlight when the page scrolls"
						autoComplete="off"
					/>
				</Field>

				<Field label="Description">
					<Textarea
						autoResize
						minRows={3}
						maxRows={10}
						value={draft.description}
						onChange={(event) => update({ description: event.target.value })}
						placeholder="What happened, and what did you expect instead?"
					/>
				</Field>

				<div className={styles.grid}>
					<StatusField value={draft.status} onChange={(status) => update({ status })} />
					<PriorityField value={draft.priority} onChange={(priority) => update({ priority })} />
					<ProjectField
						value={draft.projectId}
						onChange={(projectId) => update({ projectId })}
						error={projectError}
					/>
					<AssigneeField
						value={draft.assigneeId}
						onChange={(assigneeId) => update({ assigneeId })}
					/>
					<LabelsField value={draft.labelIds} onChange={(labelIds) => update({ labelIds })} />
				</div>

				<Dialog.Actions>
					<Dialog.Close disabled={create.isPending}>Cancel</Dialog.Close>
					<Button type="submit" variant="primary" loading={create.isPending}>
						Create issue
					</Button>
				</Dialog.Actions>
			</form>
		</Dialog>
	);
}
