/**
 * One row renderer per result kind.
 *
 * Row markup comes from the feature layer on purpose (AGENTS.md — evaluation rule 2), so every
 * implementation renders exactly these five shapes and any difference in behaviour is the
 * implementation's, not the markup's.
 */

import type { CSSProperties } from 'react';
import type { IssuePriority, IssueStatus } from '@/data';
import { Avatar } from '@/ds/avatar';
import { Badge } from '@/ds/badge';
import type { BadgeVariant } from '@/ds/badge';
import { Kbd } from '@/ds/kbd';
import type { ComboboxItemState } from '@/ds/combobox';
import { shortcutKeys } from './commands';
import type { PaletteEntry } from './entries';
import styles from './PaletteRows.module.css';

/**
 * Local copies of the status vocabulary. The issues list will grow its own, and the two should be
 * folded into one shared module once Phase 5 lands — duplicating them here keeps the palette from
 * depending on a directory that is still being written.
 */
const STATUS_LABEL: Record<IssueStatus, string> = {
	backlog: 'Backlog',
	todo: 'Todo',
	in_progress: 'In progress',
	in_review: 'In review',
	done: 'Done',
	cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<IssueStatus, BadgeVariant> = {
	backlog: 'neutral',
	todo: 'neutral',
	in_progress: 'info',
	in_review: 'warning',
	done: 'success',
	cancelled: 'danger',
};

const PRIORITY_LABEL: Record<IssuePriority, string> = {
	none: 'No priority',
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	urgent: 'Urgent',
};

/** A hue is a value, not a theme decision, so it is set inline rather than in the stylesheet. */
function swatchStyle(hue: number): CSSProperties {
	return { '--swatch': `oklch(0.72 0.16 ${hue})` } as CSSProperties;
}

function Trailing({ state, shortcut }: { state: ComboboxItemState; shortcut?: readonly string[] }) {
	return (
		<span className={styles.trailing}>
			{shortcut?.map((key) => (
				<Kbd key={key}>{key}</Kbd>
			))}
			{/*
			 * Consuming `state.highlighted` is deliberate: it is the one piece of item state the
			 * contract exposes that an implementation has to work to provide, and a palette that does
			 * not show what Enter will do is not a palette.
			 */}
			{state.highlighted && <Kbd aria-hidden="true">↵</Kbd>}
		</span>
	);
}

export function PaletteRow({ entry, state }: { entry: PaletteEntry; state: ComboboxItemState }) {
	switch (entry.kind) {
		case 'command': {
			const Icon = entry.command.icon;

			return (
				<span className={styles.row}>
					<Icon className={styles.icon} />
					<span className={styles.single}>{entry.command.label}</span>
					<Trailing
						state={state}
						shortcut={
							entry.command.shortcut === undefined
								? undefined
								: shortcutKeys(entry.command.shortcut)
						}
					/>
				</span>
			);
		}

		case 'issue':
			return (
				<span className={styles.row}>
					<span className={styles.lines}>
						<span className={styles.titleLine}>
							<span className={styles.issueKey}>{entry.issue.key}</span>
							<span className={styles.issueTitle}>{entry.issue.title}</span>
						</span>
						<span className={styles.metaLine}>
							<Badge variant={STATUS_VARIANT[entry.issue.status]}>
								{STATUS_LABEL[entry.issue.status]}
							</Badge>
							<span className={styles.meta}>{PRIORITY_LABEL[entry.issue.priority]}</span>
						</span>
					</span>
					<Trailing state={state} />
				</span>
			);

		case 'user':
			return (
				<span className={styles.row}>
					<Avatar
						name={entry.user.name}
						initials={entry.user.initials}
						hue={entry.user.avatarHue}
						size="sm"
						decorative
					/>
					<span className={styles.lines}>
						<span className={styles.name}>{entry.user.name}</span>
						<span className={styles.meta}>
							{entry.user.title} · {entry.user.team}
						</span>
					</span>
					<Trailing state={state} />
				</span>
			);

		case 'label':
			return (
				<span className={styles.row}>
					<span className={styles.swatch} style={swatchStyle(entry.label.hue)} />
					<span className={styles.single}>{entry.label.name}</span>
					<Trailing state={state} />
				</span>
			);

		case 'project':
			return (
				<span className={styles.row}>
					<span className={styles.projectKey}>{entry.project.key}</span>
					<span className={styles.single}>{entry.project.name}</span>
					<Trailing state={state} />
				</span>
			);
	}
}
