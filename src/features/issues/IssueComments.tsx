/**
 * The comments tab.
 *
 * Mentions are the reason this is more than a list of strings: the generator writes them as
 * `@<userId>`, which is what a real system stores and what a raw render would expose as
 * `@u4821`. Resolving them means collecting every id across the loaded pages and asking for the
 * users in one batched read — the same shape the list uses for assignees, for the same reason.
 */

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useCurrentUser } from '@/app/session';
import { useRepository } from '@/data';
import type { Comment, IssueId, Page, User, UserId } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Button } from '@/ds/button';
import { IconUser, IconWarning } from '@/ds/icons';
import { Popover } from '@/ds/popover';
import { Spinner } from '@/ds/spinner';
import { Textarea } from '@/ds/textarea';
import { AssigneePicker } from './AssigneePicker';
import { formatAbsoluteTime, formatRelativeTime } from './meta';
import { issueKeys, useCreateComment } from './mutations';
import styles from './IssueComments.module.css';

const PAGE_SIZE = 20;

/** `@` plus an entity id. Letters and digits only, so trailing punctuation stays in the prose. */
const MENTION = /@([\p{L}\p{N}_-]+)/gu;

interface MentionSpan {
	text: string;
	userId?: UserId;
}

/** Split a body into prose and mention spans. Pure, so the rendering below stays declarative. */
function splitMentions(body: string): MentionSpan[] {
	const spans: MentionSpan[] = [];
	const pattern = new RegExp(MENTION.source, MENTION.flags);
	let index = 0;
	let match = pattern.exec(body);

	while (match !== null) {
		if (match.index > index) {
			spans.push({ text: body.slice(index, match.index) });
		}

		spans.push({ text: match[0], userId: match[1] ?? '' });
		index = match.index + match[0].length;
		match = pattern.exec(body);
	}

	if (index < body.length) {
		spans.push({ text: body.slice(index) });
	}

	return spans;
}

function CommentBody({
	body,
	usersById,
}: {
	body: string;
	usersById: ReadonlyMap<UserId, User>;
}): ReactNode {
	return splitMentions(body).map((span, position) => {
		const user = span.userId === undefined ? undefined : usersById.get(span.userId);

		if (user === undefined) {
			// An unresolved id is left exactly as written — inventing a name for a user this dataset
			// no longer generates would be worse than showing the raw token.
			return <span key={position}>{span.text}</span>;
		}

		return (
			<span key={position} className={styles.mention}>
				@{user.name}
			</span>
		);
	});
}

export interface IssueCommentsProps {
	issueId: IssueId;
}

