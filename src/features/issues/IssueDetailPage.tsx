/**
 * One issue, editable in place.
 *
 * Every field commits on its own — there is no form and no Save button — so each control is one
 * optimistic mutation through `useUpdateIssues`, which is the same path the list's bulk toolbar
 * takes. The header is not a summary of the issue; it *is* the issue.
 *
 * The route is a real deep link: `issues.byId` is asked for the id in the URL, with nothing
 * assumed to be cached, and the three ways that can end — still loading, failed, genuinely gone —
 * are three different screens rather than one blank page.
 */

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useRepository } from '@/data';
import type { Issue, IssuePatch } from '@/data';
import { AlertDialog } from '@/ds/alert-dialog';
import { Button } from '@/ds/button';
import { IconChevronLeft, IconInbox, IconTrash, IconWarning } from '@/ds/icons';
import { Page } from '@/ds/page';
import { Spinner } from '@/ds/spinner';
import { Tabs } from '@/ds/tabs';
import {
	AssigneeField,
	LabelsField,
	PriorityField,
	ProjectField,
	StatusField,
} from './IssueFields';
import { InlineText } from './InlineText';
import { IssueActivity } from './IssueActivity';
import { IssueComments } from './IssueComments';
import { formatAbsoluteTime, formatRelativeTime } from './meta';
import { issueKeys, useDeleteIssues, useUpdateIssues } from './mutations';
import { issuesPath } from './routes';
import styles from './IssueDetailPage.module.css';

function BackLink({ search }: { search: string }) {
	return (
		<Link className={styles.back} to={issuesPath(search)}>
			<IconChevronLeft size={14} />
			Issues
		</Link>
	);
}

export function IssueDetailPage() {
	const { id } = useParams();
	const issueId = id ?? '';
	const repository = useRepository();
	const navigate = useNavigate();
	const location = useLocation();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const issueQuery = useQuery({
		queryKey: issueKeys.detail(issueId),
		queryFn: ({ signal }) => repository.issues.byId(issueId, { signal }),
		enabled: issueId !== '',
	});

	const update = useUpdateIssues();
	const remove = useDeleteIssues({
		// Leaving happens on the repository's confirmation, not on the click: an optimistic
		// navigation would strand you on the list if the write turned out to fail.
		onDeleted: () => navigate(issuesPath(location.search), { replace: true }),
	});

	const issue = issueQuery.data ?? null;

	const reporter = useQuery({
		queryKey: ['users', 'by-id', issue?.reporterId ?? null],
		queryFn: ({ signal }) =>
			issue === null ? Promise.resolve([]) : repository.users.byIds([issue.reporterId], { signal }),
		enabled: issue !== null,
		staleTime: Infinity,
	});

	/** One field, one write. `bulkUpdate` with a single id keeps this on the shared path. */
	function save(patch: IssuePatch): void {
		update.mutate({ ids: [issueId], patch });
	}

	if (issueQuery.isPending && issueId !== '') {
		return (
			<Page>
				<BackLink search={location.search} />
				<div className={styles.state}>
					<Spinner size={20} label="Loading issue" />
				</div>
			</Page>
		);
	}

	// An error with nothing cached is a dead end; an error with data on screen is a stale read, and
	// is reported inline further down instead of replacing what you were looking at.
	if (issueQuery.isError && issue === null) {
		return (
			<Page>
				<BackLink search={location.search} />
				<div className={styles.state}>
					<IconWarning />
					<p>Could not load this issue.</p>
					<Button onClick={() => void issueQuery.refetch()}>Try again</Button>
				</div>
			</Page>
		);
	}

	if (issue === null) {
		return (
			<Page>
				<BackLink search={location.search} />
				<div className={styles.state}>
					<IconInbox />
					<Page.Title>No such issue</Page.Title>
					<p>
						{issueId === ''
							? 'That link is missing an issue id.'
							: 'It was deleted, or it never existed in this dataset.'}
					</p>
					<Button onClick={() => navigate(issuesPath(location.search))}>Back to issues</Button>
				</div>
			</Page>
		);
	}

	return (
		<Page>
			<BackLink search={location.search} />

			<header className={styles.header}>
				<div className={styles.identity}>
					<span className={styles.key}>{issue.key}</span>
					<span className={styles.reported}>
						opened by {reporter.data?.[0]?.name ?? '…'}{' '}
						<time
							dateTime={new Date(issue.createdAt).toISOString()}
							title={formatAbsoluteTime(issue.createdAt)}
						>
							{formatRelativeTime(issue.createdAt)}
						</time>
					</span>

					<span className={styles.spacer} />

					{/* `<output>` rather than `role="status"`: same live region, native element. */}
					{update.isPending && (
						<output className={styles.saving}>
							<Spinner size={12} />
							Saving
						</output>
					)}

					{issueQuery.isError && <span className={styles.stale}>Could not refresh</span>}

					<Button
						variant="ghost"
						size="sm"
						onClick={() => setConfirmOpen(true)}
						disabled={remove.isPending}
					>
						<IconTrash size={14} />
						Delete
					</Button>
				</div>

				<InlineText
					value={issue.title}
					onCommit={(title) => save({ title })}
					label="Issue title"
					required
					className={styles.title}
				/>
			</header>

			<div className={styles.fields}>
				<StatusField value={issue.status} onChange={(status) => save({ status })} />
				<PriorityField value={issue.priority} onChange={(priority) => save({ priority })} />
				<ProjectField
					value={issue.projectId}
					// A project is not optional on an issue, so a cleared value is not a write.
					onChange={(projectId) => projectId !== null && save({ projectId })}
				/>
				<AssigneeField value={issue.assigneeId} onChange={(assigneeId) => save({ assigneeId })} />
				<LabelsField value={issue.labelIds} onChange={(labelIds) => save({ labelIds })} />
			</div>

			<Page.Section>
				<Page.SectionTitle>Description</Page.SectionTitle>
				<InlineText
					multiline
					value={issue.description}
					onCommit={(description) => save({ description })}
					label="Issue description"
					minRows={3}
					maxRows={20}
					placeholder="No description yet."
				/>
			</Page.Section>

			<Tabs defaultValue="comments" className={styles.tabs}>
				<Tabs.List>
					<Tabs.Tab value="comments">Comments</Tabs.Tab>
					<Tabs.Tab value="activity">Activity</Tabs.Tab>
				</Tabs.List>
				<Tabs.Panel value="comments">
					<IssueComments issueId={issue.id} />
				</Tabs.Panel>
				<Tabs.Panel value="activity">
					<IssueActivity issueId={issue.id} />
				</Tabs.Panel>
			</Tabs>

			<DeleteDialog
				issue={issue}
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				loading={remove.isPending}
				onConfirm={() => remove.mutate({ ids: [issue.id] })}
			/>
		</Page>
	);
}

function DeleteDialog({
	issue,
	open,
	onOpenChange,
	loading,
	onConfirm,
}: {
	issue: Issue;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	loading: boolean;
	onConfirm: () => void;
}) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={onOpenChange}
			variant="danger"
			title={`Delete ${issue.key}?`}
			description="It stops appearing in every list. Undo is offered for a few seconds afterwards, and the delete itself survives a reload."
			confirmLabel="Delete"
			loading={loading}
			onConfirm={onConfirm}
		/>
	);
}
