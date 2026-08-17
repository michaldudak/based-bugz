/**
 * The activity tab.
 *
 * Nothing here is derived from the issue's current state — every line is one `IssueActivityEvent`
 * from the log the repository already writes for undo and replay. That is what makes the history
 * real rather than decorative: edit a field on this page, switch tabs, and the entry is there
 * because the write produced it, not because the UI remembered doing it.
 *
 * Events carry ids, so a readable sentence needs the entities behind them. They are collected
 * across the loaded pages and fetched in one batched read per kind, the same way the list resolves
 * assignees.
 */

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useRepository } from '@/data';
import { isIssuePriority, isIssueStatus } from '@/data';
import type {
	IssueActivityEvent,
	IssueFieldValue,
	IssueId,
	Label,
	LabelId,
	Page,
	Project,
	ProjectId,
	User,
	UserId,
} from '@/data';
import { Badge } from '@/ds/badge';
import { Button } from '@/ds/button';
import { IconWarning } from '@/ds/icons';
import { Spinner } from '@/ds/spinner';
import {
	PRIORITY_LABEL,
	STATUS_LABEL,
	STATUS_VARIANT,
	formatAbsoluteTime,
	formatRelativeTime,
	labelColorStyle,
} from './meta';
import { issueKeys } from './mutations';
import styles from './IssueActivity.module.css';

const PAGE_SIZE = 50;

/** Beyond this a renamed title turns the feed into a wall of text. */
const TITLE_PREVIEW = 80;

interface Lookups {
	users: ReadonlyMap<UserId, User>;
	labels: ReadonlyMap<LabelId, Label>;
	projects: ReadonlyMap<ProjectId, Project>;
}

/** The only object-valued field is `labelIds`, so this is the whole narrowing story. */
function asList(value: IssueFieldValue): readonly string[] {
	return typeof value === 'object' && value !== null ? value : [];
}

function asText(value: IssueFieldValue): string | null {
	return typeof value === 'string' ? value : null;
}

function preview(text: string): string {
	const points = [...text];

	return points.length <= TITLE_PREVIEW ? text : `${points.slice(0, TITLE_PREVIEW).join('')}…`;
}

function StatusChip({ value }: { value: string }): ReactNode {
	return isIssueStatus(value) ? (
		<Badge variant={STATUS_VARIANT[value]}>{STATUS_LABEL[value]}</Badge>
	) : (
		<span className={styles.value}>{value}</span>
	);
}

function LabelChip({ id, lookups }: { id: LabelId; lookups: Lookups }): ReactNode {
	const label = lookups.labels.get(id);

	if (label === undefined) {
		return <span className={styles.value}>{id}</span>;
	}

	return (
		<span className={styles.label} style={labelColorStyle(label.hue)}>
			{label.name}
		</span>
	);
}

function personName(id: UserId | null, lookups: Lookups): string {
	if (id === null) {
		return 'nobody';
	}

	return lookups.users.get(id)?.name ?? 'someone no longer here';
}

/** One event as a sentence. Returns the predicate; the actor's name is rendered by the caller. */
function describe(event: IssueActivityEvent, lookups: Lookups): ReactNode {
	switch (event.type) {
		case 'issue_created':
			return <>created this issue</>;

		case 'issue_commented':
			return <>commented: “{preview(event.comment.body)}”</>;

		case 'issue_deleted':
			return <>deleted this issue</>;

		case 'issue_restored':
			return <>restored this issue</>;

		case 'issue_field_changed':
			break;
	}

	switch (event.field) {
		case 'title': {
			const to = asText(event.to);

			return to === null ? <>renamed this issue</> : <>renamed this issue to “{preview(to)}”</>;
		}

		case 'description':
			return asText(event.to) === '' ? <>cleared the description</> : <>edited the description</>;

		case 'status':
			return (
				<>
					changed status from <StatusChip value={String(event.from)} /> to{' '}
					<StatusChip value={String(event.to)} />
				</>
			);

		case 'priority': {
			const to = event.to;

			return (
				<>
					set priority to{' '}
					<span className={styles.value}>
						{isIssuePriority(to) ? PRIORITY_LABEL[to] : String(to)}
					</span>
				</>
			);
		}

		case 'assigneeId': {
			const from = asText(event.from);
			const to = asText(event.to);

			if (to === null) {
				return <>unassigned this issue</>;
			}

			return from === null ? (
				<>
					assigned this to <span className={styles.value}>{personName(to, lookups)}</span>
				</>
			) : (
				<>
					reassigned this from <span className={styles.value}>{personName(from, lookups)}</span> to{' '}
					<span className={styles.value}>{personName(to, lookups)}</span>
				</>
			);
		}

		case 'projectId': {
			const to = asText(event.to);
			const project = to === null ? undefined : lookups.projects.get(to);

			return (
				<>
					moved this to{' '}
					<span className={styles.value}>{project?.name ?? to ?? 'another project'}</span>
				</>
			);
		}

		case 'estimate':
			return event.to === null ? (
				<>cleared the estimate</>
			) : (
				<>
					set the estimate to <span className={styles.value}>{String(event.to)}</span>
				</>
			);

		case 'labelIds': {
			const from = new Set(asList(event.from));
			const to = asList(event.to);
			const added = to.filter((id) => !from.has(id));
			const removed = [...from].filter((id) => !to.includes(id));

			// A single write can both add and remove, so the sentence is assembled rather than picked.
			return (
				<>
					{added.length > 0 && (
						<>
							added{' '}
							{added.map((id) => (
								<LabelChip key={id} id={id} lookups={lookups} />
							))}
						</>
					)}
					{added.length > 0 && removed.length > 0 && <> and </>}
					{removed.length > 0 && (
						<>
							removed{' '}
							{removed.map((id) => (
								<LabelChip key={id} id={id} lookups={lookups} />
							))}
						</>
					)}
					{added.length === 0 && removed.length === 0 && <>reordered the labels</>}
				</>
			);
		}
	}
}

