/**
 * The implementation registry.
 *
 * Lives in the app layer because `ds/` must not import `impls/` (AGENTS.md — Import rules). Each
 * entry is a lazy import, so Vite emits one chunk per implementation and per-implementation bundle
 * size falls out of the build report for free.
 *
 * When the canary builds land, add `'pr-a': lazy(() => import('@/impls/pr-a/Combobox'))` here and
 * nothing else in the app changes.
 */

import { lazy } from 'react';
import type { OpaqueComboboxImpl } from '@/ds/combobox';

const IMPLS: Record<string, OpaqueComboboxImpl> = {
	baseline: lazy(() => import('@/impls/baseline/Combobox')) as unknown as OpaqueComboboxImpl,
};

export const IMPL_NAMES = Object.keys(IMPLS);

export const DEFAULT_IMPL = 'baseline';

export function resolveImpl(name: string): { name: string; component: OpaqueComboboxImpl } {
	const component = IMPLS[name] ?? IMPLS[DEFAULT_IMPL];

	if (component === undefined) {
		throw new Error(`No combobox implementations are registered (asked for "${name}").`);
	}

	return { name: name in IMPLS ? name : DEFAULT_IMPL, component };
}
