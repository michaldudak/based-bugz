/**
 * `InMemoryRepository` — the only implementation of `Repository` today.
 *
 * Three things make it worth its size:
 *
 * 1. **Filtering, sorting and pagination happen here.** A component that filters a full array
 *    client-side has stopped testing anything (PLAN.md — Phase 1).
 * 2. **Scans are lazy and exit early.** Nothing materializes the dataset; a page walks the sequence
 *    until it has `limit` rows and stops. Sorting by anything other than creation time does need one
 *    ordering pass, so that pass is deferred until someone actually asks for it and then cached.
 * 3. **It behaves like a server.** Simulated latency with jitter, injected failures, prompt
 *    `AbortSignal` handling, and cursors that survive concurrent edits.
 *
 * Mutations never touch generated data. They append to the event log and are replayed over it, so
 * live state and reloaded state come out of exactly one code path (`applyEvent`).
 */

import { CURSOR_VERSION, decodeCursor, encodeCursor, fingerprint } from './cursor';
import type { CursorKey } from './cursor';
import { createEventIdFactory, createEventLog } from './event-log';
import type { EventLog } from './event-log';
import {
	COMMENT_ID_PREFIX,
	DATA_EPOCH,
	ISSUE_ID_PREFIX,
	LABEL_ID_PREFIX,
	createGenerator,
	datasetShape,
	issueIdAt,
	parseGeneratedIndex,
} from './generate';
import type { DataGenerator, DatasetShape } from './generate';
import {
	DEFAULT_ISSUE_SORT,
	MAX_PAGE_LIMIT,
	RepositoryError,
	createAbortError,
} from './repository';
import type {
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
	Repository,
	SearchQuery,
	SearchRepository,
	SearchResult,
	SearchResultKind,
	SortDirection,
	UserQuery,
	UsersRepository,
} from './repository';
import { SEARCH_RESULT_KINDS } from './repository';
import {
	EDITABLE_ISSUE_FIELDS,
	PRIORITY_RANK,
	STATUS_RANK,
	isIssuePriority,
	isIssueStatus,
} from './types';
import type {
	ActivityEvent,
	Comment,
	EditableIssueField,
	Issue,
	IssueActivityEvent,
	IssueCreatedEvent,
	IssueFieldValue,
	IssueId,
	IssuePatch,
	Label,
	LabelId,
	NewIssue,
	Project,
	ProjectId,
	User,
	UserId,
} from './types';
import { hash32 } from './rng';

/* -------------------------------------------------------------------------------------------- */
/* Text folding and matching                                                                      */
/* -------------------------------------------------------------------------------------------- */

const COMBINING_MARKS = /\p{M}+/gu;

/**
 * Case- and diacritic-insensitive folding. `Álex` has to match `alex`, because the generator makes
 * a point of producing both under one apparent name.
 */
export function foldText(text: string): string {
	return text.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase();
}

function matchesUserText(user: User, needle: string): boolean {
	return (
		foldText(user.name).includes(needle) ||
		foldText(user.email).includes(needle) ||
		foldText(user.title).includes(needle) ||
		foldText(user.team).includes(needle)
	);
}

function matchesLabelText(label: Label, needle: string): boolean {
	return foldText(label.name).includes(needle);
}

function matchesProjectText(project: Project, needle: string): boolean {
	return foldText(project.name).includes(needle) || foldText(project.key).includes(needle);
}

function matchesIssueText(issue: Issue, needle: string): boolean {
	return (
		foldText(issue.key).includes(needle) ||
		foldText(issue.title).includes(needle) ||
		foldText(issue.description).includes(needle)
	);
}

/* -------------------------------------------------------------------------------------------- */
/* Filters                                                                                        */
/* -------------------------------------------------------------------------------------------- */

interface NormalizedIssueFilter {
	text?: string;
	status?: string[];
	priority?: string[];
	assigneeIds?: string[];
	unassigned?: true;
	reporterIds?: string[];
	labelIds?: string[];
	labelMatch?: 'any' | 'all';
	projectIds?: string[];
}

function sortedCopy(values: readonly string[] | undefined): string[] | undefined {
	return values !== undefined && values.length > 0 ? values.toSorted() : undefined;
}

/**
 * Order-insensitive and default-collapsed, so `{status:['todo','done']}` and
 * `{status:['done','todo']}` fingerprint identically and a cursor works across both.
 */
function normalizeIssueFilter(filter: IssueFilter): NormalizedIssueFilter {
	const text = filter.text?.trim() ?? '';
	const labelIds = sortedCopy(filter.labelIds);

	return {
		text: text === '' ? undefined : foldText(text),
		status: sortedCopy(filter.status),
		priority: sortedCopy(filter.priority),
		assigneeIds: sortedCopy(filter.assigneeIds),
		unassigned: filter.unassigned === true ? true : undefined,
		reporterIds: sortedCopy(filter.reporterIds),
		labelIds,
		labelMatch: labelIds === undefined ? undefined : (filter.labelMatch ?? 'any'),
		projectIds: sortedCopy(filter.projectIds),
	};
}

function isEmptyIssueFilter(filter: NormalizedIssueFilter): boolean {
	return Object.values(filter).every((value) => value === undefined);
}

