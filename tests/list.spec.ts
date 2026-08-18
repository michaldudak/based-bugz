import { expect, test } from './fixtures';

/**
 * Standalone-list parity — the second evaluated surface (PLAN.md — Phase 9).
 *
 * Runs against `/issues`, the real screen, once per registered implementation. Assertions are
 * behavioural only: windowing, paging, reset. Markup belongs to `features/issues`, identical for
 * every implementation, so asserting on it here would test the wrong layer.
 */

const SCALE = 1_000;
const PAGE_SIZE = 50;

function issuesUrl(impl: string): string {
	const search = new URLSearchParams({ impl, latency: '0', scale: String(SCALE) });
	return `/issues?${search.toString()}`;
}

/** The count label ("50 of 1,000" unfiltered, "N shown" filtered) reads as list state. */
function countLabel(page: import('@playwright/test').Page) {
	return page.getByText(/\d[\d,]* (of [\d,]+|shown)/).first();
}

test.describe('standalone list', () => {
	test('renders a window, not the loaded result set', async ({ page, impl }) => {
		await page.goto(issuesUrl(impl));

		const list = page.getByRole('list', { name: 'Issue results' });
		await expect(list).toBeVisible();
		await expect(countLabel(page)).toHaveText(`${PAGE_SIZE} of ${SCALE.toLocaleString('en')}`);

		const mounted = await list.getByRole('listitem').count();
		expect(mounted, 'a virtualized list mounts a window, not every loaded row').toBeGreaterThan(0);
		expect(mounted).toBeLessThan(PAGE_SIZE);
	});

	test('scrolling to the end loads the next page', async ({ page, impl }) => {
		await page.goto(issuesUrl(impl));

		const list = page.getByRole('list', { name: 'Issue results' });
		await expect(list).toBeVisible();

		// Wheel over the list, repeatedly — how the scroll container is built is the
		// implementation's business, so no element handle, just pointer input.
		await list.hover();

		await expect(async () => {
			await page.mouse.wheel(0, 4_000);
			await expect(countLabel(page)).toHaveText(
				`${PAGE_SIZE * 2} of ${SCALE.toLocaleString('en')}`,
			);
		}).toPass({ timeout: 10_000 });
	});

	test('rows keep their position in the full result while windowed', async ({ page, impl }) => {
		await page.goto(issuesUrl(impl));

		const list = page.getByRole('list', { name: 'Issue results' });
		await expect(list).toBeVisible();
		await list.hover();
		await page.mouse.wheel(0, 2_500);

		// Whatever is mounted after scrolling, its accessible position matches reality: posinset
		// carries on from the top of the result set, not from the top of the window.
		await expect(async () => {
			const first = list.getByRole('listitem').first();
			const posinset = Number(await first.getAttribute('aria-posinset'));
			expect(posinset).toBeGreaterThan(1);
		}).toPass({ timeout: 5_000 });
	});

	test('changing the filter resets scroll to the top of the new result set', async ({
		page,
		impl,
	}) => {
		await page.goto(issuesUrl(impl));

		const list = page.getByRole('list', { name: 'Issue results' });
		await expect(list).toBeVisible();
		await list.hover();
		await page.mouse.wheel(0, 6_000);

		await page.getByRole('textbox', { name: /search/i }).fill('popup');

		// New result set: the first mounted row is the first row of it.
		await expect(async () => {
			const first = list.getByRole('listitem').first();
			expect(Number(await first.getAttribute('aria-posinset'))).toBe(1);
		}).toPass({ timeout: 10_000 });

		await expect(countLabel(page)).toHaveText(/shown/);
	});
});
