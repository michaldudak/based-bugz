/**
 * The issues screen: header, filter bar, selection toolbar, virtualized list.
 *
 * Selection lives here rather than in the list because the toolbar and the rows both need it, and
 * it is scoped to the current filter+sort. Rows selected under one filter must not silently travel
 * to another — you would be bulk-editing issues you can no longer see.
 */

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { IssueId } from '@/data';
import { Button } from '@/ds/button';
import { IconPlus } from '@/ds/icons';
import { Page } from '@/ds/page';
import { NEW_ISSUE_PARAM } from '@/features/command-palette';
import { CreateIssueDialog } from './CreateIssueDialog';
import { FilterBar } from './FilterBar';
import { IssueList } from './IssueList';
import { useIssueFilters } from './useIssueFilters';

const NO_SELECTION: ReadonlySet<IssueId> = new Set();

interface Selection {
	/** The filter+sort the selection was made under. */
	scope: string;
	ids: ReadonlySet<IssueId>;
}

export function IssuesPage() {
	const filters = useIssueFilters();
	const [searchParams, setSearchParams] = useSearchParams();
	const scope = filters.key;

	/*
	 * The create dialog is URL state, not component state. The command palette opens it by
	 * navigating with `?new=1` (`NEW_ISSUE_PARAM`), so there has to be exactly one source of truth
	 * for whether it is open — and a param means "New issue" is also a link somebody can send.
	 * `replace` on the way out keeps the back button from stepping through open/closed.
	 */
	const createOpen = searchParams.get(NEW_ISSUE_PARAM) !== null;

	const setCreateOpen = useCallback(
		(open: boolean) => {
			setSearchParams(
				(current) => {
					const next = new URLSearchParams(current);

					if (open) {
						next.set(NEW_ISSUE_PARAM, '1');
					} else {
						next.delete(NEW_ISSUE_PARAM);
					}

					return next;
				},
				{ replace: !open },
			);
		},
		[setSearchParams],
	);
	const [selection, setSelection] = useState<Selection>(() => ({ scope, ids: NO_SELECTION }));

	// Derived rather than reset in an effect: a stale selection is never rendered for even one frame.
	const selectedIds = selection.scope === scope ? selection.ids : NO_SELECTION;

	const apply = useCallback(
		(mutate: (ids: Set<IssueId>) => void) => {
			setSelection((current) => {
				const next = new Set(current.scope === scope ? current.ids : NO_SELECTION);
				mutate(next);
				return { scope, ids: next };
			});
		},
		[scope],
	);

	const onToggleSelected = useCallback(
		(id: IssueId, selected: boolean) =>
			apply((ids) => {
				if (selected) {
					ids.add(id);
				} else {
					ids.delete(id);
				}
			}),
		[apply],
	);

	/** "Select all" means all *loaded* rows. Ten thousand unfetched issues are not a selection. */
	const onSelectAll = useCallback(
		(loaded: readonly IssueId[], selected: boolean) =>
			apply((ids) => {
				for (const id of loaded) {
					if (selected) {
						ids.add(id);
					} else {
						ids.delete(id);
					}
				}
			}),
		[apply],
	);

	const onClear = useCallback(() => apply((ids) => ids.clear()), [apply]);

	return (
		/* Full width and filling: the list is the page, and it owns the scroll the virtualizer needs. */
		<Page width="full" fill>
			<Page.Header
				actions={
					<Button variant="primary" onClick={() => setCreateOpen(true)}>
						<IconPlus size={14} />
						New issue
					</Button>
				}
			>
				<Page.Title>Issues</Page.Title>
				<Page.Subtitle>
					Filters and sorting live in the URL, so any view here is a link somebody else can open.
				</Page.Subtitle>
			</Page.Header>

			<FilterBar filters={filters} />

			<IssueList
				filters={filters}
				selectedIds={selectedIds}
				onToggleSelected={onToggleSelected}
				onSelectAll={onSelectAll}
				onClearSelection={onClear}
			/>

			<CreateIssueDialog open={createOpen} onOpenChange={setCreateOpen} />
		</Page>
	);
}
