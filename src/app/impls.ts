/**
 * The implementation registry.
 *
 * Lives in the app layer because `ds/` must not import `impls/` (AGENTS.md — Import rules). Each
 * component is a lazy import, so Vite emits one chunk per implementation and per-implementation
 * bundle size falls out of the build report for free.
 *
 * Every implementation provides all three evaluated surfaces. The evaluation concluded in favour
 * of mui/base-ui#5466's Virtualizer; `pr-5617` tracks its successor PR (#5617, built on top of
 * it, adding Select support), and `baseline` remains the documented-approach control
 * (FINDINGS.md).
 */

import { lazy } from 'react';
import type { OpaqueComboboxImpl, OpaqueListImpl, OpaqueSelectImpl } from '@/ds/registry';

interface ImplEntry {
	Combobox: OpaqueComboboxImpl;
	List: OpaqueListImpl;
	Select: OpaqueSelectImpl;
}

function entry(
	combobox: () => Promise<{ default: unknown }>,
	list: () => Promise<{ default: unknown }>,
	select: () => Promise<{ default: unknown }>,
): ImplEntry {
	return {
		Combobox: lazy(combobox as never) as unknown as OpaqueComboboxImpl,
		List: lazy(list as never) as unknown as OpaqueListImpl,
		Select: lazy(select as never) as unknown as OpaqueSelectImpl,
	};
}

const IMPLS: Record<string, ImplEntry> = {
	baseline: entry(
		() => import('@/impls/baseline/Combobox'),
		() => import('@/impls/baseline/List'),
		() => import('@/impls/baseline/Select'),
	),
	'pr-5617': entry(
		() => import('@/impls/pr-5617/Combobox'),
		() => import('@/impls/pr-5617/List'),
		() => import('@/impls/pr-5617/Select'),
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
		value: 'pr-5617',
		label: 'pr-5617',
		description:
			'The chosen Virtualizer API — tracked via mui/base-ui#5617 (#5466 + Select support): context-bound in the combobox, items prop in the issues list.',
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