function matchesIssueFilter(issue: Issue, filter: NormalizedIssueFilter): boolean {
	if (filter.status !== undefined && !filter.status.includes(issue.status)) {
		return false;
	}

	if (filter.priority !== undefined && !filter.priority.includes(issue.priority)) {
		return false;
	}

	if (filter.projectIds !== undefined && !filter.projectIds.includes(issue.projectId)) {
		return false;
	}

	if (filter.reporterIds !== undefined && !filter.reporterIds.includes(issue.reporterId)) {
		return false;
	}

	if (filter.assigneeIds !== undefined || filter.unassigned !== undefined) {
		const byAssignee =
			issue.assigneeId !== null && (filter.assigneeIds?.includes(issue.assigneeId) ?? false);
		const byUnassigned = filter.unassigned === true && issue.assigneeId === null;

		if (!byAssignee && !byUnassigned) {
			return false;
		}
	}

	if (filter.labelIds !== undefined) {
		const matches =
			filter.labelMatch === 'all'
				? filter.labelIds.every((id) => issue.labelIds.includes(id))
				: filter.labelIds.some((id) => issue.labelIds.includes(id));

		if (!matches) {
			return false;
		}
	}

	if (filter.text !== undefined && !matchesIssueText(issue, filter.text)) {
		return false;
	}

	return true;
}

/* -------------------------------------------------------------------------------------------- */
/* Sorting                                                                                        */
/* -------------------------------------------------------------------------------------------- */

type IssueSortKey = number | string;

interface IssueOrder {
	slots: Int32Array;
	/** Parallel to `slots`, so resuming from a cursor never has to touch an entity. */
	keys: IssueSortKey[];
	ids: string[];
}

function issueKeyNumber(key: string): number {
	const match = /(\d+)$/.exec(key);

	return match?.[1] === undefined ? 0 : Number(match[1]);
}

function issueSortKey(issue: Issue, field: IssueSortField): IssueSortKey {
	switch (field) {
		case 'created':
			return issue.createdAt;
		case 'updated':
			return issue.updatedAt;
		case 'priority':
			return PRIORITY_RANK[issue.priority];
		case 'status':
			return STATUS_RANK[issue.status];
		case 'title':
			return issue.title;
		case 'key':
			return issueKeyNumber(issue.key);
	}
}

function compareStrings(a: string, b: string): number {
	// Code-unit order, not `localeCompare`: a cursor has to mean the same thing on every engine,
	// and ICU collation is not guaranteed to agree across them.
	return a < b ? -1 : a > b ? 1 : 0;
}

function compareSortKeys(a: IssueSortKey, b: IssueSortKey): number {
	if (typeof a === 'number' && typeof b === 'number') {
		return a - b;
	}

	return compareStrings(String(a), String(b));
}

/* -------------------------------------------------------------------------------------------- */
/* Repository                                                                                     */
/* -------------------------------------------------------------------------------------------- */

export interface InMemoryRepositoryOptions {
	seed: string;
	scale: number;
	/** Simulated round-trip in ms, applied with ±30% jitter. */
	latency?: number;
	errorRate?: number;
	/** Share one with `persistEventLog` so writes survive a reload. */
	log?: EventLog;
	now?: () => number;
	/**
	 * Deliberately unseeded by default: a seeded failure roll would make the same call fail forever
	 * and a retry pointless, which is the opposite of what `?errorRate=` is for.
	 */
	random?: () => number;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted === true) {
		throw createAbortError();
	}
}

function normalizeLimit(limit: number): number {
	if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_PAGE_LIMIT) {
		throw new RepositoryError(
			'invalid_request',
			`limit must be an integer in [1, ${MAX_PAGE_LIMIT}], received ${limit}`,
		);
	}

	return limit;
}

function fieldValuesEqual(a: IssueFieldValue, b: IssueFieldValue): boolean {
	// `labelIds` is the only array-valued field, so a shallow element compare is the whole story.
	if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
		return a.length === b.length && a.every((value, index) => value === b[index]);
	}

	return a === b;
}

export class InMemoryRepository implements Repository {
	readonly users: UsersRepository;
	readonly labels: LabelsRepository;
	readonly projects: ProjectsRepository;
	readonly issues: IssuesRepository;
	readonly comments: CommentsRepository;
	readonly activity: ActivityRepository;
	readonly search: SearchRepository;

	readonly shape: DatasetShape;
	readonly log: EventLog;

	private readonly generator: DataGenerator;
	private readonly latency: number;
	private readonly errorRate: number;
	private readonly now: () => number;
	private readonly random: () => number;
	private readonly nextEventId: () => string;

	/** Current state for every issue that was created or edited. Generated issues stay pure. */
	private issueState = new Map<IssueId, Issue>();
	private deletedIssues = new Set<IssueId>();
	/** Creation order. Slot 0 is the newest, so the default sort needs no ordering pass. */
	private createdIssueOrder: IssueId[] = [];
	/** Appended after the generated labels, so existing label indices never shift. */
	private createdLabels: Label[] = [];
	private extraComments = new Map<IssueId, Comment[]>();
	private issueEvents = new Map<IssueId, IssueActivityEvent[]>();
	private orderCache = new Map<string, IssueOrder>();
	private listeners = new Set<() => void>();
	private lastTimestamp = DATA_EPOCH;
	private entitySequence = 0;

