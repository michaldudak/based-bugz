/**
 * The domain model.
 *
 * Union string types only — `erasableSyntaxOnly` bans enums, and unions serialize into the event
 * log and the URL without a mapping table anyway. Every literal set is declared as a `const` tuple
 * so the runtime validators used when replaying untrusted `localStorage` data stay in sync with the
 * type by construction.
 */

export type UserId = string;
export type IssueId = string;
export type LabelId = string;
export type ProjectId = string;
export type CommentId = string;
export type ActivityEventId = string;

export const ISSUE_STATUSES = [
	'backlog',
	'todo',
	'in_progress',
	'in_review',
	'done',
	'cancelled',
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const ISSUE_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const;

export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

/** Sort order for `status`. Workflow order, not alphabetical. */
export const STATUS_RANK: Record<IssueStatus, number> = {
	backlog: 0,
	todo: 1,
	in_progress: 2,
	in_review: 3,
	done: 4,
	cancelled: 5,
};

/** Sort order for `priority`. Ascending means "least urgent first". */
export const PRIORITY_RANK: Record<IssuePriority, number> = {
	none: 0,
	low: 1,
	medium: 2,
	high: 3,
	urgent: 4,
};

export interface User {
	id: UserId;
	name: string;
	email: string;
	/** Derived from `name`; may be CJK or emoji, so never assume two ASCII letters. */
	initials: string;
	/** 0-360, drives the generated avatar background. No remote images anywhere. */
	avatarHue: number;
	title: string;
	team: string;
}

export interface Label {
	id: LabelId;
	name: string;
	/** 0-360. */
	hue: number;
}

export interface Project {
	id: ProjectId;
	/** Short uppercase code, e.g. `CORE`. */
	key: string;
	name: string;
}

export interface Issue {
	id: IssueId;
	/** Human-facing identifier, e.g. `BUG-1234`. Unique, stable, and sortable numerically. */
	key: string;
	title: string;
	description: string;
	status: IssueStatus;
	priority: IssuePriority;
	assigneeId: UserId | null;
	reporterId: UserId;
	labelIds: readonly LabelId[];
	projectId: ProjectId;
	estimate: number | null;
	createdAt: number;
	updatedAt: number;
}

export interface Comment {
	id: CommentId;
	issueId: IssueId;
	authorId: UserId;
	body: string;
	createdAt: number;
}

/** The issue fields a user can edit. Drives both `IssuePatch` and the activity log. */
export const EDITABLE_ISSUE_FIELDS = [
	'title',
	'description',
	'status',
	'priority',
	'assigneeId',
	'labelIds',
	'projectId',
	'estimate',
] as const;

export type EditableIssueField = (typeof EDITABLE_ISSUE_FIELDS)[number];

export type IssuePatch = Partial<Pick<Issue, EditableIssueField>>;

/** The value side of a field change. Derived from `Issue`, so it can never drift from it. */
export type IssueFieldValue = Issue[EditableIssueField];

/** Everything needed to create an issue. The repository fills in id, key and timestamps. */
export interface NewIssue {
	title: string;
	description?: string;
	status?: IssueStatus;
	priority?: IssuePriority;
	assigneeId?: UserId | null;
	labelIds?: readonly LabelId[];
	projectId: ProjectId;
	estimate?: number | null;
}

interface ActivityEventBase {
	id: ActivityEventId;
	at: number;
	actorId: UserId;
}

export interface IssueCreatedEvent extends ActivityEventBase {
	type: 'issue_created';
	issueId: IssueId;
	/** The full issue, so replay can reconstruct it without re-running the generator. */
	issue: Issue;
}

export interface IssueFieldChangedEvent extends ActivityEventBase {
	type: 'issue_field_changed';
	issueId: IssueId;
	field: EditableIssueField;
	from: IssueFieldValue;
	to: IssueFieldValue;
}

export interface IssueCommentedEvent extends ActivityEventBase {
	type: 'issue_commented';
	issueId: IssueId;
	comment: Comment;
}

export interface IssueDeletedEvent extends ActivityEventBase {
	type: 'issue_deleted';
	issueId: IssueId;
}

/** Undo of a delete. Without it, an undo toast could not survive a reload. */
export interface IssueRestoredEvent extends ActivityEventBase {
	type: 'issue_restored';
	issueId: IssueId;
}

/** Every event that belongs to one issue's activity feed. */
export type IssueActivityEvent =
	| IssueCreatedEvent
	| IssueFieldChangedEvent
	| IssueCommentedEvent
	| IssueDeletedEvent
	| IssueRestoredEvent;

/**
 * Label creation is a mutation that has to survive a reload, but it belongs to no issue — so it
 * lives in the same log without an `issueId` and is filtered out of issue activity feeds.
 */
export interface LabelCreatedEvent extends ActivityEventBase {
	type: 'label_created';
	label: Label;
}

export type ActivityEvent = IssueActivityEvent | LabelCreatedEvent;

export type ActivityEventType = ActivityEvent['type'];

export function isIssueStatus(value: unknown): value is IssueStatus {
	return typeof value === 'string' && (ISSUE_STATUSES as readonly string[]).includes(value);
}

export function isIssuePriority(value: unknown): value is IssuePriority {
	return typeof value === 'string' && (ISSUE_PRIORITIES as readonly string[]).includes(value);
}

export function isEditableIssueField(value: unknown): value is EditableIssueField {
	return typeof value === 'string' && (EDITABLE_ISSUE_FIELDS as readonly string[]).includes(value);
}

export function isIssueActivityEvent(event: ActivityEvent): event is IssueActivityEvent {
	return event.type !== 'label_created';
}
