/**
 * One issue in the list.
 *
 * Rows are genuinely variable height: the generator produces a ~300-character title every 500
 * issues and titles wrap rather than truncate, so the virtualizer has to measure rather than
 * assume. Everything the row needs arrives as a lookup map rather than a per-row array, which keeps
 * `memo` effective — otherwise every keystroke in the filter bar re-renders the whole window.
 */

import { memo } from 'react';
import type { ListRowProps } from '@/ds/list';
import { Link } from 'react-router';
import type { Issue, IssueId, Label, LabelId, User, UserId } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Badge } from '@/ds/badge';
import { Checkbox } from '@/ds/checkbox';
import {
	PRIORITY_LABEL,
	STATUS_LABEL,
	STATUS_VARIANT,
	formatAbsoluteTime,
	formatRelativeTime,
	labelColorStyle,
} from './meta';
import { issuePath } from './routes';
import styles from './IssueRow.module.css';

/** Beyond this the row turns into a wall of chips; the rest collapse into a count. */
const MAX_VISIBLE_LABELS = 3;

export interface IssueRowProps {
	issue: Issue;
	usersById: ReadonlyMap<UserId, User>;
	labelsById: ReadonlyMap<LabelId, Label>;
	selected: boolean;
	onToggleSelected: (id: IssueId, selected: boolean) => void;
	/**
	 * The current query string, so the link to the issue carries the run's control surface and the
	 * filters you came from. One shared string rather than a per-row href, which is what keeps
	 * `memo` from missing on every render.
	 */
	search: string;
	/** Position in the filtered result, for assistive tech. */
	position: number;
	/** `-1` when the repository declined to count the matches — the ARIA value for "unknown". */
	setSize: number;
	/** From the active List implementation; spread blindly, never inspected (ds/list contract). */
	rowProps: ListRowProps;
}

export const IssueRow = memo(function IssueRow({
	issue,
	usersById,
	labelsById,
	selected,
	onToggleSelected,
	search,
	position,
	setSize,
	rowProps,
}: IssueRowProps) {
	const assignee = issue.assigneeId === null ? undefined : usersById.get(issue.assigneeId);
	const labels = issue.labelIds
		.slice(0, MAX_VISIBLE_LABELS)
		.flatMap((id) => labelsById.get(id) ?? []);
	const hiddenLabels = issue.labelIds.length - MAX_VISIBLE_LABELS;

	return (
		<li
			{...(rowProps as object)}
			className={styles.row}
			data-selected={selected || undefined}
			aria-posinset={position}
			aria-setsize={setSize}
		>
			<span className={styles.select}>
				<Checkbox
					checked={selected}
					onCheckedChange={(next) => onToggleSelected(issue.id, next)}
					aria-label={`Select ${issue.key}`}
				/>
			</span>

			<span className={styles.key}>{issue.key}</span>

			<span className={styles.main}>
				{/* The title is the row's one link: a whole-row anchor would swallow the checkbox. */}
				<Link className={styles.title} to={issuePath(issue.id, search)}>
					{issue.title}
				</Link>
				{labels.length > 0 && (
					<span className={styles.labels}>
						{labels.map((label) => (
							<span key={label.id} className={styles.label} style={labelColorStyle(label.hue)}>
								{label.name}
							</span>
						))}
						{hiddenLabels > 0 && <span className={styles.moreLabels}>+{hiddenLabels}</span>}
					</span>
				)}
			</span>

			<span className={styles.status}>
				<Badge variant={STATUS_VARIANT[issue.status]}>{STATUS_LABEL[issue.status]}</Badge>
			</span>

			<span className={styles.priority} data-priority={issue.priority}>
				<span className={styles.priorityDot} aria-hidden="true" />
				{PRIORITY_LABEL[issue.priority]}
			</span>

			<span className={styles.assignee}>
				{assignee ? (
					<Avatar
						name={assignee.name}
						initials={assignee.initials}
						hue={assignee.avatarHue}
						size="sm"
					/>
				) : (
					<span className={styles.unassigned}>Unassigned</span>
				)}
			</span>

			<time
				className={styles.updated}
				dateTime={new Date(issue.updatedAt).toISOString()}
				title={formatAbsoluteTime(issue.updatedAt)}
			>
				{formatRelativeTime(issue.updatedAt)}
			</time>
		</li>
	);
});
