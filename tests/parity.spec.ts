import {
	comboboxInput,
	expect,
	expectHighlightAt,
	expectedUserCount,
	gotoStress,
	highlightedOption,
	highlightedPosition,
	openPopup,
	picker,
	stressUrl,
	test,
} from './fixtures';

/**
 * Keyboard and ARIA parity.
 *
 * One spec, run once per registered implementation. It is a parity check, not a test pyramid: the
 * app's correctness bar stays "you notice when using it", and this exists so that "implementation X
 * breaks keyboard navigation" is a reproducible finding rather than an impression (AGENTS.md —
 * Testing).
 *
 * Every assertion is about behaviour or ARIA, never about markup: implementations own the scroll
 * container, the measurement and the index maths, and nothing else, so anything else would be
 * asserting on `ds/combobox`.
 */

/** 1,000 issues, therefore 500 people — small enough to be fast, large enough to need windowing. */
const SCALE = 1_000;
const USERS = expectedUserCount(SCALE);

/** The deep-selection run. 5,000 people, with the value 2,000 rows down. */
const DEEP_SCALE = 10_000;
const DEEP_INDEX = 2_000;

/** Matches names only — no job title or team in the seeded pools contains it. */
const QUERY = 'chen';

function listUrl(impl: string): string {
	return stressUrl(impl, { case: 'scale', scale: SCALE });
}

test.describe('combobox parity', () => {
	test('opens from the input and exposes listbox semantics', async ({ page, impl }) => {
		await gotoStress(page, listUrl(impl));

		const input = comboboxInput(page);
		await expect(input).toHaveAttribute('aria-expanded', 'false');

		await openPopup(page);

		const listbox = page.getByRole('listbox');
		const listboxId = await listbox.getAttribute('id');

		expect(listboxId, 'the listbox needs an id for aria-controls to point at').toBeTruthy();
		await expect(input).toHaveAttribute('aria-controls', listboxId as string);
		await expect(input).toHaveAttribute('aria-haspopup', 'listbox');
	});

	test('reports the real total while rendering only a window', async ({ page, impl }) => {
		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const options = page.getByRole('option');
		const rendered = await options.count();

		expect(rendered).toBeGreaterThan(0);
		expect(rendered, 'every row is in the DOM — nothing is being windowed').toBeLessThan(USERS / 2);

		// `aria-setsize` is the size of the list, not the size of the window. Getting this wrong is
		// invisible on screen and completely changes what a screen reader announces.
		await expect(options.first()).toHaveAttribute('aria-setsize', String(USERS));
		await expect(options.first()).toHaveAttribute('aria-posinset', '1');
		await expect(options.nth(rendered - 1)).toHaveAttribute('aria-setsize', String(USERS));
		await expect(options.nth(rendered - 1)).toHaveAttribute('aria-posinset', String(rendered));
	});

	test('arrow keys move aria-activedescendant to a rendered option', async ({ page, impl }) => {
		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);

		await input.press('ArrowDown');
		await expectHighlightAt(page, 1);

		const first = await highlightedOption(page);
		await expect(first as NonNullable<typeof first>).toHaveAttribute('data-highlighted', '');

		await input.press('ArrowDown');
		await expectHighlightAt(page, 2);

		await input.press('ArrowUp');
		await expectHighlightAt(page, 1);
	});

	test('Home and End move the caret, not the highlight', async ({ page, impl }) => {
		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);
		await input.pressSequentially(QUERY, { delay: 25 });
		await expect(page.getByRole('option').first()).toContainText(new RegExp(QUERY, 'i'));

		await input.press('ArrowDown');
		await expectHighlightAt(page, 1);
		const before = await highlightedPosition(page);

		/*
		 * The ARIA combobox pattern gives Home and End to the text field, not to the listbox: the
		 * input is where the caret lives, and stealing those keys makes a typed query uneditable.
		 * The popup must stay open and the highlight must stay put.
		 */
		await input.press('End');
		expect(await input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(
			QUERY.length,
		);

		await input.press('Home');
		expect(await input.evaluate((node: HTMLInputElement) => node.selectionStart)).toBe(0);

		await expect(input).toHaveAttribute('aria-expanded', 'true');
		expect(await highlightedPosition(page)).toBe(before);
	});

	test('typing narrows through the repository and setsize follows an unknown total', async ({
		page,
		impl,
	}) => {
		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);
		await input.pressSequentially(QUERY, { delay: 25 });
		await expect(page.getByRole('option').first()).toContainText(new RegExp(QUERY, 'i'));

		// A filtered query has no cheap count, so the repository omits `total` (evaluation rule 4).
		// An implementation that needs a count upfront has nowhere to get one, and what it falls back
		// to is exactly what a screen reader will read out.
		await expect(picker(page)).toHaveAttribute('data-total', '');

		await expect(async () => {
			const loaded = Number(await picker(page).getAttribute('data-loaded'));

			expect(loaded).toBeGreaterThan(0);
			expect(loaded, 'the query matched everything — pick a narrower one').toBeLessThan(USERS);
			await expect(page.getByRole('option').first()).toHaveAttribute(
				'aria-setsize',
				String(loaded),
			);
		}).toPass({ timeout: 10_000 });
	});

	test('Enter selects the highlighted option and closes the popup', async ({ page, impl }) => {
		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);
		await input.press('ArrowDown');
		await expectHighlightAt(page, 1);
		await input.press('Enter');

		await expect(input).toHaveAttribute('aria-expanded', 'false');
		await expect(picker(page)).toHaveAttribute('data-preselected', 'true');
		await expect(input).not.toHaveValue('');
	});

	test('Escape closes the popup and returns focus to the input', async ({ page, impl }) => {
		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);
		await input.press('Escape');

		await expect(input).toHaveAttribute('aria-expanded', 'false');
		await expect(input).toBeFocused();
		await expect(page.getByRole('listbox')).toHaveCount(0);
	});
});

