/**
 * Theme, density and direction. All three are URL state so a run is reproducible from its link,
 * and all three resolve to attributes on <html> that `tokens.css` reads — no component holds
 * per-theme code (AGENTS.md — Appearance).
 */

import { createContext, use, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { applyUiParams, parseUiParams } from './params';
import type { Density, Direction, ThemePreference, UiParams } from './params';

interface ThemeContextValue extends UiParams {
	setTheme: (value: ThemePreference) => void;
	setDensity: (value: Density) => void;
	setDirection: (value: Direction) => void;
	setImpl: (value: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [searchParams, setSearchParams] = useSearchParams();
	const ui = useMemo(() => parseUiParams(searchParams), [searchParams]);

	useEffect(() => {
		const root = document.documentElement;

		// `system` means "leave it to color-scheme: light dark" — so remove, don't set.
		if (ui.theme === 'system') {
			root.removeAttribute('data-theme');
		} else {
			root.setAttribute('data-theme', ui.theme);
		}

		root.setAttribute('data-density', ui.density);
		root.setAttribute('dir', ui.dir);
	}, [ui.theme, ui.density, ui.dir]);

	const update = useCallback(
		(patch: Partial<UiParams>) => {
			setSearchParams(
				(current) => applyUiParams(current, { ...parseUiParams(current), ...patch }),
				{
					replace: true,
				},
			);
		},
		[setSearchParams],
	);

	const value = useMemo<ThemeContextValue>(
		() => ({
			...ui,
			setTheme: (theme) => update({ theme }),
			setDensity: (density) => update({ density }),
			setDirection: (dir) => update({ dir }),
			setImpl: (impl) => update({ impl }),
		}),
		[ui, update],
	);

	return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
	const value = use(ThemeContext);

	if (value === null) {
		throw new Error('useTheme() must be used inside <ThemeProvider>.');
	}

	return value;
}
