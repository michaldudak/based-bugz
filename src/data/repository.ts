/**
 * The contract the whole app codes against.
 *
 * Every read is async, abortable and cursor-paginated even though today's implementation is an
 * in-memory generator (AGENTS.md — evaluation rule 3). The moment one picker gets a synchronous
 * array it stops testing anything, and `InMemoryRepository` must be replaceable by an
 * `HttpRepository` with no app changes.
 *
 * This file declares the contract — types, the error class, and the constants that belong with
 * them. It imports nothing but the domain model, and holds no implementation.
 */

import type {
	Comment,
	Issue,
	IssueActivityEvent,
	IssueId,
	IssuePatch,
	IssuePriority,
	IssueStatus,
	Label,
	LabelId,
	NewIssue,
	Project,
	ProjectId,
	User,
	UserId,
} from './types';

/* -------------------------------------------------------------------------------------------- */
/* Paging                                                                                         */
/* -------------------------------------------------------------------------------------------- */

export interface PageRequest {
	/** Opaque cursor from the previous page's `nextCursor`. Absent means "first page". */
	cursor?: string;
	limit: number;
	signal?: AbortSignal;
}

export interface Page<T> {
	items: T[];
	/** Absent means there is no next page. */
	nextCursor?: string;
	/**
	 * Deliberately optional (AGENTS.md — evaluation rule 4). It is present only where the count is
	 * genuinely cheap; a filtered issue query omits it, because counting matches would mean walking
	 * the whole dataset and the point is to force the UI to cope with not knowing.
	 */
	total?: number;
}

/** Reads that address entities directly rather than paging over them. */
export interface ReadOptions {
	signal?: AbortSignal;
}

/**
 * Writes always name an actor: the signed-in user drives comment authorship and every activity
 * entry, so there is no default and no ambient "current user" inside the repository.
 */
export interface MutationOptions {
	actorId: UserId;
	signal?: AbortSignal;
}

/* -------------------------------------------------------------------------------------------- */
/* Errors                                                                                         */
/* -------------------------------------------------------------------------------------------- */

export type RepositoryErrorCode =
	| 'not_found'
	| 'invalid_cursor'
	| 'invalid_request'
	/** Injected by `?errorRate=`, so optimistic updates have something real to roll back from. */
	| 'transient';

export class RepositoryError extends Error {
	readonly code: RepositoryErrorCode;

	constructor(code: RepositoryErrorCode, message: string) {
		super(message);
		this.name = 'RepositoryError';
		this.code = code;
	}
}

/**
 * Aborts reject with a `DOMException` named `AbortError`, matching `fetch`. App code and TanStack
 * Query both key off the name, so an aborted read must never look like a failed one.
 */
export function createAbortError(): DOMException {
	return new DOMException('The operation was aborted.', 'AbortError');
}

export function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}

/* -------------------------------------------------------------------------------------------- */
/* Queries                                                                                        */
/* -------------------------------------------------------------------------------------------- */

export interface UserQuery {
	/** Matched against name, email, title and team. Case- and diacritic-insensitive. */
	text?: string;
	teams?: readonly string[];
}

export interface LabelQuery {
	text?: string;
}

export interface IssueFilter {
	/** Matched against key, title and description. */
	text?: string;
	status?: readonly IssueStatus[];
	priority?: readonly IssuePriority[];
	assigneeIds?: readonly UserId[];
	/** Unions with `assigneeIds` rather than intersecting it: "mine or nobody's" is a real filter. */
	unassigned?: boolean;
	reporterIds?: readonly UserId[];
	labelIds?: readonly LabelId[];
	/** How `labelIds` combine. Defaults to `any`. */
	labelMatch?: 'any' | 'all';
	projectIds?: readonly ProjectId[];
}

export type IssueSortField = 'created' | 'updated' | 'priority' | 'status' | 'title' | 'key';

export type SortDirection = 'asc' | 'desc';

export interface IssueSort {
	field: IssueSortField;
	direction: SortDirection;
}

export interface IssueQuery {
	filter?: IssueFilter;
	/** Defaults to `DEFAULT_ISSUE_SORT`. */
	sort?: IssueSort;
}

/** Newest first. The only sort an implementation can serve without ordering the dataset first. */
export const DEFAULT_ISSUE_SORT: IssueSort = { field: 'created', direction: 'desc' };

