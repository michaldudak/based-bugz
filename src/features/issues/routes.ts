/**
 * Links between the issues screens.
 *
 * Every hop carries the current query string, because the control surface lives there: a link that
 * dropped `?seed=` or `?impl=` would quietly end the run you were measuring (AGENTS.md —
 * Conventions). The filters ride along too, so coming back from an issue returns you to the
 * filtered list you left rather than to the unfiltered backlog.
 */

import type { IssueId } from '@/data';
import { NEW_ISSUE_PARAM } from '@/features/command-palette';

/** The one parameter that must not travel: it would reopen the create dialog on arrival. */
function carried(search: string): string {
	const params = new URLSearchParams(search);
	params.delete(NEW_ISSUE_PARAM);

	const next = params.toString();

	return next === '' ? '' : `?${next}`;
}

export function issuesPath(search: string): string {
	return `/issues${carried(search)}`;
}

export function issuePath(id: IssueId, search: string): string {
	return `/issues/${encodeURIComponent(id)}${carried(search)}`;
}
