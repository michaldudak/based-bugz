/**
 * The issues screen: header, filter bar, selection toolbar, virtualized list.
 *
 * Selection lives here rather than in the list because the toolbar and the rows both need it, and
 * it is scoped to the current filter+sort. Rows selected under one filter must not silently travel
 * to another — you would be bulk-editing issues you can no longer see.
 */

import { useCallback, useMemo, useState } from 'react';
import type { IssueId } from '@/data';
import { BulkActions } from './BulkActions';
import { FilterBar } from './FilterBar';
import { IssueList } from './IssueList';
import { useIssueFilters } from './useIssueFilters';
import styles from './IssuesPage.module.css';

const NO_SELECTION: ReadonlySet<IssueId> = new Set();

interface Selection {
	/** The filter+sort the selection was made under. */
	scope: string;
	ids: ReadonlySet<IssueId>;
}

export function IssuesPage() {
	const filters = useIssueFilters();
	const scope = filters.key;
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

	const selectedList = useMemo(() => [...selectedIds], [selectedIds]);

	return (
		<div className={styles.page}>
			<header className={styles.header}>
				<h1 className={styles.title}>Issues</h1>
				<p className={styles.subtitle}>
					Filters and sorting live in the URL, so any view here is a link somebody else can open.
				</p>
			</header>

			<FilterBar filters={filters} />

			{selectedList.length > 0 && <BulkActions selectedIds={selectedList} onClear={onClear} />}

			<IssueList
				filters={filters}
				selectedIds={selectedIds}
				onToggleSelected={onToggleSelected}
				onSelectAll={onSelectAll}
			/>
		</div>
	);
}
