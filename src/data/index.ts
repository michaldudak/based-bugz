/**
 * The public surface of the data layer.
 *
 * Everything above `data/` imports from `@/data` and nothing deeper. `InMemoryRepository` is
 * deliberately absent: app code sees the `Repository` interface through `useRepository()`, and only
 * `provider.tsx` ever constructs one (AGENTS.md — Import rules).
 */

export type {
	ActivityEvent,
	ActivityEventId,
	ActivityEventType,
	Comment,
	CommentId,
	EditableIssueField,
	Issue,
	IssueActivityEvent,
	IssueCommentedEvent,
	IssueCreatedEvent,
	IssueDeletedEvent,
	IssueFieldChangedEvent,
	IssueFieldValue,
	IssueId,
	IssuePatch,
	IssuePriority,
	IssueRestoredEvent,
	IssueStatus,
	Label,
	LabelCreatedEvent,
	LabelId,
	NewIssue,
	Project,
	ProjectId,
	User,
	UserId,
} from './types';

export {
	EDITABLE_ISSUE_FIELDS,
	ISSUE_PRIORITIES,
	ISSUE_STATUSES,
	PRIORITY_RANK,
	STATUS_RANK,
	isEditableIssueField,
	isIssueActivityEvent,
	isIssuePriority,
	isIssueStatus,
} from './types';

export type {
	ActivityRepository,
	CommentsRepository,
	IssueFilter,
	IssueQuery,
	IssueSort,
	IssueSortField,
	IssuesRepository,
	LabelQuery,
	LabelsRepository,
	MutationOptions,
	NewComment,
	NewLabel,
	Page,
	PageRequest,
	ProjectsRepository,
	ReadOptions,
	Repository,
	RepositoryErrorCode,
	SearchQuery,
	SearchRepository,
	SearchResult,
	SearchResultKind,
	SortDirection,
	UserQuery,
	UsersRepository,
} from './repository';

export {
	DEFAULT_ISSUE_SORT,
	MAX_PAGE_LIMIT,
	RepositoryError,
	SEARCH_RESULT_KINDS,
	createAbortError,
	isAbortError,
} from './repository';

export type { DataParams } from './params';
export {
	DEFAULT_DATA_PARAMS,
	MAX_LATENCY,
	MAX_SCALE,
	MIN_SCALE,
	dataParamsToSearch,
	parseDataParams,
} from './params';

export type { DatasetShape } from './generate';
export { DATA_EPOCH, datasetShape } from './generate';

export type { RepositoryProviderProps } from './provider';
export { RepositoryProvider, useRepository } from './provider';
