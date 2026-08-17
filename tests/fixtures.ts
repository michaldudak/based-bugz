import { expect, test as base } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export interface ParityOptions {
	/** Which implementation this project drives, passed through as `?impl=`. */
	impl: string;
}

/*
 * Signing in through the form on every test would measure the login page, not the picker. The
 * session is one `localStorage` entry keyed by seed (`src/app/session.tsx`), and the value is a
 * generated user id — `u0` exists at every scale, because ids embed their index and the smallest
 * dataset still has one user.
 */
const SESSION_SEED = 'based-bugz';
const SESSION_KEY = `bugz:session:${SESSION_SEED}`;
const SESSION_USER_ID = 'u0';

export const test = base.extend<ParityOptions>({
	impl: ['baseline', { option: true }],

	// The second argument is Playwright's `use`, renamed: calling anything `use()` at module scope
	// trips `react-hooks/rules-of-hooks`, which has no idea this file never renders anything.
	page: async ({ page }, runTest) => {
		await page.addInitScript(
			([key, value]) => {
				window.localStorage.setItem(key, value);
			},
			[SESSION_KEY, SESSION_USER_ID] as const,
		);

		await runTest(page);
	},
});

export { expect };

export interface StressParams {
	case: string;
	/** Absolute issue count. Everything else derives from it — see `datasetShape`. */
	scale?: number;
	/** Position of the preselected row for the `preselected` case. */
	deep?: number;
	dir?: 'ltr' | 'rtl';
}

/**
 * Latency is pinned to zero: the suite checks keyboard and ARIA behaviour, and a simulated
 * round-trip only adds flake to assertions that are not about timing. Everything else about the
 * run is in the URL, so a failing test is reproducible by pasting its address into a browser.
 */
export function stressUrl(impl: string, params: StressParams): string {
	const search = new URLSearchParams({ impl, latency: '0', case: params.case });

	if (params.scale !== undefined) {
		search.set('scale', String(params.scale));
	}

	if (params.deep !== undefined) {
		search.set('deep', String(params.deep));
	}

	if (params.dir !== undefined) {
		search.set('dir', params.dir);
	}

	return `/lab/stress?${search.toString()}`;
}

/**
 * People in a dataset of `scale` issues. Mirrors `datasetShape()` in `src/data/generate.ts` — the
 * point of restating it is that the suite computes the expected `aria-setsize` from the URL rather
 * than reading it back out of the page it is testing.
 */
export function expectedUserCount(scale: number): number {
	return Math.round(scale / 2);
}

export function comboboxInput(page: Page): Locator {
	return page.getByRole('combobox');
}

export function picker(page: Page): Locator {
	return page.getByTestId('stress-picker');
}

export async function gotoStress(page: Page, url: string): Promise<void> {
	await page.goto(url);
	await expect(comboboxInput(page)).toBeVisible();
}

export async function openPopup(page: Page): Promise<void> {
	const input = comboboxInput(page);

	await input.click();
	await expect(input).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('listbox')).toBeVisible();
	await expect(page.getByRole('option').first()).toBeVisible();

	/*
	 * Wait out the enter transition. A popup fading in is partly transparent, and anything reading
	 * colour off it — an axe contrast check, a screenshot — is reading the surface behind it
	 * blended with the surface in front. Base UI clears `data-starting-style` when the transition
	 * has started in earnest, which is the only signal available from outside.
	 */
	await expect(page.locator('[data-starting-style]')).toHaveCount(0);
	await page.waitForTimeout(200);
}

/**
 * The option `aria-activedescendant` points at.
 *
 * Resolving it through the DOM is the whole point: in a windowed list the highlight can name a row
 * that was never rendered, and a screen reader following a dangling id announces nothing.
 */
export async function highlightedOption(page: Page): Promise<Locator | null> {
	const id = await comboboxInput(page).getAttribute('aria-activedescendant');

	if (id === null || id === '') {
		return null;
	}

	return page.locator(`[id="${id}"]`);
}

export async function expectHighlightAt(page: Page, position: number): Promise<void> {
	await expect(async () => {
		const option = await highlightedOption(page);

		expect(option, 'aria-activedescendant is not set').not.toBeNull();
		await expect(
			option as Locator,
			'aria-activedescendant names a row that is not rendered',
		).toHaveCount(1);
		await expect(option as Locator).toHaveAttribute('aria-posinset', String(position));
	}).toPass({ timeout: 5_000 });
}

/** `aria-posinset` of the highlighted option, or `null` when nothing is highlighted. */
export async function highlightedPosition(page: Page): Promise<number | null> {
	const option = await highlightedOption(page);

	if (option === null || (await option.count()) === 0) {
		return null;
	}

	const value = await option.getAttribute('aria-posinset');

	return value === null ? null : Number(value);
}