	constructor(options: InMemoryRepositoryOptions) {
		this.shape = datasetShape(options.seed, options.scale);
		this.generator = createGenerator(this.shape);
		this.log = options.log ?? createEventLog();
		this.latency = Math.max(0, options.latency ?? 0);
		this.errorRate = Math.min(Math.max(options.errorRate ?? 0, 0), 1);
		this.now = options.now ?? (() => Date.now());
		this.random = options.random ?? (() => Math.random());
		this.nextEventId = createEventIdFactory(this.log.events().length);

		this.replay();

		this.users = {
			search: (query, page) => this.read(page.signal, () => this.searchUsersSync(query, page)),
			byIds: (ids, readOptions) =>
				this.read(readOptions?.signal, () =>
					ids.map((id) => this.userById(id)).filter((user): user is User => user !== null),
				),
		};

		this.labels = {
			search: (query, page) => this.read(page.signal, () => this.searchLabelsSync(query, page)),
			byIds: (ids, readOptions) =>
				this.read(readOptions?.signal, () =>
					ids.map((id) => this.labelById(id)).filter((label): label is Label => label !== null),
				),
			create: (input, mutationOptions) =>
				this.mutate(mutationOptions, () => this.createLabelSync(input, mutationOptions)),
		};

		this.projects = {
			list: (page) => this.read(page.signal, () => this.listProjectsSync(page)),
			byIds: (ids, readOptions) =>
				this.read(readOptions?.signal, () =>
					ids
						.map((id) => this.projectById(id))
						.filter((project): project is Project => project !== null),
				),
		};

		this.issues = {
			list: (query, page) => this.read(page.signal, () => this.listIssuesSync(query, page)),
			byId: (id, readOptions) => this.read(readOptions?.signal, () => this.issueSnapshot(id)),
			create: (input, mutationOptions) =>
				this.mutate(mutationOptions, () => this.createIssueSync(input, mutationOptions)),
			update: (id, patch, mutationOptions) =>
				this.mutate(mutationOptions, () => this.updateIssueSync(id, patch, mutationOptions)),
			delete: (id, mutationOptions) =>
				this.mutate(mutationOptions, () => this.deleteIssueSync(id, mutationOptions)),
			restore: (id, mutationOptions) =>
				this.mutate(mutationOptions, () => this.restoreIssueSync(id, mutationOptions)),
			bulkUpdate: (ids, patch, mutationOptions) =>
				this.mutate(mutationOptions, () =>
					ids.map((id) => this.updateIssueSync(id, patch, mutationOptions)),
				),
		};

		this.comments = {
			list: (issueId, page) => this.read(page.signal, () => this.listCommentsSync(issueId, page)),
			create: (input, mutationOptions) =>
				this.mutate(mutationOptions, () => this.createCommentSync(input, mutationOptions)),
		};

		this.activity = {
			list: (issueId, page) => this.read(page.signal, () => this.listActivitySync(issueId, page)),
		};

		this.search = {
			query: (query, page) => this.read(page.signal, () => this.searchSync(query, page)),
		};
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}

