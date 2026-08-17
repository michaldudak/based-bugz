/**
 * Every issue write in one place, so the cache policy is decided once and reused (PLAN.md —
 * "Optimistic updates against a paginated cache").
 *
 * ## The strategy, and why this one
 *
 * Two coherent options exist for an infinite query whose pages came back behind cursors:
 * patch the cached pages in place, or throw them away and refetch from the first page.
 * Neither is sufficient alone, so this file does both, in a fixed order:
 *
 * 1. **`onMutate` patches the cached pages in place.** Every `['issues','list', …]` entry and
 *    every `['issues','detail', …]` entry is rewritten with the new field values, and the whole
 *    set is snapshotted first. Patching is the only option here: refetching would blank or
 *    reorder rows the user is looking at, and rollback has to restore *exactly* what was there,
 *    which only a snapshot can do.
 * 2. **`onError` restores the snapshot**, so a rejected write visibly snaps back — with a toast
 *    saying so. `?errorRate=` exists to make that path reachable.
 * 3. **`onSettled` invalidates the list queries** — on success *and* on failure. This is the part
 *    patching cannot do: whether a row still belongs in the result set, and where, is a decision
 *    only the repository can make. Set an issue to `done` while the list filters on `todo` and
 *    the patched row is simply wrong; sort by `updated` and every edit reorders the page. App
 *    code re-deriving that would mean re-implementing the repository's filter and sort above it,
 *    which is the thing this codebase refuses to do.
 *
 * Refetching a multi-page infinite query is not free — TanStack Query replays every loaded page
 * in order — but it is *correct* here, because the repository's cursors encode the sort key and
 * id of the last row rather than a bare offset, so each page resumes by key even after rows moved
 * underneath it. The refetch is also scoped by `invalidateQueries` defaults: only the mounted
 * list refetches, and cached views for other filters are just marked stale for their next mount.
 *
 * Creation is deliberately **not** optimistic. A new issue's id, key and position are all the
 * repository's to decide, and under a `title asc` sort there is no honest place to put a
 * placeholder row. It writes, invalidates, and offers a link to what actually got created.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { useCurrentUser } from '@/app/session';
import { useRepository } from '@/data';
import type { Comment, Issue, IssueId, IssuePatch, NewIssue, Page } from '@/data';
import { useToast } from '@/ds/toast';
import { formatIssueCount } from './meta';

/** How long the undo toast stays up. Long enough to read the sentence and reach the button. */
const UNDO_TIMEOUT = 9000;

export const issueKeys = {
	all: ['issues'] as const,
	lists: ['issues', 'list'] as const,
	details: ['issues', 'detail'] as const,
	detail: (id: IssueId) => ['issues', 'detail', id] as const,
	comments: (id: IssueId) => ['comments', id] as const,
	activity: (id: IssueId) => ['activity', id] as const,
};

type IssueListCache = InfiniteData<Page<Issue>, string | undefined>;

/** What `onError` needs to put the cache back exactly as it was. */
export interface IssueCacheSnapshot {
	lists: Array<[QueryKey, IssueListCache | undefined]>;
	details: Array<[QueryKey, Issue | null | undefined]>;
}

function snapshotIssueCache(queryClient: QueryClient): IssueCacheSnapshot {
	return {
		lists: queryClient.getQueriesData<IssueListCache>({ queryKey: issueKeys.lists }),
		details: queryClient.getQueriesData<Issue | null>({ queryKey: issueKeys.details }),
	};
}

function restoreIssueCache(queryClient: QueryClient, snapshot: IssueCacheSnapshot): void {
	for (const [key, data] of snapshot.lists) {
		queryClient.setQueryData(key, data);
	}

	for (const [key, data] of snapshot.details) {
		queryClient.setQueryData(key, data);
	}
}

/**
 * Rewrite every cached issue through `transform`. Returning `null` drops the row from its page
 * and turns a detail entry into `null` — which is exactly what `issues.byId` reports for a
 * deleted issue, so a delete needs no second code path.
 */
