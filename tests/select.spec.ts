import type { Locator, Page } from '@playwright/test';
import { expect, gotoStress, picker, stressUrl, test } from './fixtures';

/**
 * Keyboard and windowing parity for the Select surface — the version picker on the stress lab's
 * `version` case. A select has no query box: the collection is complete and local when the popup
 * opens, so typeahead, Home/End and scroll-to-selected-on-open all have to work against rows that
 * have never been mounted. That is precisely what separates it from the Combobox suite, where an
 * async filter absorbs most of the distance.
 *
 * Unlike the Combobox, Base UI's Select moves real DOM focus between options, so the highlight is
 * observed via `[data-highlighted]` rather than `aria-activedescendant`.
 */

/** 1,250 versions (`datasetShape`: an eighth of the issue count). */
const SCALE = 10_000;
/** Deep enough that the selected release is far outside any initial window. */
const DEEP = 800;

/** 12,000 versions — the version list's ceiling, where per-item work becomes visible. */
const FULL_SCALE = 100_000;
const FULL_DEEP = 9_000;

function versionUrl(impl: string, overrides: { scale?: number; deep?: number } = {}): string {
	return stressUrl(impl, {
		case: 'version',
		scale: overrides.scale ?? SCALE,
		deep: overrides.deep ?? DEEP,
	});
}

/** The select trigger. Base UI renders it with `role="combobox"` per the ARIA select pattern. */
function trigger(page: Page): Locator {
	return page.getByRole('combobox');
}

function highlighted(page: Page): Locator {
	return page.locator('[role="option"][data-highlighted]');
}

/** The version-name half of a row, without the relative-time meta text beside it. */
function nameOf(option: Locator): Locator {
	return option.locator('[class*="_name_"]');
}

async function gotoVersionCase(page: Page, url: string): Promise<void> {
	await gotoStress(page, url);
	await expect(picker(page)).toHaveAttribute('data-preselect-settled', 'true');
}

async function openSelect(page: Page): Promise<void> {
	await trigger(page).click();
	await expect(page.getByRole('listbox')).toBeVisible();
}

test.describe('select parity', () => {
	test('the list is windowed, not rendered whole', async ({ page, impl }) => {
		await gotoVersionCase(page, versionUrl(impl));
		await openSelect(page);

		// Settled state only: what mounts transiently while opening is its own test below.
		await expect.poll(() => page.getByRole('option').count(), { timeout: 5_000 }).toBeLessThan(200);
	});

	test('Enter selects the highlighted release and closes the popup', async ({ page, impl }) => {
		await gotoVersionCase(page, versionUrl(impl));
		await openSelect(page);

		await page.keyboard.press('ArrowDown');
		await expect(highlighted(page)).toHaveCount(1);

		const target = await nameOf(highlighted(page)).textContent();
		expect(target).not.toBeNull();

		await page.keyboard.press('Enter');
		await expect(page.getByRole('listbox')).toHaveCount(0);
		await expect(trigger(page)).toHaveText(target as string);
	});

	test('Escape closes the popup without changing the value', async ({ page, impl }) => {
		await gotoVersionCase(page, versionUrl(impl));
		const before = await trigger(page).textContent();

		await openSelect(page);
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Escape');

		await expect(page.getByRole('listbox')).toHaveCount(0);
		await expect(trigger(page)).toHaveText(before as string);
	});
});

/**
 * Requirements one side or the other cannot meet, encoded per FINDINGS.md. A test that starts
 * passing here means an implementation earned something — retire the marker and record it.
 */
test.describe('select unmet requirements', () => {
	test('opening scrolls the selected release into view', async ({ page, impl }) => {
		/*
		 * pr-5617 regression, reproduced pure (FINDINGS.md): the first open drops the pending
		 * scroll-to-selected and shows the top of the list; closing and reopening lands
		 * correctly. Dev StrictMode masks it — the double-invoked effects give the scroll a
		 * second chance — which is exactly why this suite runs the production build (rule 7).
		 * The baseline lands correctly through its own hand-written scrollToIndex bridge.
		 */
		test.fail(impl === 'pr-5617');

		await gotoVersionCase(page, versionUrl(impl));
		await openSelect(page);

		await expect(page.locator('[role="option"][data-selected]')).toBeInViewport();
	});

	test('End and Home reach releases outside the mounted window', async ({ page, impl }) => {
		/*
		 * Stable Select navigates registered items only, and in a windowed list registration order
		 * is mount order: End lands on the edge of the mounted window (often off-screen — nothing
		 * scrolls the highlight into view without an `onItemHighlighted` bridge, which stable
		 * Select does not offer), and Home returns to whatever mounted first. The canary root is
		 * collection-aware and the virtualizer follows its highlight, mounted or not.
		 */
		test.fail(impl === 'baseline');

		await gotoVersionCase(page, versionUrl(impl));
		await openSelect(page);

		await page.keyboard.press('End');
		await expect(highlighted(page)).toHaveAttribute('aria-posinset', '1250');
		await expect(highlighted(page)).toBeInViewport();

		await page.keyboard.press('Home');
		await expect(highlighted(page)).toHaveAttribute('aria-posinset', '1');
		await expect(highlighted(page)).toBeInViewport();
	});

	test('typeahead reaches releases that were never mounted', async ({ page, impl }) => {
		// Same root cause as End/Home: stable's typeahead matches over registered items, so a
		// prefix whose releases sit outside the window matches nothing and the highlight stays.
		test.fail(impl === 'baseline');

		await gotoVersionCase(page, versionUrl(impl));
		await openSelect(page);

		await page.keyboard.type('5.9', { delay: 60 });

		await expect(nameOf(highlighted(page))).toHaveText(/^5\.9\./);
		await expect(highlighted(page)).toBeInViewport();
	});

	test('the first open mounts a window, not the collection', async ({ page, impl }) => {
		/*
		 * pr-5617 mounts every option while the popup is still hidden — 12,000 rows created and
		 * thrown away before the window takes over, which is over a second of open latency at
		 * this scale on the production preview (FINDINGS.md). The peak is observed with a
		 * MutationObserver armed before the click, because sampling after the popup becomes
		 * visible races the settle pass that shrinks the window back down.
		 */
		test.fail(impl === 'pr-5617');

		await gotoVersionCase(page, versionUrl(impl, { scale: FULL_SCALE, deep: FULL_DEEP }));

		await page.evaluate(() => {
			const win = window as unknown as { maxMountedOptionsProbe: number };
			win.maxMountedOptionsProbe = 0;
			new MutationObserver(() => {
				const count = document.querySelectorAll('[role="option"]').length;
				if (count > win.maxMountedOptionsProbe) {
					win.maxMountedOptionsProbe = count;
				}
			}).observe(document.body, { childList: true, subtree: true });
		});

		await openSelect(page);

		const peak = await page.evaluate(
			() => (window as unknown as { maxMountedOptionsProbe: number }).maxMountedOptionsProbe,
		);
		expect(peak).toBeLessThan(1_000);
	});
});
