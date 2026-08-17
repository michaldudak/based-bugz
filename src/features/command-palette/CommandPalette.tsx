/**
 * ⌘K over the whole dataset — the heaviest combobox in the app.
 *
 * Everything the pickers do one at a time happens here at once: five kinds of row with genuinely
 * different heights, sections coming from two sources, cursor paging over ~20k entries, and a
 * server that never reports a count (AGENTS.md — evaluation rule 4), so the footer and
 * `aria-setsize` have to cope with not knowing.
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useTheme } from '@/app/theme';
import { useRepository } from '@/data';
import type { Page, SearchResult } from '@/data';
import { Combobox } from '@/ds/combobox';
import type { ComboboxStatus } from '@/ds/combobox';
import { Dialog } from '@/ds/dialog';
import { IconSearch } from '@/ds/icons';
import { Kbd } from '@/ds/kbd';
import {
	ISSUE_FILTER_PARAM,
	PALETTE_COMMANDS,
	PALETTE_OWNED_PARAMS,
	filterCommands,
} from './commands';
import type { CommandContext } from './commands';
import {
	PALETTE_GROUP_HEADER_HEIGHT,
	entryGroup,
	entryKey,
	entryLabel,
	estimateEntryHeight,
} from './entries';
import type { PaletteEntry } from './entries';
import { PaletteRow } from './PaletteRows';
import { CommandPaletteContext, useCommandPaletteControls } from './useCommandPalette';
import type { CommandPaletteControls } from './useCommandPalette';
import styles from './CommandPalette.module.css';

const PAGE_SIZE = 30;

const QUERY_DEBOUNCE = 180;

/** The palette never holds a selection: picking a row acts and closes. */
const NO_SELECTION: readonly PaletteEntry[] = [];

function useDebounced(value: string, delay = QUERY_DEBOUNCE): string {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(timer);
	}, [value, delay]);

	return debounced;
}