function mapCachedIssues(
	queryClient: QueryClient,
	transform: (issue: Issue) => Issue | null,
): void {
	queryClient.setQueriesData<IssueListCache>({ queryKey: issueKeys.lists }, (data) => {
		if (data === undefined) {
			return data;
		}

		let changed = false;

		const pages = data.pages.map((page) => {
			const items: Issue[] = [];
			let pageChanged = false;

			for (const issue of page.items) {
				const next = transform(issue);

				if (next === null) {
					pageChanged = true;
					continue;
				}

				if (next !== issue) {
					pageChanged = true;
				}

				items.push(next);
			}

			if (!pageChanged) {
				return page;
			}

			changed = true;

			return { ...page, items };
		});

		// Identity matters: an unchanged return keeps every memoized row from re-rendering.
		return changed ? { ...data, pages } : data;
	});

	queryClient.setQueriesData<Issue | null>({ queryKey: issueKeys.details }, (issue) =>
		issue == null ? issue : transform(issue),
	);
}

function patchCachedIssues(
	queryClient: QueryClient,
	ids: ReadonlySet<IssueId>,
	patch: IssuePatch,
): void {
	const at = Date.now();

	mapCachedIssues(queryClient, (issue) =>
		ids.has(issue.id) ? { ...issue, ...patch, updatedAt: at } : issue,
	);
}

function removeCachedIssues(queryClient: QueryClient, ids: ReadonlySet<IssueId>): void {
	mapCachedIssues(queryClient, (issue) => (ids.has(issue.id) ? null : issue));
}

/** Replace the optimistic guess with what the repository actually returned. */
function writeCachedIssues(queryClient: QueryClient, issues: readonly Issue[]): void {
	const byId = new Map(issues.map((issue) => [issue.id, issue]));

	mapCachedIssues(queryClient, (issue) => byId.get(issue.id) ?? issue);

	for (const issue of issues) {
		queryClient.setQueryData(issueKeys.detail(issue.id), issue);
	}
}

/**
 * Step 3 of the strategy. Detail entries are written from the mutation's own result rather than
 * invalidated, so a `?errorRate=` read failure cannot make a write that succeeded look broken.
 */
function invalidateIssueQueries(queryClient: QueryClient, ids: readonly IssueId[]): void {
	void queryClient.invalidateQueries({ queryKey: issueKeys.lists });

	for (const id of ids) {
		void queryClient.invalidateQueries({ queryKey: issueKeys.activity(id) });
		void queryClient.invalidateQueries({ queryKey: issueKeys.comments(id) });
	}
}

/**
 * In-flight reads would land after the optimistic patch and quietly undo it, so they are stopped
 * before the cache is touched — the standard TanStack recipe, and the reason `onMutate` is async.
 */
async function cancelIssueQueries(queryClient: QueryClient): Promise<void> {
	await queryClient.cancelQueries({ queryKey: issueKeys.all });
}

export interface UpdateIssuesInput {
	ids: readonly IssueId[];
	patch: IssuePatch;
}

/**
 * The inline editors and the bulk toolbar share this one path, so a status change made in the
 * detail header and one made across 40 selected rows produce the same events and the same cache
 * behaviour. `bulkUpdate` covers both: the contract says it is all-or-nothing.
 */
export function useUpdateIssues() {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();

	return useMutation({
		mutationFn: ({ ids, patch }: UpdateIssuesInput) =>
			repository.issues.bulkUpdate(ids, patch, { actorId: currentUser.id }),
		onMutate: async ({ ids, patch }) => {
			await cancelIssueQueries(queryClient);
			const snapshot = snapshotIssueCache(queryClient);
			patchCachedIssues(queryClient, new Set(ids), patch);

			return snapshot;
		},
		onError: (_error, { ids }, snapshot) => {
			if (snapshot !== undefined) {
				restoreIssueCache(queryClient, snapshot);
			}

			toast.show({
				title: ids.length === 1 ? 'Could not save that change' : 'Could not update those issues',
				description: 'The repository rejected the write, so the edit was rolled back.',
				variant: 'error',
			});
		},
		onSuccess: (updated) => writeCachedIssues(queryClient, updated),
		onSettled: (_data, _error, { ids }) => invalidateIssueQueries(queryClient, ids),
	});
}

export interface RestoreIssuesInput {
	ids: readonly IssueId[];
	/** Suppresses the confirmation toast when the caller shows its own. */
	quiet?: boolean;
}