/*
 * Requirements this app has that no implementation satisfies yet.
 *
 * These are written as the app needs them, not as the library currently behaves: a contract is
 * never weakened to what an implementation can express (AGENTS.md — evaluation rule 1). A red test
 * here is the finding, and the day a candidate API turns one green is the day it earns its surface.
 */
test.describe('unmet requirements', () => {
	test('Tab closes the popup and moves focus past it', async ({ page, impl }) => {
		/*
		 * Expected to fail — red is the finding (see the describe comment). `test.fail()` keeps CI
		 * green while the requirement stays unmet; an impl that satisfies it reports "unexpectedly
		 * passed", which is the signal to scope this marker to the impls that still fail.
		 */
		test.fail();

		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);
		await input.press('Tab');

		/*
		 * An implementation that owns its scroll container has created a scrollable element with no
		 * focusable children, which Chrome makes a tab stop. Focus lands on that div, never leaves
		 * the popup, and so the dismiss-on-focus-out never fires: the popup stays open with focus
		 * parked on an unnamed element, and a second Tab drops the user on `<body>` with the popup
		 * still up.
		 */
		await expect(input).toHaveAttribute('aria-expanded', 'false');
		await expect(input).not.toBeFocused();
		await expect(page.getByRole('listbox')).toHaveCount(0);
	});

	test('PageDown and PageUp move the highlight by more than one row', async ({ page, impl }) => {
		// Expected to fail — red is the finding; same deal as the Tab test above.
		test.fail();

		await gotoStress(page, listUrl(impl));
		await openPopup(page);

		const input = comboboxInput(page);
		await input.press('ArrowDown');
		await expectHighlightAt(page, 1);

		await input.press('PageDown');
		await expect(async () => {
			const position = await highlightedPosition(page);

			expect(position, 'PageDown did not move the highlight').not.toBeNull();
			expect(position as number).toBeGreaterThan(2);
		}).toPass({ timeout: 5_000 });

		const paged = (await highlightedPosition(page)) as number;

		await input.press('PageUp');
		await expect(async () => {
			const position = await highlightedPosition(page);

			expect(position, 'PageUp did not move the highlight').not.toBeNull();
			expect(position as number).toBeLessThan(paged);
		}).toPass({ timeout: 5_000 });
	});

	test('opening with a deep preselected value scrolls it into view', async ({ page, impl }) => {
		test.slow();

		await gotoStress(
			page,
			stressUrl(impl, { case: 'preselected', scale: DEEP_SCALE, deep: DEEP_INDEX }),
		);

		await expect(picker(page)).toHaveAttribute('data-preselect-settled', 'true', {
			timeout: 90_000,
		});

		await openPopup(page);

		// The highlight must name a row that exists: `aria-activedescendant` pointing at an id that
		// was never rendered announces nothing at all, and the user sees the top of a list whose
		// selection is thousands of rows below.
		await expectHighlightAt(page, DEEP_INDEX + 1);

		const option = await highlightedOption(page);
		await expect(option as NonNullable<typeof option>).toBeInViewport();
	});
});
