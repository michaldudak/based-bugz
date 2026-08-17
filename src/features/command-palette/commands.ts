/**
 * The palette's static commands.
 *
 * These are the one part of the result set that does not come from the repository, so they are
 * also the one part filtered in app code — six rows is not the async path this project cares
 * about (AGENTS.md — evaluation rule 3 is about repository reads). They still share the row model
 * with 20k repository results, which is what makes the palette's item type a union and its rows
 * genuinely different heights.
 */

import type { ComponentType } from 'react';
import { IconInbox, IconMonitor, IconMoon, IconPlus, IconSearch, IconSettings } from '@/ds/icons';
import type { IconProps } from '@/ds/icons';

/**
 * Query-string keys the palette writes when a result applies a filter.
 *
 * The issues list owns their meaning; the palette only produces them, so they live in one place
 * to be re-pointed once Phase 5 settles on its own names.
 */
export const ISSUE_FILTER_PARAM = {
	assignee: 'assignee',
	label: 'label',
	project: 'project',
} as const;

/** Asks the issues list to open its create dialog. */
export const NEW_ISSUE_PARAM = 'new';

/** Everything the palette overwrites on navigation, so two picks never compose by accident. */
export const PALETTE_OWNED_PARAMS: readonly string[] = [
	ISSUE_FILTER_PARAM.assignee,
	ISSUE_FILTER_PARAM.label,
	ISSUE_FILTER_PARAM.project,
	NEW_ISSUE_PARAM,
];

export interface CommandContext {
	/**
	 * Navigate to an app path. The control surface (`?theme=` `?seed=` `?impl=` …) is carried over
	 * by the implementation, so running a command never resets the run you are measuring.
	 */
	navigate: (path: string, params?: Readonly<Record<string, string>>) => void;
	toggleTheme: () => void;
}

/**
 * A key sequence typed without modifiers, e.g. `['g', 'i']`. Bare letters are only safe because
 * the global listener ignores keystrokes aimed at a text field — see `useCommandPalette.ts`.
 */
export type CommandSequence = readonly string[];

export interface PaletteCommand {
	id: string;
	label: string;
	icon: ComponentType<IconProps>;
	shortcut?: CommandSequence;
	/** Extra search terms, so "dark" finds "Toggle theme". */
	keywords?: readonly string[];
	run: (context: CommandContext) => void;
}

export const PALETTE_COMMANDS: readonly PaletteCommand[] = [
	{
		id: 'go-issues',
		label: 'Go to Issues',
		icon: IconInbox,
		shortcut: ['g', 'i'],
		keywords: ['backlog', 'list', 'bugs'],
		run: (context) => context.navigate('/issues'),
	},
	{
		id: 'new-issue',
		label: 'New issue',
		icon: IconPlus,
		shortcut: ['c'],
		keywords: ['create', 'add', 'report'],
		run: (context) => context.navigate('/issues', { [NEW_ISSUE_PARAM]: '1' }),
	},
	{
		id: 'toggle-theme',
		label: 'Toggle theme',
		icon: IconMoon,
		shortcut: ['t'],
		keywords: ['dark', 'light', 'appearance'],
		run: (context) => context.toggleTheme(),
	},
	{
		id: 'go-settings',
		label: 'Go to Settings',
		icon: IconSettings,
		shortcut: ['g', 's'],
		keywords: ['seed', 'scale', 'latency', 'density', 'preferences'],
		run: (context) => context.navigate('/settings'),
	},
	{
		id: 'go-combobox-lab',
		label: 'Open the combobox lab',
		icon: IconSearch,
		shortcut: ['g', 'c'],
		keywords: ['stress', 'virtualization', 'picker'],
		run: (context) => context.navigate('/lab/combobox'),
	},
	{
		id: 'go-ds-lab',
		label: 'Open the design system gallery',
		icon: IconMonitor,
		shortcut: ['g', 'd'],
		keywords: ['components', 'tokens', 'gallery'],
		run: (context) => context.navigate('/lab/ds'),
	},
];

/**
 * Case- and diacritic-insensitive folding, matching what the repository does to its own text.
 * Duplicated rather than shared because `data/` keeps its matcher private.
 */
function fold(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();
}

export function filterCommands(
	commands: readonly PaletteCommand[],
	query: string,
): readonly PaletteCommand[] {
	const needle = fold(query.trim());

	if (needle === '') {
		return commands;
	}

	return commands.filter((command) => {
		const haystack = fold([command.label, ...(command.keywords ?? [])].join(' '));
		return haystack.includes(needle);
	});
}

/** How a sequence is rendered: one `<Kbd>` per element. */
export function shortcutKeys(shortcut: CommandSequence): readonly string[] {
	return shortcut.map((key) => key.toUpperCase());
}

interface SequenceMatch {
	keys: readonly string[];
	/** `null` while the sequence is still a prefix of something longer. */
	command: PaletteCommand | null;
}

function startsWith(sequence: CommandSequence, keys: readonly string[]): boolean {
	return keys.length <= sequence.length && keys.every((key, index) => sequence[index] === key);
}

/**
 * Resolve a pressed sequence: an exact command, a live prefix, or nothing. Returning the prefix
 * case explicitly is what lets `g` wait for its second key instead of being swallowed.
 */
export function resolveSequence(
	commands: readonly PaletteCommand[],
	keys: readonly string[],
): SequenceMatch | null {
	const exact = commands.find(
		(command) =>
			command.shortcut !== undefined &&
			command.shortcut.length === keys.length &&
			startsWith(command.shortcut, keys),
	);

	if (exact !== undefined) {
		return { keys, command: exact };
	}

	const prefixed = commands.some(
		(command) => command.shortcut !== undefined && startsWith(command.shortcut, keys),
	);

	return prefixed ? { keys, command: null } : null;
}
