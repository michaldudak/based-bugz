/**
 * The implementation registry.
 *
 * Lives in the app layer because `ds/` must not import `impls/` (AGENTS.md — Import rules). Each
 * component is a lazy import, so Vite emits one chunk per implementation and per-implementation
 * bundle size falls out of the build report for free.
 *
 * Every implementation provides both evaluated surfaces. The evaluation concluded in favour of
 * mui/base-ui#5466; `pr-5466` tracks that PR's head until it merges, and `baseline` remains the
 * documented-approach control it was measured against (FINDINGS.md).
 */

import { lazy } from 'react';
import type { OpaqueComboboxImpl, OpaqueListImpl } from '@/ds/registry';

interface ImplEntry {
	Combobox: OpaqueComboboxImpl;
	List: OpaqueListImpl;
}

function entry(
	combobox: () => Promise<{ default: unknown }>,
	list: () => Promise<{ default: unknown }>,
): ImplEntry {
	return {
		Combobox: lazy(combobox as never) as unknown as OpaqueComboboxImpl,
		List: lazy(list as never) as unknown as OpaqueListImpl,
	};
}

const IMPLS: Record<string, ImplEntry> = {
	baseline: entry(
		() => import('@/impls/baseline/Combobox'),
		() => import('@/impls/baseline/List'),
	),
	'pr-5466': entry(
		() => import('@/impls/pr-5466/Combobox'),
		() => import('@/impls/pr-5466/List'),
	),
};

export const IMPL_NAMES = Object.keys(IMPLS);

/** One line per candidate, for the switcher menu. Order matches the registry. */
export const IMPL_OPTIONS: ReadonlyArray<{ value: string; label: string; description: string }> = [
	{
		value: 'baseline',
		label: 'baseline',
		description: 'Stable Base UI + TanStack Virtual, wired as the docs describe — the control.',
	},
	{
		value: 'pr-5466',
		label: 'pr-5466',
		description:
			'The chosen API (mui/base-ui#5466) — dual-mode Virtualizer: context-bound in the combobox, items prop in the issues list.',
	},
];

export const DEFAULT_IMPL = 'baseline';

export function resolveImpl(name: string): { name: string; components: ImplEntry } {
	const components = IMPLS[name] ?? IMPLS[DEFAULT_IMPL];

	if (components === undefined) {
		throw new Error(`No implementations are registered (asked for "${name}").`);
	}

	return { name: name in IMPLS ? name : DEFAULT_IMPL, components };
}