/** Every id the loaded events reference, so each kind is fetched once rather than per row. */
function collectReferences(events: readonly IssueActivityEvent[]) {
	const users = new Set<UserId>();
	const labels = new Set<LabelId>();
	const projects = new Set<ProjectId>();

	for (const event of events) {
		users.add(event.actorId);

		if (event.type === 'issue_commented') {
			users.add(event.comment.authorId);
		}

		if (event.type !== 'issue_field_changed') {
			continue;
		}

		if (event.field === 'assigneeId') {
			for (const value of [event.from, event.to]) {
				const id = asText(value);

				if (id !== null) {
					users.add(id);
				}
			}
		}

		if (event.field === 'labelIds') {
			for (const id of [...asList(event.from), ...asList(event.to)]) {
				labels.add(id);
			}
		}

		if (event.field === 'projectId') {
			for (const value of [event.from, event.to]) {
				const id = asText(value);

				if (id !== null) {
					projects.add(id);
				}
			}
		}
	}

	return {
		userIds: [...users].toSorted(),
		labelIds: [...labels].toSorted(),
		projectIds: [...projects].toSorted(),
	};
}

export interface IssueActivityProps {
	issueId: IssueId;
}

export function IssueActivity({ issueId }: IssueActivityProps) {
	const repository = useRepository();

	const activity = useInfiniteQuery({
		queryKey: issueKeys.activity(issueId),
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.activity.list(issueId, { cursor: pageParam, limit: PAGE_SIZE, signal }),
		getNextPageParam: (lastPage: Page<IssueActivityEvent>) => lastPage.nextCursor,
	});

	const events = useMemo<readonly IssueActivityEvent[]>(
		() => (activity.data?.pages ?? []).flatMap((page) => page.items),
		[activity.data],
	);

	const references = useMemo(() => collectReferences(events), [events]);

	const users = useQuery({
		queryKey: ['users', 'by-ids', references.userIds],
		queryFn: ({ signal }) => repository.users.byIds(references.userIds, { signal }),
		enabled: references.userIds.length > 0,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	const labels = useQuery({
		queryKey: ['labels', 'by-ids', references.labelIds],
		queryFn: ({ signal }) => repository.labels.byIds(references.labelIds, { signal }),
		enabled: references.labelIds.length > 0,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	const projects = useQuery({
		queryKey: ['projects', 'by-ids', references.projectIds],
		queryFn: ({ signal }) => repository.projects.byIds(references.projectIds, { signal }),
		enabled: references.projectIds.length > 0,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	const lookups = useMemo<Lookups>(
		() => ({
			users: new Map((users.data ?? []).map((user) => [user.id, user])),
			labels: new Map((labels.data ?? []).map((label) => [label.id, label])),
			projects: new Map((projects.data ?? []).map((project) => [project.id, project])),
		}),
		[users.data, labels.data, projects.data],
	);

	const total = activity.data?.pages[0]?.total ?? events.length;

	return (
		<div className={styles.root}>
			{activity.isPending && (
				<div className={styles.state}>
					<Spinner size={16} label="Loading activity" />
				</div>
			)}

			{activity.isError && events.length === 0 && (
				<div className={styles.state}>
					<IconWarning />
					<p>Could not load the activity log.</p>
					<Button size="sm" onClick={() => void activity.refetch()}>
						Try again
					</Button>
				</div>
			)}

			<ol className={styles.list}>
				{events.map((event) => (
					<li key={event.id} className={styles.event}>
						<span className={styles.dot} aria-hidden="true" />
						<p className={styles.sentence}>
							<span className={styles.actor}>{personName(event.actorId, lookups)}</span>{' '}
							{describe(event, lookups)}{' '}
							<time
								className={styles.time}
								dateTime={new Date(event.at).toISOString()}
								title={formatAbsoluteTime(event.at)}
							>
								{formatRelativeTime(event.at)}
							</time>
						</p>
					</li>
				))}
			</ol>

			{activity.hasNextPage && (
				<Button
					size="sm"
					fullWidth
					loading={activity.isFetchingNextPage}
					onClick={() => void activity.fetchNextPage()}
				>
					Load more ({events.length} of {total.toLocaleString()})
				</Button>
			)}
		</div>
	);
}
