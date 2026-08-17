/**
 * The palette's item type.
 *
 * One `<Combobox>` renders five kinds of row over one flat list, which is the whole reason the
 * palette is the heaviest picker in the app: `estimateItemHeight` has to answer differently per
 * kind, and `groupOf` has to section a list whose sections arrive from two different sources.
 */

import type { SearchResult } from '@/data';
import type { PaletteCommand } from './commands';

export type PaletteEntry = { kind: 'command'; id: string; command: PaletteCommand } | SearchResult;

export type PaletteEntryKind = PaletteEntry['kind'];

/**
 * The order rows must arrive in. `SEARCH_RESULT_KINDS` already fixes the repository's four, and
 * the contract emits a group header on every change of key — so a kind that reappeared later would
 * grow a second header. Commands lead because they are the cheapest thing to be looking for.
 */
export const PALETTE_ENTRY_ORDER: readonly PaletteEntryKind[] = [
	'command',
	'issue',
	'user',
	'label',
	'project',
];

export const ENTRY_GROUP_LABEL: Record<PaletteEntryKind, string> = {
	command: 'Commands',
	issue: 'Issues',
	user: 'People',
	label: 'Labels',
	project: 'Projects',
};

/**
 * Pre-measurement heights, per kind. A command is one line, a label is one short line, an issue is
 * two lines with a status badge and a title that may wrap — so these are starting points that the
 * implementation is expected to correct, not promises (see `estimateItemHeight` in the contract).
 */
export const ENTRY_ESTIMATED_HEIGHT: Record<PaletteEntryKind, number> = {
	command: 36,
	issue: 58,
	user: 48,
	label: 32,
	project: 36,
};

/** Matches `.groupHeader` in the shared combobox stylesheet: 1.75rem. */
export const PALETTE_GROUP_HEADER_HEIGHT = 28;

export function entryKey(entry: PaletteEntry): string {
	return `${entry.kind}:${entry.id}`;
}

/** The accessible name and the typeahead string. Never rendered as-is. */
export function entryLabel(entry: PaletteEntry): string {
	switch (entry.kind) {
		case 'command':
			return entry.command.label;
		case 'issue':
			return `${entry.issue.key} ${entry.issue.title}`;
		case 'user':
			return entry.user.name;
		case 'label':
			return entry.label.name;
		case 'project':
			return `${entry.project.key} ${entry.project.name}`;
	}
}

export function entryGroup(entry: PaletteEntry): string {
	return ENTRY_GROUP_LABEL[entry.kind];
}

export function estimateEntryHeight(entry: PaletteEntry): number {
	return ENTRY_ESTIMATED_HEIGHT[entry.kind];
}