export function useRestoreIssues() {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();

	return useMutation({
		mutationFn: ({ ids }: RestoreIssuesInput) =>
			Promise.all(ids.map((id) => repository.issues.restore(id, { actorId: currentUser.id }))),
		// No optimistic insert: a restored issue's place in a filtered, sorted, cursor-paged result
		// is the repository's answer, and guessing it is the divergence this file exists to avoid.
		onSuccess: (restored, { quiet }) => {
			writeCachedIssues(queryClient, restored);

			if (quiet !== true) {
				toast.show({ title: `Restored ${formatIssueCount(restored.length)}`, variant: 'success' });
			}
		},
		onError: () =>
			toast.show({
				title: 'Could not undo that delete',
				description: 'The repository rejected the write. The issues are still deleted.',
				variant: 'error',
			}),
		onSettled: (_data, _error, { ids }) => invalidateIssueQueries(queryClient, ids),
	});
}

export interface DeleteIssuesInput {
	ids: readonly IssueId[];
}

export interface UseDeleteIssuesOptions {
	/** Runs once the repository confirms the delete — the detail page leaves the route. */
	onDeleted?: (ids: readonly IssueId[]) => void;
}

/**
 * Delete, with undo. The undo lives here rather than at each call site so the list and the detail
 * page cannot drift apart on the one action that destroys something.
 *
 * The undo is session-scoped by design: it restores through `issues.restore`, which appends an
 * `issue_restored` event, so the *delete* survives a reload even though the offer to undo it does
 * not.
 */
export function useDeleteIssues({ onDeleted }: UseDeleteIssuesOptions = {}) {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();
	const restore = useRestoreIssues();

	return useMutation({
		mutationFn: ({ ids }: DeleteIssuesInput) =>
			Promise.all(ids.map((id) => repository.issues.delete(id, { actorId: currentUser.id }))),
		onMutate: async ({ ids }) => {
			await cancelIssueQueries(queryClient);
			const snapshot = snapshotIssueCache(queryClient);
			removeCachedIssues(queryClient, new Set(ids));

			return snapshot;
		},
		onError: (_error, _input, snapshot) => {
			if (snapshot !== undefined) {
				restoreIssueCache(queryClient, snapshot);
			}

			toast.show({
				title: 'Could not delete that',
				description: 'The repository rejected the write, so nothing was removed.',
				variant: 'error',
			});
		},
		onSuccess: (_result, { ids }) => {
			toast.show({
				title: `Deleted ${formatIssueCount(ids.length)}`,
				description: 'Undo restores them exactly as they were.',
				variant: 'success',
				timeout: UNDO_TIMEOUT,
				action: { label: 'Undo', onClick: () => restore.mutate({ ids }) },
			});

			onDeleted?.(ids);
		},
		onSettled: (_data, _error, { ids }) => invalidateIssueQueries(queryClient, ids),
	});
}

export interface UseCreateIssueOptions {
	onCreated?: (issue: Issue) => void;
}

export function useCreateIssue({ onCreated }: UseCreateIssueOptions = {}) {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();

	return useMutation({
		mutationFn: (input: NewIssue) => repository.issues.create(input, { actorId: currentUser.id }),
		onSuccess: (created) => {
			writeCachedIssues(queryClient, [created]);
			onCreated?.(created);
		},
		onError: () =>
			toast.show({
				title: 'Could not create that issue',
				description: 'The repository rejected the write. Nothing was saved — try again.',
				variant: 'error',
			}),
		onSettled: (created) => invalidateIssueQueries(queryClient, created ? [created.id] : []),
	});
}

export interface CreateCommentInput {
	issueId: IssueId;
	body: string;
}

/**
 * Comments are not patched in optimistically either: the comment list is its own cursor-paged
 * query, and inserting a fake row at the end of a page the repository has not yet extended means
 * inventing a page boundary. Posting is fast enough that a pending composer reads honestly.
 */
export function useCreateComment() {
	const repository = useRepository();
	const queryClient = useQueryClient();
	const currentUser = useCurrentUser();
	const toast = useToast();

	return useMutation({
		mutationFn: ({ issueId, body }: CreateCommentInput): Promise<Comment> =>
			repository.comments.create({ issueId, body }, { actorId: currentUser.id }),
		onError: () =>
			toast.show({
				title: 'Could not post that comment',
				description: 'The repository rejected the write. Your text is still in the box.',
				variant: 'error',
			}),
		onSettled: (_data, _error, { issueId }) => {
			void queryClient.invalidateQueries({ queryKey: issueKeys.comments(issueId) });
			void queryClient.invalidateQueries({ queryKey: issueKeys.activity(issueId) });
		},
	});
}