/** Anything larger is a caller bug, not a page. */
export const MAX_PAGE_LIMIT = 500;

export const SEARCH_RESULT_KINDS = ['issue', 'user', 'label', 'project'] as const;

export type SearchResultKind = (typeof SEARCH_RESULT_KINDS)[number];

/**
 * The command palette's union result. Sections come back in `SEARCH_RESULT_KINDS` order and the
 * rows have genuinely different heights, which is what makes the palette worth building.
 */
export type SearchResult =
	| { kind: 'issue'; id: IssueId; issue: Issue }
	| { kind: 'user'; id: UserId; user: User }
	| { kind: 'label'; id: LabelId; label: Label }
	| { kind: 'project'; id: ProjectId; project: Project };

export interface SearchQuery {
	text: string;
	/** Restrict to some kinds. Defaults to all of them. */
	kinds?: readonly SearchResultKind[];
}

export interface NewLabel {
	name: string;
	/** 0-360. Derived from the name when omitted, so the same name always looks the same. */
	hue?: number;
}

export interface NewComment {
	issueId: IssueId;
	body: string;
}

/* -------------------------------------------------------------------------------------------- */
/* Groups                                                                                         */
/* -------------------------------------------------------------------------------------------- */

export interface UsersRepository {
	/** `total` only when `query` is empty. */
	search(query: UserQuery, page: PageRequest): Promise<Page<User>>;
	/** Found users in the order requested. Unknown ids are dropped, never thrown on. */
	byIds(ids: readonly UserId[], options?: ReadOptions): Promise<User[]>;
}

export interface LabelsRepository {
	/** `total` only when `query` is empty. */
	search(query: LabelQuery, page: PageRequest): Promise<Page<Label>>;
	byIds(ids: readonly LabelId[], options?: ReadOptions): Promise<Label[]>;
	create(input: NewLabel, options: MutationOptions): Promise<Label>;
}

export interface ProjectsRepository {
	/** Always reports `total`: the project count is small and known. */
	list(page: PageRequest): Promise<Page<Project>>;
	byIds(ids: readonly ProjectId[], options?: ReadOptions): Promise<Project[]>;
}

export interface IssuesRepository {
	/** `total` only when `query.filter` selects everything. */
	list(query: IssueQuery, page: PageRequest): Promise<Page<Issue>>;
	/** `null` rather than a throw, so "deleted while you were looking at it" is expressible. */
	byId(id: IssueId, options?: ReadOptions): Promise<Issue | null>;
	create(input: NewIssue, options: MutationOptions): Promise<Issue>;
	update(id: IssueId, patch: IssuePatch, options: MutationOptions): Promise<Issue>;
	delete(id: IssueId, options: MutationOptions): Promise<void>;
	/** Undo for `delete`. Without it an undo toast could not survive a reload. */
	restore(id: IssueId, options: MutationOptions): Promise<Issue>;
	/** Partial success is not a thing: either every id updates or the call rejects. */
	bulkUpdate(
		ids: readonly IssueId[],
		patch: IssuePatch,
		options: MutationOptions,
	): Promise<Issue[]>;
}

export interface CommentsRepository {
	/** Oldest first. Always reports `total`: a thread's length is cheap to know. */
	list(issueId: IssueId, page: PageRequest): Promise<Page<Comment>>;
	create(input: NewComment, options: MutationOptions): Promise<Comment>;
}

export interface ActivityRepository {
	/** Oldest first, including a synthesized creation entry for generated issues. */
	list(issueId: IssueId, page: PageRequest): Promise<Page<IssueActivityEvent>>;
}

export interface SearchRepository {
	/** Never reports `total`: the palette must render usefully without knowing the count. */
	query(query: SearchQuery, page: PageRequest): Promise<Page<SearchResult>>;
}

export interface Repository {
	users: UsersRepository;
	labels: LabelsRepository;
	projects: ProjectsRepository;
	issues: IssuesRepository;
	comments: CommentsRepository;
	activity: ActivityRepository;
	search: SearchRepository;

	/** Fires after every mutation, so caches can invalidate without polling. */
	subscribe(listener: () => void): () => void;

	/** Drop every persisted mutation and return to freshly generated data. */
	reset(): void;
}