export function IssueComments({ issueId }: IssueCommentsProps) {
	const repository = useRepository();
	const currentUser = useCurrentUser();
	const [draft, setDraft] = useState('');
	const [mentionOpen, setMentionOpen] = useState(false);

	const comments = useInfiniteQuery({
		queryKey: issueKeys.comments(issueId),
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.comments.list(issueId, { cursor: pageParam, limit: PAGE_SIZE, signal }),
		getNextPageParam: (lastPage: Page<Comment>) => lastPage.nextCursor,
	});

	const items = useMemo<readonly Comment[]>(
		() => (comments.data?.pages ?? []).flatMap((page) => page.items),
		[comments.data],
	);

	const referencedIds = useMemo(() => {
		const ids = new Set<UserId>();

		for (const comment of items) {
			ids.add(comment.authorId);

			for (const span of splitMentions(comment.body)) {
				if (span.userId !== undefined) {
					ids.add(span.userId);
				}
			}
		}

		return [...ids].toSorted();
	}, [items]);

	const users = useQuery({
		queryKey: ['users', 'by-ids', referencedIds],
		queryFn: ({ signal }) => repository.users.byIds(referencedIds, { signal }),
		enabled: referencedIds.length > 0,
		placeholderData: keepPreviousData,
		staleTime: Infinity,
	});

	const usersById = useMemo<ReadonlyMap<UserId, User>>(
		() => new Map((users.data ?? []).map((user) => [user.id, user])),
		[users.data],
	);

	const post = useCreateComment();

	function submit(): void {
		const body = draft.trim();

		if (body === '' || post.isPending) {
			return;
		}

		post.mutate(
			{ issueId, body },
			// Cleared only once the repository has it: a failed post that also wiped the box would
			// lose what you wrote, which no amount of error toast makes up for.
			{ onSuccess: () => setDraft('') },
		);
	}

	const total = comments.data?.pages[0]?.total ?? items.length;

	return (
		<div className={styles.root}>
			<form
				className={styles.composer}
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<Avatar
					name={currentUser.name}
					initials={currentUser.initials}
					hue={currentUser.avatarHue}
					size="sm"
					decorative
				/>
				<div className={styles.composerBody}>
					<Textarea
						autoResize
						minRows={2}
						maxRows={10}
						value={draft}
						aria-label="Write a comment"
						placeholder="Add a comment. ⌘ + Enter posts it."
						onChange={(event) => setDraft(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
								event.preventDefault();
								submit();
							}
						}}
					/>
					<div className={styles.composerActions}>
						<Popover
							open={mentionOpen}
							onOpenChange={setMentionOpen}
							align="start"
							className={styles.mentionPopup}
							trigger={
								<Button size="sm" variant="ghost">
									<IconUser size={14} />
									Mention
								</Button>
							}
						>
							<p className={styles.mentionHint}>Insert a mention</p>
							<AssigneePicker
								value={null}
								allowUnassigned={false}
								clearable={false}
								label="Mention someone"
								placeholder="Search people…"
								onChange={(value) => {
									setMentionOpen(false);

									if (value?.kind === 'user') {
										// The stored form is the id, exactly as the repository writes it; the
										// name is a rendering concern and resolving it here would bake a
										// snapshot of someone's name into the comment forever.
										setDraft((current) =>
											current === '' ? `@${value.id} ` : `${current.trimEnd()} @${value.id} `,
										);
									}
								}}
							/>
						</Popover>

						<span className={styles.spacer} />

						<Button
							type="submit"
							variant="primary"
							size="sm"
							loading={post.isPending}
							disabled={draft.trim() === ''}
						>
							Comment
						</Button>
					</div>
				</div>
			</form>

			{comments.isPending && (
				<div className={styles.state}>
					<Spinner size={16} label="Loading comments" />
				</div>
			)}

			{comments.isError && items.length === 0 && (
				<div className={styles.state}>
					<IconWarning />
					<p>Could not load the comments.</p>
					<Button size="sm" onClick={() => void comments.refetch()}>
						Try again
					</Button>
				</div>
			)}

			{!comments.isPending && items.length === 0 && (
				<p className={styles.empty}>No comments yet. Be the first.</p>
			)}

			<ol className={styles.list}>
				{items.map((comment) => {
					const author = usersById.get(comment.authorId);
					// "Unknown user" is a claim, and while the batched read is still in flight it is a
					// false one — an unresolved author is only unknown once the lookup has finished.
					const authorName = author?.name ?? (users.isPending ? '…' : 'Unknown user');

					return (
						<li key={comment.id} className={styles.comment}>
							<Avatar
								name={author?.name ?? comment.authorId}
								initials={author?.initials}
								hue={author?.avatarHue}
								size="sm"
								decorative
							/>
							<div className={styles.commentBody}>
								<p className={styles.commentMeta}>
									<span className={styles.author}>{authorName}</span>
									<time
										dateTime={new Date(comment.createdAt).toISOString()}
										title={formatAbsoluteTime(comment.createdAt)}
									>
										{formatRelativeTime(comment.createdAt)}
									</time>
								</p>
								<p className={styles.text}>
									<CommentBody body={comment.body} usersById={usersById} />
								</p>
							</div>
						</li>
					);
				})}
			</ol>

			{comments.hasNextPage && (
				<Button
					size="sm"
					fullWidth
					loading={comments.isFetchingNextPage}
					onClick={() => void comments.fetchNextPage()}
				>
					Load more ({items.length} of {total.toLocaleString()})
				</Button>
			)}
		</div>
	);
}
