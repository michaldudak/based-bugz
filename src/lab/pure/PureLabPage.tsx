/**
 * Rule 12's repro surface. In the app a canary Combobox sits inside stable-Base-UI surroundings —
 * a pairing no real user ships, where the aliasing itself can manufacture portal-stacking, dismiss
 * and focus bugs. Before any cross-component bug is recorded against a PR, it must reproduce here,
 * where the Dialog around the picker comes from the same build as the picker.
 */

import { Suspense, lazy, useMemo } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { Page } from '@/ds/page';
import { useImplRegistry } from '@/ds/registry';
import { Spinner } from '@/ds/spinner';
import { UserPickerLab } from '@/lab/combobox/UserPickerLab';

const SURROUNDS: Record<string, ComponentType<{ children: ReactNode }>> = {
	baseline: lazy(() => import('./SurroundStable')),
	'pr-5173': lazy(() => import('./Surround5173')),
	'pr-5414': lazy(() => import('./Surround5414')),
	'pr-5466': lazy(() => import('./Surround5466')),
};

export function PureLabPage() {
	const { activeName } = useImplRegistry();
	const Surround = useMemo(() => SURROUNDS[activeName] ?? SURROUNDS['baseline'], [activeName]);

	if (Surround === undefined) {
		throw new Error('No surroundings registered — the registry and SURROUNDS drifted apart.');
	}

	return (
		<Page>
			<Page.Header>
				<Page.Title>Pure surroundings</Page.Title>
				<Page.Subtitle>
					The picker inside a Dialog from <em>its own</em> package build ({activeName}). A bug that
					reproduces here belongs to the implementation; one that only appears in the mixed app
					belongs to the aliasing (AGENTS.md — rule 12).
				</Page.Subtitle>
			</Page.Header>
			<Suspense fallback={<Spinner size={16} label="Loading surroundings" />}>
				<Surround>
					<UserPickerLab />
				</Surround>
			</Suspense>
		</Page>
	);
}
