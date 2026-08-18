/**
 * The implementation registry.
 *
 * Lives in the app layer because `ds/` must not import `impls/` (AGENTS.md — Import rules). Each
 * component is a lazy import, so Vite emits one chunk per implementation and per-implementation
 * bundle size falls out of the build report for free.
 *
 * Every implementation provides both evaluated surfaces. pr-5173's List is the one deliberate
 * exception to "each impl uses its own PR's API": that PR has no standalone story, so its List is
 * a direct `@mui/x-virtualizer` adapter — scaffolding to keep the app usable, not evidence of what
 * the PR's API costs (PLAN.md — Phase 9).
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
	'pr-5173': entry(
		() => import('@/impls/pr-5173/Combobox'),
		() => import('@/impls/pr-5173/List'),
	),
	'pr-5414': entry(
		() => import('@/impls/pr-5414/Combobox'),
		() => import('@/impls/pr-5414/List'),
	),
	'pr-5466': entry(
		() => import('@/impls/pr-5466/Combobox'),
		() => import('@/impls/pr-5466/List'),
	),
};

export const IMPL_NAMES = Object.keys(IMPLS);

export const DEFAULT_IMPL = 'baseline';

export function resolveImpl(name: string): { name: string; components: ImplEntry } {
	const components = IMPLS[name] ?? IMPLS[DEFAULT_IMPL];

	if (components === undefined) {
		throw new Error(`No implementations are registered (asked for "${name}").`);
	}

	return { name: name in IMPLS ? name : DEFAULT_IMPL, components };
}
