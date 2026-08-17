import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, gotoStress, openPopup, picker, stressUrl, test } from './fixtures';

/**
 * An axe scan per implementation route, in the states that matter.
 *
 * Accessibility counts toward the verdict (AGENTS.md — evaluation rule 8), and a windowed listbox
 * is where it goes wrong. Axe cannot check the claim a virtualized list makes — that a `setsize` of
 * 5,000 is honest when 14 rows exist — which is what `parity.spec.ts` is for. What it does catch is
 * everything a popup breaks by accident: a listbox whose children are not options, a control with
 * no accessible name, a contrast failure only the highlighted row has.
 *
 * The scan is scoped to the case body and the popup. The app shell is identical under every
 * implementation, so shell findings are noise in a parity report — they belong to whoever owns the
 * shell, and 300 duplicate nodes per project would bury the ones that are actually about the
 * picker.
 */

const SCALE = 1_000;

const STANDARDS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Derived from `analyze()` rather than imported: `axe-core` is a transitive dependency here. */
type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;

const CASE_BODY = '[data-testid="stress-case"]';
/** The popup portals to the body, so it has to be included by role rather than by ancestry. */
const POPUP = '[role="listbox"]';

function scan(page: Page, ...regions: string[]) {
	const builder = new AxeBuilder({ page }).withTags(STANDARDS);

	for (const region of regions) {
		builder.include(region);
	}

	return builder;
}

/**
 * Violations as one readable line each. `toEqual([])` on raw axe output prints several hundred
 * lines of nested objects for a single contrast failure, which is a good way to make sure nobody
 * reads the report.
 */
function summarize(results: AxeResults): string[] {
	return results.violations.map((violation) => {
		const targets = violation.nodes
			.slice(0, 3)
			.map((node) => node.target.join(' '))
			.join(', ');

		return `${violation.id} [${violation.impact}] ×${violation.nodes.length} — ${targets}`;
	});
}

test.describe('accessibility', () => {
	test('the closed picker has no violations', async ({ page, impl }) => {
		await gotoStress(page, stressUrl(impl, { case: 'scale', scale: SCALE }));

		expect(summarize(await scan(page, CASE_BODY).analyze())).toEqual([]);
	});

	test('the open popup has no violations', async ({ page, impl }) => {
		await gotoStress(page, stressUrl(impl, { case: 'scale', scale: SCALE }));
		await openPopup(page);

		expect(summarize(await scan(page, CASE_BODY, POPUP).analyze())).toEqual([]);
	});

	test('the open popup has no violations with a row highlighted', async ({ page, impl }) => {
		await gotoStress(page, stressUrl(impl, { case: 'scale', scale: SCALE }));
		await openPopup(page);
		await page.getByRole('combobox').press('ArrowDown');
		await expect(page.locator('[data-highlighted]').first()).toBeVisible();

		expect(summarize(await scan(page, POPUP).analyze())).toEqual([]);
	});

	test('variable-height rows have no violations', async ({ page, impl }) => {
		await gotoStress(page, stressUrl(impl, { case: 'variable', scale: SCALE }));
		await openPopup(page);

		expect(summarize(await scan(page, CASE_BODY, POPUP).analyze())).toEqual([]);
	});

	test('the open popup has no violations in RTL', async ({ page, impl }) => {
		await gotoStress(page, stressUrl(impl, { case: 'rtl', scale: SCALE, dir: 'rtl' }));
		await openPopup(page);

		expect(summarize(await scan(page, CASE_BODY, POPUP).analyze())).toEqual([]);
	});

	test('the popup inside a modal dialog has no violations', async ({ page, impl }) => {
		await page.goto(stressUrl(impl, { case: 'dialog', scale: SCALE }));
		await page.getByRole('button', { name: 'Open dialog' }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
		await expect(picker(page)).toBeVisible();
		await openPopup(page);

		expect(summarize(await scan(page, '[role="dialog"]', POPUP).analyze())).toEqual([]);
	});
});