	reset(): void {
		this.log.clear();
		this.replay();
		this.notify();
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Async gates                                                                                */
	/* ---------------------------------------------------------------------------------------- */

	private sleep(signal: AbortSignal | undefined): Promise<void> {
		const jitter = 0.7 + this.random() * 0.6;
		const ms = Math.round(this.latency * jitter);

		return new Promise((resolve, reject) => {
			let timer: ReturnType<typeof setTimeout>;

			const onAbort = (): void => {
				clearTimeout(timer);
				reject(createAbortError());
			};

			timer = setTimeout(() => {
				signal?.removeEventListener('abort', onAbort);
				resolve();
			}, ms);

			signal?.addEventListener('abort', onAbort, { once: true });
		});
	}

	private maybeFail(): void {
		if (this.errorRate > 0 && this.random() < this.errorRate) {
			throw new RepositoryError('transient', 'Injected repository failure (?errorRate)');
		}
	}

	private async read<T>(signal: AbortSignal | undefined, produce: () => T): Promise<T> {
		throwIfAborted(signal);
		await this.sleep(signal);
		throwIfAborted(signal);
		this.maybeFail();

		return produce();
	}

	private async mutate<T>(options: MutationOptions, produce: () => T): Promise<T> {
		throwIfAborted(options.signal);
		await this.sleep(options.signal);
		throwIfAborted(options.signal);
		this.maybeFail();

		const result = produce();

		// Any write can move a row in any ordering, and orderings are cheap to rebuild lazily.
		this.orderCache.clear();
		this.notify();

		return result;
	}

	private notify(): void {
		// Iterating the Set directly is safe: an entry removed during iteration is simply skipped.
		for (const listener of this.listeners) {
			listener();
		}
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Entity access                                                                              */
	/* ---------------------------------------------------------------------------------------- */

	private userById(id: UserId): User | null {
		return this.generator.userById(id);
	}

	private labelById(id: LabelId): Label | null {
		const generated = this.generator.labelById(id);

		if (generated !== null) {
			return generated;
		}

		return this.createdLabels.find((label) => label.id === id) ?? null;
	}

	private projectById(id: ProjectId): Project | null {
		return this.generator.projectById(id);
	}

	private labelCount(): number {
		return this.shape.labels + this.createdLabels.length;
	}

	private labelAt(index: number): Label | null {
		if (index < 0) {
			return null;
		}

		if (index < this.shape.labels) {
			return this.generator.label(index);
		}

		return this.createdLabels[index - this.shape.labels] ?? null;
	}

	private issueSnapshot(id: IssueId): Issue | null {
		if (this.deletedIssues.has(id)) {
			return null;
		}

		return this.issueState.get(id) ?? this.generator.issueById(id);
	}

	private issueSlotCount(): number {
		return this.shape.issues + this.createdIssueOrder.length;
	}

	private issueIdAtSlot(slot: number): IssueId | null {
		const createdCount = this.createdIssueOrder.length;

		if (slot < 0) {
			return null;
		}

		if (slot < createdCount) {
			return this.createdIssueOrder[createdCount - 1 - slot] ?? null;
		}

		const index = slot - createdCount;

		return index < this.shape.issues ? issueIdAt(index) : null;
	}

	private issueAtSlot(slot: number): Issue | null {
		const id = this.issueIdAtSlot(slot);

		return id === null ? null : this.issueSnapshot(id);
	}

	/**
	 * Creation time at a slot, tombstones included. `createdAt` is not editable, so the natural
	 * sequence stays strictly monotonic through any amount of editing — which is what lets the
	 * default sort resume from a cursor by binary search instead of a rescan.
	 */
	private issueCreatedAtSlot(slot: number): number | null {
		const id = this.issueIdAtSlot(slot);

		if (id === null) {
			return null;
		}

		const issue = this.issueState.get(id) ?? this.generator.issueById(id);

		return issue?.createdAt ?? null;
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Issue ordering                                                                             */
	/* ---------------------------------------------------------------------------------------- */

	private naturalSlot(position: number, direction: SortDirection, count: number): number {
		return direction === 'desc' ? position : count - 1 - position;
	}

	private naturalResumePosition(key: number, direction: SortDirection): number {
		const count = this.issueSlotCount();
		let low = 0;
		let high = count;

		while (low < high) {
			const mid = (low + high) >>> 1;
			const at = this.issueCreatedAtSlot(this.naturalSlot(mid, direction, count));
			const passed = at === null || (direction === 'desc' ? at < key : at > key);

			if (passed) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}

		return low;
	}

	/**
	 * One ordering pass over the whole dataset, cached until the next mutation. Deferred until a
	 * non-default sort is actually requested, so boot cost stays zero at any `?scale=`.
	 */
	private issueOrderFor(sort: IssueSort): IssueOrder {
		const cacheKey = `${sort.field}:${sort.direction}`;
		const cached = this.orderCache.get(cacheKey);

		if (cached !== undefined) {
			return cached;
		}

		const count = this.issueSlotCount();
		const entries: { slot: number; key: IssueSortKey; id: string }[] = [];

		for (let slot = 0; slot < count; slot += 1) {
			const issue = this.issueAtSlot(slot);

			if (issue !== null) {
				entries.push({ slot, key: issueSortKey(issue, sort.field), id: issue.id });
			}
		}

		const sign = sort.direction === 'asc' ? 1 : -1;

		// The id tiebreak follows the same direction, so reversing the sort exactly reverses the
		// sequence — otherwise paging forward and backward would disagree about tied rows.
		entries.sort((a, b) => sign * (compareSortKeys(a.key, b.key) || compareStrings(a.id, b.id)));

		const slots = new Int32Array(entries.length);
		const keys: IssueSortKey[] = [];
		const ids: string[] = [];

		entries.forEach((entry, position) => {
			slots[position] = entry.slot;
			keys.push(entry.key);
			ids.push(entry.id);
		});

		const order: IssueOrder = { slots, keys, ids };

		this.orderCache.set(cacheKey, order);

		return order;
	}

	private orderedResumePosition(
		order: IssueOrder,
		direction: SortDirection,
		key: CursorKey,
		id: string,
	): number {
		const sign = direction === 'asc' ? 1 : -1;
		const target: IssueSortKey = key === null ? '' : key;
		let low = 0;
		let high = order.keys.length;

		while (low < high) {
			const mid = (low + high) >>> 1;
			const midKey = order.keys[mid];
			const midId = order.ids[mid];

			if (midKey === undefined || midId === undefined) {
				high = mid;
				continue;
			}

			const comparison = sign * (compareSortKeys(midKey, target) || compareStrings(midId, id));

			if (comparison > 0) {
				high = mid;
			} else {
				low = mid + 1;
			}
		}

		return low;
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Reads                                                                                      */
	/* ---------------------------------------------------------------------------------------- */

	private listIssuesSync(query: IssueQuery, page: PageRequest): Page<Issue> {
		const limit = normalizeLimit(page.limit);
		const sort = query.sort ?? DEFAULT_ISSUE_SORT;
		const filter = normalizeIssueFilter(query.filter ?? {});
		const guard = fingerprint({ filter, sort });
		const natural = sort.field === 'created';
		const order = natural ? null : this.issueOrderFor(sort);
		const length = order === null ? this.issueSlotCount() : order.slots.length;

		let position = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'issues', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			position =
				order === null
					? this.naturalResumePosition(typeof cursor.k === 'number' ? cursor.k : 0, sort.direction)
					: this.orderedResumePosition(order, sort.direction, cursor.k ?? null, cursor.r ?? '');
		}

		const items: Issue[] = [];
		let last: Issue | null = null;

		while (position < length && items.length < limit) {
			const slot =
				order === null
					? this.naturalSlot(position, sort.direction, length)
					: (order.slots[position] ?? -1);

			position += 1;

			const issue = this.issueAtSlot(slot);

			if (issue === null || !matchesIssueFilter(issue, filter)) {
				continue;
			}

			items.push(issue);
			last = issue;
		}

		const result: Page<Issue> = { items };

		// Rule 4: the count is offered only where it is genuinely free. Counting a filtered query
		// would mean walking the whole dataset, which is exactly what the UI must cope without.
		if (isEmptyIssueFilter(filter)) {
			result.total =
				order === null ? this.issueSlotCount() - this.deletedIssues.size : order.slots.length;
		}

		if (items.length === limit && position < length && last !== null) {
			result.nextCursor = encodeCursor({
				v: CURSOR_VERSION,
				t: 'issues',
				g: guard,
				i: position - 1,
				k: issueSortKey(last, sort.field),
				r: last.id,
			});
		}

		return result;
	}

	private searchUsersSync(query: UserQuery, page: PageRequest): Page<User> {
		const limit = normalizeLimit(page.limit);
		const text = query.text?.trim() ?? '';
		const needle = text === '' ? null : foldText(text);
		const teams = sortedCopy(query.teams);
		const guard = fingerprint({ needle, teams });

		let index = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'users', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			// Users are generated and never mutated, so their indices are stable forever and a bare
			// position is a sound cursor here.
			index = cursor.i + 1;
		}

		const items: User[] = [];
		let lastIndex = -1;

		while (index < this.shape.users && items.length < limit) {
			const user = this.generator.user(index);
			const current = index;
			index += 1;

			if (teams !== undefined && !teams.includes(user.team)) {
				continue;
			}

			if (needle !== null && !matchesUserText(user, needle)) {
				continue;
			}

			items.push(user);
			lastIndex = current;
		}

		const result: Page<User> = { items };

		if (needle === null && teams === undefined) {
			result.total = this.shape.users;
		}

		if (items.length === limit && index < this.shape.users && lastIndex >= 0) {
			result.nextCursor = encodeCursor({ v: CURSOR_VERSION, t: 'users', g: guard, i: lastIndex });
		}

		return result;
	}

	private searchLabelsSync(query: LabelQuery, page: PageRequest): Page<Label> {
		const limit = normalizeLimit(page.limit);
		const text = query.text?.trim() ?? '';
		const needle = text === '' ? null : foldText(text);
		const guard = fingerprint({ needle });
		const count = this.labelCount();

		let index = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'labels', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			index = cursor.i + 1;
		}

		const items: Label[] = [];
		let lastIndex = -1;

		while (index < count && items.length < limit) {
			const label = this.labelAt(index);
			const current = index;
			index += 1;

			if (label === null || (needle !== null && !matchesLabelText(label, needle))) {
				continue;
			}

			items.push(label);
			lastIndex = current;
		}

		const result: Page<Label> = { items };

		if (needle === null) {
			result.total = count;
		}

		if (items.length === limit && index < count && lastIndex >= 0) {
			result.nextCursor = encodeCursor({ v: CURSOR_VERSION, t: 'labels', g: guard, i: lastIndex });
		}

		return result;
	}

	private listProjectsSync(page: PageRequest): Page<Project> {
		const limit = normalizeLimit(page.limit);
		const guard = fingerprint({ t: 'projects' });
		const count = this.shape.projects;

		let index = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'projects', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			index = cursor.i + 1;
		}

		const items: Project[] = [];
		let lastIndex = -1;

		while (index < count && items.length < limit) {
			items.push(this.generator.project(index));
			lastIndex = index;
			index += 1;
		}

		const result: Page<Project> = { items, total: count };

		if (items.length === limit && index < count && lastIndex >= 0) {
			result.nextCursor = encodeCursor({
				v: CURSOR_VERSION,
				t: 'projects',
				g: guard,
				i: lastIndex,
			});
		}

		return result;
	}