function CommandPaletteDialog({
	controls,
	context,
}: {
	controls: CommandPaletteControls;
	context: CommandContext;
}) {
	const repository = useRepository();
	const { open, setOpen } = controls;
	const [query, setQuery] = useState('');
	const trimmed = query.trim();
	const debounced = useDebounced(trimmed);

	/*
	 * Clearing the input is not debounced. A debounced empty string would leave the previous page
	 * of results on screen for another 180ms after the box went blank, which reads as the palette
	 * ignoring you — and is exactly the stale-results case this screen has to get right.
	 */
	const text = trimmed === '' ? '' : debounced;
	const searching = open && text !== '';

	const search = useInfiniteQuery({
		queryKey: ['command-palette', text],
		enabled: searching,
		initialPageParam: undefined as string | undefined,
		queryFn: ({ pageParam, signal }) =>
			repository.search.query({ text }, { cursor: pageParam, limit: PAGE_SIZE, signal }),
		getNextPageParam: (lastPage: Page<SearchResult>) => lastPage.nextCursor,
	});

	const commands = useMemo(() => filterCommands(PALETTE_COMMANDS, trimmed), [trimmed]);

	/*
	 * No `placeholderData`, so a new query key starts with no pages at all. That is what makes
	 * "clear the box, results vanish" fall out of the data layer instead of needing a reset effect.
	 */
	const results = useMemo(
		() => (searching ? (search.data?.pages ?? []).flatMap((page) => page.items) : []),
		[searching, search.data],
	);

	// Grouping requires items to arrive grouped, and they do: commands lead, then the repository's
	// own `SEARCH_RESULT_KINDS` order, which its cursor resumes rather than reshuffles.
	const items = useMemo<PaletteEntry[]>(
		() => [
			...commands.map((command) => ({ kind: 'command' as const, id: command.id, command })),
			...results,
		],
		[commands, results],
	);

	const status: ComboboxStatus = !searching
		? 'idle'
		: search.isError
			? 'error'
			: search.isLoading
				? 'loading'
				: search.isFetchingNextPage
					? 'loading-more'
					: 'idle';

	function activate(entry: PaletteEntry) {
		// Base UI writes the picked item's label into the input; resetting first means reopening the
		// palette does not greet you with the title of the issue you just opened.
		setQuery('');
		setOpen(false);

		switch (entry.kind) {
			case 'command':
				entry.command.run(context);
				return;
			case 'issue':
				context.navigate(`/issues/${entry.issue.id}`);
				return;
			case 'user':
				context.navigate('/issues', { [ISSUE_FILTER_PARAM.assignee]: entry.user.id });
				return;
			case 'label':
				context.navigate('/issues', { [ISSUE_FILTER_PARAM.label]: entry.label.id });
				return;
			case 'project':
				context.navigate('/issues', { [ISSUE_FILTER_PARAM.project]: entry.project.id });
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={setOpen}
			size="lg"
			showCloseButton={false}
			className={styles.palette}
		>
			<Dialog.Title className={styles.srOnly}>Command palette</Dialog.Title>
			<IconSearch className={styles.searchIcon} />

			<Combobox<PaletteEntry>
				items={items}
				itemKey={entryKey}
				itemLabel={entryLabel}
				groupOf={entryGroup}
				value={NO_SELECTION}
				onValueChange={(next) => {
					const picked = next[0];

					if (picked !== undefined) {
						activate(picked);
					}
				}}
				query={query}
				onQueryChange={setQuery}
				status={status}
				hasMore={searching && search.hasNextPage}
				onEndReached={() => void search.fetchNextPage()}
				onRetry={() => void search.refetch()}
				renderItem={(entry, state) => <PaletteRow entry={entry} state={state} />}
				estimateItemHeight={estimateEntryHeight}
				groupHeaderHeight={PALETTE_GROUP_HEADER_HEIGHT}
				placeholder="Search issues, people, labels and projects…"
				label="Search Based Bugz"
				emptyMessage={trimmed === '' ? 'Type to search.' : `Nothing matches “${trimmed}”.`}
				// The list is the palette, so it is never closed while the dialog is up; a close from
				// the combobox (Escape, outside press, selection) is a close of the whole surface.
				open
				onOpenChange={(next) => {
					if (!next) {
						setOpen(false);
					}
				}}
				className={styles.field}
			/>

			<Kbd className={styles.escHint} aria-hidden="true">
				Esc
			</Kbd>
		</Dialog>
	);
}

/**
 * Owns palette state, registers the global shortcuts, and renders the palette itself. Mount it
 * once, inside the router — `useNavigate` and the theme control surface both live there.
 */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
	const navigate = useNavigate();
	const location = useLocation();
	const { theme, setTheme } = useTheme();

	const go = useCallback(
		(path: string, params?: Readonly<Record<string, string>>) => {
			// Carry the control surface across: a palette that dropped `?seed=` or `?impl=` would
			// silently end the run you were measuring (AGENTS.md — Conventions).
			const next = new URLSearchParams(location.search);

			for (const key of PALETTE_OWNED_PARAMS) {
				next.delete(key);
			}

			for (const [key, value] of Object.entries(params ?? {})) {
				next.set(key, value);
			}

			const search = next.toString();
			navigate(search === '' ? path : `${path}?${search}`);
		},
		[navigate, location.search],
	);

	const toggleTheme = useCallback(() => {
		const dark =
			theme === 'dark' ||
			(theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

		setTheme(dark ? 'light' : 'dark');
	}, [theme, setTheme]);

	const context = useMemo<CommandContext>(() => ({ navigate: go, toggleTheme }), [go, toggleTheme]);

	const controls = useCommandPaletteControls(PALETTE_COMMANDS, context);

	return (
		<CommandPaletteContext value={controls}>
			{children}
			<CommandPaletteDialog controls={controls} context={context} />
		</CommandPaletteContext>
	);
}
