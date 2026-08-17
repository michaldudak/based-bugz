import { useQuery } from '@tanstack/react-query';
import { useRepository } from '@/data';
import type { Issue, IssueStatus, User } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Badge } from '@/ds/badge';
import { Spinner } from '@/ds/spinner';
import styles from './IssuesPage.module.css';

const STATUS_LABEL: Record<IssueStatus, string> = {
	backlog: 'Backlog',
	todo: 'Todo',
	in_progress: 'In progress',
	in_review: 'In review',
	done: 'Done',
	cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<IssueStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
	backlog: 'neutral',
	todo: 'neutral',
	in_progress: 'info',
	in_review: 'warning',
	done: 'success',
	cancelled: 'danger',
};

function IssueRow({ issue, assignee }: { issue: Issue; assignee: User | undefined }) {
	return (
		<li className={styles.row}>
			<span className={styles.key}>{issue.key}</span>
			<span className={styles.issueTitle}>{issue.title}</span>
			<Badge variant={STATUS_VARIANT[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
			{assignee ? (
				<Avatar
					name={assignee.name}
					initials={assignee.initials}
					hue={assignee.avatarHue}
					size="sm"
				/>
			) : (
				<span className={styles.unassigned} aria-label="Unassigned">
					—
				</span>
			)}
		</li>
	);
}

/**
 * Phase 3 placeholder: a real query against the repository, so the shell is verifiable end to end.
 * Phase 5 replaces this with the virtualized, filterable list.
 */
export function IssuesPage() {
	const repository = useRepository();

	const issues = useQuery({
		queryKey: ['issues', 'first-page'],
		queryFn: ({ signal }) => repository.issues.list({}, { limit: 25, signal }),
	});

	const assigneeIds = [
		...new Set((issues.data?.items ?? []).flatMap((issue) => issue.assigneeId ?? [])),
	];

	const assignees = useQuery({
		queryKey: ['users', 'by-ids', assigneeIds],
		queryFn: ({ signal }) => repository.users.byIds(assigneeIds, { signal }),
		enabled: assigneeIds.length > 0,
	});

	const byId = new Map((assignees.data ?? []).map((user) => [user.id, user]));

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1 className={styles.title}>Issues</h1>
				<p className={styles.subtitle}>
					{issues.data?.total === undefined
						? 'First page of the generated backlog.'
						: `${issues.data.total.toLocaleString()} issues in this dataset.`}
				</p>
			</header>

			{issues.isPending && (
				<div className={styles.state}>
					<Spinner size={18} label="Loading issues" />
				</div>
			)}

			{issues.isError && (
				<div className={styles.state}>Could not load issues. Lower ?errorRate= and try again.</div>
			)}

			{issues.data && (
				<ul className={styles.list}>
					{issues.data.items.map((issue) => (
						<IssueRow
							key={issue.id}
							issue={issue}
							assignee={issue.assigneeId === null ? undefined : byId.get(issue.assigneeId)}
						/>
					))}
				</ul>
			)}
		</div>
	);
}