	private commentsFor(issueId: IssueId): readonly Comment[] {
		const index = parseGeneratedIndex(ISSUE_ID_PREFIX, issueId);
		const generated =
			index !== null && index < this.shape.issues ? this.generator.comments(index) : [];
		const extra = this.extraComments.get(issueId);

		return extra === undefined || extra.length === 0 ? generated : [...generated, ...extra];
	}

	private listCommentsSync(issueId: IssueId, page: PageRequest): Page<Comment> {
		const limit = normalizeLimit(page.limit);
		const guard = fingerprint({ issueId });
		const all = this.commentsFor(issueId);

		let index = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'comments', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			index = cursor.i + 1;
		}

		const items = all.slice(index, index + limit);
		const nextIndex = index + items.length;
		const result: Page<Comment> = { items, total: all.length };

		if (nextIndex < all.length) {
			result.nextCursor = encodeCursor({
				v: CURSOR_VERSION,
				t: 'comments',
				g: guard,
				i: nextIndex - 1,
			});
		}

		return result;
	}

	private activityFor(issueId: IssueId): IssueActivityEvent[] {
		const recorded = this.issueEvents.get(issueId) ?? [];
		const index = parseGeneratedIndex(ISSUE_ID_PREFIX, issueId);

		if (index === null || index >= this.shape.issues) {
			return [...recorded];
		}

		// Generated issues have no creation event in the log, so synthesize one. It is derived
		// purely from the issue, which makes it as deterministic as the issue itself.
		const issue = this.generator.issue(index);
		const created: IssueCreatedEvent = {
			id: `synthetic-created-${issue.id}`,
			type: 'issue_created',
			at: issue.createdAt,
			actorId: issue.reporterId,
			issueId: issue.id,
			issue,
		};

		return [created, ...recorded];
	}

	private listActivitySync(issueId: IssueId, page: PageRequest): Page<IssueActivityEvent> {
		const limit = normalizeLimit(page.limit);
		const guard = fingerprint({ issueId });
		const all = this.activityFor(issueId);

		let index = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'activity', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			index = cursor.i + 1;
		}

		const items = all.slice(index, index + limit);
		const nextIndex = index + items.length;
		const result: Page<IssueActivityEvent> = { items, total: all.length };

		if (nextIndex < all.length) {
			result.nextCursor = encodeCursor({
				v: CURSOR_VERSION,
				t: 'activity',
				g: guard,
				i: nextIndex - 1,
			});
		}

		return result;
	}

	private searchKindCount(kind: SearchResultKind): number {
		switch (kind) {
			case 'issue':
				return this.issueSlotCount();
			case 'user':
				return this.shape.users;
			case 'label':
				return this.labelCount();
			case 'project':
				return this.shape.projects;
		}
	}

	private searchResultAt(
		kind: SearchResultKind,
		offset: number,
		needle: string,
	): SearchResult | null {
		switch (kind) {
			case 'issue': {
				const issue = this.issueAtSlot(offset);
				return issue !== null && matchesIssueText(issue, needle)
					? { kind: 'issue', id: issue.id, issue }
					: null;
			}
			case 'user': {
				const user = this.generator.user(offset);
				return matchesUserText(user, needle) ? { kind: 'user', id: user.id, user } : null;
			}
			case 'label': {
				const label = this.labelAt(offset);
				return label !== null && matchesLabelText(label, needle)
					? { kind: 'label', id: label.id, label }
					: null;
			}
			case 'project': {
				const project = this.generator.project(offset);
				return matchesProjectText(project, needle)
					? { kind: 'project', id: project.id, project }
					: null;
			}
		}
	}

	private searchSync(query: SearchQuery, page: PageRequest): Page<SearchResult> {
		const limit = normalizeLimit(page.limit);
		const requested =
			query.kinds !== undefined && query.kinds.length > 0 ? query.kinds : SEARCH_RESULT_KINDS;
		const kinds = SEARCH_RESULT_KINDS.filter((kind) => requested.includes(kind));
		const needle = foldText(query.text.trim());
		const guard = fingerprint({ needle, kinds });

		let kindIndex = 0;
		let offset = 0;

		if (page.cursor !== undefined) {
			const cursor = decodeCursor(page.cursor, { t: 'search', g: guard });

			if (cursor === null) {
				throw new RepositoryError('invalid_cursor', 'Cursor does not belong to this query');
			}

			const resumeKind = kinds.findIndex((kind) => kind === cursor.r);
			kindIndex = resumeKind < 0 ? 0 : resumeKind;
			offset = cursor.i;
		}

		const items: SearchResult[] = [];

		// An empty query matches nothing rather than everything: the palette opens on every ⌘K and
		// returning 20k rows for a blank input would be a stress test of the wrong thing.
		if (needle !== '') {
			while (kindIndex < kinds.length && items.length < limit) {
				const kind = kinds[kindIndex];

				if (kind === undefined) {
					break;
				}

				const count = this.searchKindCount(kind);

				while (offset < count && items.length < limit) {
					const result = this.searchResultAt(kind, offset, needle);
					offset += 1;

					if (result !== null) {
						items.push(result);
					}
				}

				if (offset >= count) {
					kindIndex += 1;
					offset = 0;
				}
			}
		}

		const result: Page<SearchResult> = { items };
		const currentKind = kinds[kindIndex];

		// Never reports `total`: counting matches across four sequences is exactly the walk this
		// design refuses to do.
		if (items.length === limit && currentKind !== undefined) {
			result.nextCursor = encodeCursor({
				v: CURSOR_VERSION,
				t: 'search',
				g: guard,
				i: offset,
				r: currentKind,
			});
		}

		return result;
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Mutations                                                                                  */
	/* ---------------------------------------------------------------------------------------- */

	private nextTimestamp(): number {
		this.lastTimestamp = Math.max(this.now(), this.lastTimestamp + 1);

		return this.lastTimestamp;
	}

	private nextEntityId(prefix: string, at: number): string {
		this.entitySequence += 1;

		return `${prefix}n-${at.toString(36)}-${this.entitySequence.toString(36)}`;
	}

	private requireActor(actorId: UserId): User {
		const actor = this.userById(actorId);

		if (actor === null) {
			throw new RepositoryError('invalid_request', `Unknown actor ${actorId}`);
		}

		return actor;
	}

	private commit(event: ActivityEvent): void {
		if (!this.applyEvent(event)) {
			throw new RepositoryError('invalid_request', `Event ${event.type} could not be applied`);
		}

		this.log.append(event);
	}

	private createIssueSync(input: NewIssue, options: MutationOptions): Issue {
		this.requireActor(options.actorId);

		if (this.projectById(input.projectId) === null) {
			throw new RepositoryError('invalid_request', `Unknown project ${input.projectId}`);
		}

		const at = this.nextTimestamp();
		const issue: Issue = {
			id: this.nextEntityId(ISSUE_ID_PREFIX, at),
			key: `BUG-${1000 + this.shape.issues + this.createdIssueOrder.length}`,
			title: input.title,
			description: input.description ?? '',
			status: input.status ?? 'backlog',
			priority: input.priority ?? 'none',
			assigneeId:
				input.assigneeId != null && this.userById(input.assigneeId) !== null
					? input.assigneeId
					: null,
			reporterId: options.actorId,
			labelIds: (input.labelIds ?? []).filter((id) => this.labelById(id) !== null),
			projectId: input.projectId,
			estimate: input.estimate ?? null,
			createdAt: at,
			updatedAt: at,
		};

		this.commit({
			id: this.nextEventId(),
			type: 'issue_created',
			at,
			actorId: options.actorId,
			issueId: issue.id,
			issue,
		});

		return issue;
	}

	private updateIssueSync(id: IssueId, patch: IssuePatch, options: MutationOptions): Issue {
		this.requireActor(options.actorId);

		const current = this.issueSnapshot(id);

		if (current === null) {
			throw new RepositoryError('not_found', `Unknown issue ${id}`);
		}

		const at = this.nextTimestamp();

		// One event per changed field, which is what makes the activity tab readable and undo
		// granular. A patch that changes nothing produces no events and no `updatedAt` bump.
		for (const field of EDITABLE_ISSUE_FIELDS) {
			const to = patch[field];

			if (to === undefined) {
				continue;
			}

			const from = current[field];

			if (fieldValuesEqual(from, to)) {
				continue;
			}

			this.commit({
				id: this.nextEventId(),
				type: 'issue_field_changed',
				at,
				actorId: options.actorId,
				issueId: id,
				field,
				from,
				to,
			});
		}

		const next = this.issueSnapshot(id);

		if (next === null) {
			throw new RepositoryError('not_found', `Unknown issue ${id}`);
		}

		return next;
	}

	private deleteIssueSync(id: IssueId, options: MutationOptions): void {
		this.requireActor(options.actorId);

		if (this.issueSnapshot(id) === null) {
			throw new RepositoryError('not_found', `Unknown issue ${id}`);
		}

		this.commit({
			id: this.nextEventId(),
			type: 'issue_deleted',
			at: this.nextTimestamp(),
			actorId: options.actorId,
			issueId: id,
		});
	}

	private restoreIssueSync(id: IssueId, options: MutationOptions): Issue {
		this.requireActor(options.actorId);

		if (!this.deletedIssues.has(id)) {
			throw new RepositoryError('not_found', `Issue ${id} is not deleted`);
		}

		this.commit({
			id: this.nextEventId(),
			type: 'issue_restored',
			at: this.nextTimestamp(),
			actorId: options.actorId,
			issueId: id,
		});

		const restored = this.issueSnapshot(id);

		if (restored === null) {
			throw new RepositoryError('not_found', `Unknown issue ${id}`);
		}

		return restored;
	}

	private createCommentSync(input: NewComment, options: MutationOptions): Comment {
		this.requireActor(options.actorId);

		if (this.issueSnapshot(input.issueId) === null) {
			throw new RepositoryError('not_found', `Unknown issue ${input.issueId}`);
		}

		const at = this.nextTimestamp();
		const comment: Comment = {
			id: this.nextEntityId(COMMENT_ID_PREFIX, at),
			issueId: input.issueId,
			authorId: options.actorId,
			body: input.body,
			createdAt: at,
		};

		this.commit({
			id: this.nextEventId(),
			type: 'issue_commented',
			at,
			actorId: options.actorId,
			issueId: input.issueId,
			comment,
		});

		return comment;
	}

	private createLabelSync(input: NewLabel, options: MutationOptions): Label {
		this.requireActor(options.actorId);

		const name = input.name.trim();

		if (name === '') {
			throw new RepositoryError('invalid_request', 'Label name must not be blank');
		}

		const at = this.nextTimestamp();
		const label: Label = {
			id: this.nextEntityId(LABEL_ID_PREFIX, at),
			name,
			hue: input.hue ?? hash32(name) % 361,
		};

		this.commit({
			id: this.nextEventId(),
			type: 'label_created',
			at,
			actorId: options.actorId,
			label,
		});

		return label;
	}

	/* ---------------------------------------------------------------------------------------- */
	/* Replay                                                                                     */
	/* ---------------------------------------------------------------------------------------- */

	private replay(): void {
		this.issueState = new Map();
		this.deletedIssues = new Set();
		this.createdIssueOrder = [];
		this.createdLabels = [];
		this.extraComments = new Map();
		this.issueEvents = new Map();
		this.orderCache = new Map();
		this.lastTimestamp = DATA_EPOCH;

		for (const event of this.log.events()) {
			// Events that reference entities this seed/scale no longer produces are dropped, never
			// thrown on (PLAN.md — Things that will be subtle).
			this.applyEvent(event);
			this.lastTimestamp = Math.max(this.lastTimestamp, event.at);
		}
	}

	private recordIssueEvent(event: IssueActivityEvent): void {
		const existing = this.issueEvents.get(event.issueId);

		if (existing === undefined) {
			this.issueEvents.set(event.issueId, [event]);
		} else {
			existing.push(event);
		}
	}

	/** `false` means the event was dropped because something it references is gone. */
	private applyEvent(event: ActivityEvent): boolean {
		if (this.userById(event.actorId) === null) {
			return false;
		}

		switch (event.type) {
			case 'label_created': {
				if (this.labelById(event.label.id) !== null) {
					return false;
				}

				this.createdLabels.push({
					id: event.label.id,
					name: event.label.name,
					hue: ((Math.round(event.label.hue) % 361) + 361) % 361,
				});

				return true;
			}

			case 'issue_created': {
				if (event.issue.id !== event.issueId || this.issueSnapshot(event.issueId) !== null) {
					return false;
				}

				const issue = this.sanitizeIssue(event.issue);

				if (issue === null) {
					return false;
				}

				this.issueState.set(issue.id, issue);
				this.createdIssueOrder.push(issue.id);
				this.recordIssueEvent(event);

				return true;
			}

			case 'issue_field_changed': {
				const current = this.issueSnapshot(event.issueId);

				if (current === null) {
					return false;
				}

				const next = this.applyFieldChange(current, event.field, event.to);

				if (next === null) {
					return false;
				}

				this.issueState.set(next.id, { ...next, updatedAt: event.at });
				this.recordIssueEvent(event);

				return true;
			}

			case 'issue_commented': {
				if (
					this.issueSnapshot(event.issueId) === null ||
					this.userById(event.comment.authorId) === null
				) {
					return false;
				}

				const existing = this.extraComments.get(event.issueId) ?? [];

				if (existing.some((comment) => comment.id === event.comment.id)) {
					return false;
				}

				this.extraComments.set(event.issueId, [
					...existing,
					{ ...event.comment, issueId: event.issueId },
				]);
				this.recordIssueEvent(event);

				return true;
			}

			case 'issue_deleted': {
				if (this.issueSnapshot(event.issueId) === null) {
					return false;
				}

				this.deletedIssues.add(event.issueId);
				this.recordIssueEvent(event);

				return true;
			}

			case 'issue_restored': {
				if (!this.deletedIssues.has(event.issueId)) {
					return false;
				}

				this.deletedIssues.delete(event.issueId);
				this.recordIssueEvent(event);

				return true;
			}
		}
	}

	/**
	 * Drops references the current `(seed, scale)` cannot resolve. A missing reporter or project
	 * makes the issue itself unrepresentable, so the event goes; a missing assignee or label is
	 * survivable and is simply removed.
	 */
	private sanitizeIssue(issue: Issue): Issue | null {
		if (this.userById(issue.reporterId) === null || this.projectById(issue.projectId) === null) {
			return null;
		}

		return {
			...issue,
			assigneeId:
				issue.assigneeId !== null && this.userById(issue.assigneeId) !== null
					? issue.assigneeId
					: null,
			labelIds: issue.labelIds.filter((id) => this.labelById(id) !== null),
		};
	}

	private applyFieldChange(
		issue: Issue,
		field: EditableIssueField,
		value: IssueFieldValue,
	): Issue | null {
		switch (field) {
			case 'title':
				return typeof value === 'string' ? { ...issue, title: value } : null;

			case 'description':
				return typeof value === 'string' ? { ...issue, description: value } : null;

			case 'status':
				return isIssueStatus(value) ? { ...issue, status: value } : null;

			case 'priority':
				return isIssuePriority(value) ? { ...issue, priority: value } : null;

			case 'assigneeId': {
				if (value === null) {
					return { ...issue, assigneeId: null };
				}

				return typeof value === 'string' && this.userById(value) !== null
					? { ...issue, assigneeId: value }
					: null;
			}

			case 'projectId':
				return typeof value === 'string' && this.projectById(value) !== null
					? { ...issue, projectId: value }
					: null;

			case 'estimate': {
				if (value === null) {
					return { ...issue, estimate: null };
				}

				return typeof value === 'number' ? { ...issue, estimate: value } : null;
			}

			case 'labelIds': {
				if (typeof value === 'string' || typeof value === 'number' || value === null) {
					return null;
				}

				return { ...issue, labelIds: value.filter((id) => this.labelById(id) !== null) };
			}
		}
	}
}
