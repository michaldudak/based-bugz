import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/ds/button';
import { Dialog } from '@/ds/dialog';
import { Popover } from '@/ds/popover';
import { StressIssuePicker } from './StressIssuePicker';
import { StressUserPicker } from './StressUserPicker';
import styles from './StressLabPage.module.css';

export interface StressCase {
	id: string;
	title: string;
	/** What you see when this case fails. One line — a case nobody can describe is not a case. */
	breaks: string;
	render: () => ReactNode;
}

/** Where the deep preselected value sits when `?deep=` is absent. */
export const DEFAULT_DEEP_INDEX = 4000;

function useNumberParam(key: string, fallback: number): number {
	const [searchParams] = useSearchParams();
	const raw = searchParams.get(key);

	if (raw === null || raw.trim() === '') {
		return fallback;
	}

	const value = Number(raw);

	return Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback;
}

/**
 * `scale` is read once, from `window.location.search`, when the repository is constructed — so
 * changing it is a navigation, not a state update. These are real links for that reason.
 */
function ScaleLinks({ presets }: { presets: readonly number[] }) {
	const [searchParams] = useSearchParams();
	const current = searchParams.get('scale');

	return (
		<p className={styles.links}>
			Dataset:{' '}
			{presets.map((scale, index) => {
				const next = new URLSearchParams(searchParams);
				next.set('scale', String(scale));

				return (
					<span key={scale}>
						{index > 0 && ' · '}
						<a
							className={styles.link}
							href={`?${next.toString()}`}
							aria-current={current === String(scale) ? 'page' : undefined}
						>
							{(scale / 2).toLocaleString()} people
						</a>
					</span>
				);
			})}
		</p>
	);
}

function ScaleCase() {
	return (
		<>
			<p className={styles.caseNote}>
				<code>?scale=</code> is the issue count and every other entity derives from it, so the
				people list is half of it — <code>?scale=200000</code> is 100,000 people. Nothing
				materializes: the generator is a pure <code>(seed, index) → entity</code> function and the
				picker pages 40 rows at a time, so switching datasets is as cheap as switching pages.
			</p>
			<ScaleLinks presets={[10_000, 200_000, 2_000_000]} />
			<StressUserPicker testId="stress-picker" label="Assignee" />
		</>
	);
}

function VariableHeightCase() {
	return (
		<>
			<p className={styles.caseNote}>
				Issue titles, not a fixture. The seeded generator puts a ~300-character title at index 3, an
				unbreakable 90-character word at index 5 and a zero-width-space title at index 11, and the
				default sort is newest first — so all three are on the first page. Toggle the naive estimate
				to see what a caller who never thought about height gets.
			</p>
			<StressIssuePicker testId="stress-picker" />
		</>
	);
}

function RtlCase() {
	const [searchParams, setSearchParams] = useSearchParams();
	const rtl = searchParams.get('dir') === 'rtl';

	function toggle() {
		setSearchParams(
			(current) => {
				const next = new URLSearchParams(current);

				if (rtl) {
					next.delete('dir');
				} else {
					next.set('dir', 'rtl');
				}

				return next;
			},
			{ replace: true },
		);
	}

	return (
		<>
			<p className={styles.caseNote}>
				<code>?dir=rtl</code> puts <code>dir</code> on <code>&lt;html&gt;</code>. Watch the
				popup&rsquo;s start edge against the input&rsquo;s, the chevron and check placement inside
				rows, and which way ArrowLeft/ArrowRight move. Names in the seeded data are Arabic and
				Hebrew in places, so bidirectional runs are in the list whichever direction the page is.
			</p>
			<p className={styles.links}>
				<Button size="sm" onClick={toggle}>
					{rtl ? 'Back to LTR' : 'Switch to RTL'}
				</Button>
			</p>
			<StressUserPicker testId="stress-picker" label="Assignee" />
		</>
	);
}

function DialogCase() {
	return (
		<>
			<p className={styles.caseNote}>
				A modal dialog with a combobox in it. The popup portals to the body while the dialog traps
				focus, so this is the pairing where one Escape has to close exactly one thing and the popup
				has to land above the backdrop.
			</p>
			<Dialog>
				<Dialog.Trigger>Open dialog</Dialog.Trigger>
				<Dialog.Title>Assign issue</Dialog.Title>
				<Dialog.Description>
					The picker below is the same component every other case uses.
				</Dialog.Description>
				<StressUserPicker testId="stress-picker" label="Assignee" />
			</Dialog>
		</>
	);
}

function PopoverCase() {
	return (
		<>
			<p className={styles.caseNote}>
				A non-modal popover with a combobox in it. Two dismissable layers, both listening for
				outside clicks: picking a row must not take the popover down with the popup, and one Escape
				must not close both.
			</p>
			<Popover trigger={<Button>Open popover</Button>} className={styles.popoverBody}>
				<StressUserPicker testId="stress-picker" label="Assignee" />
			</Popover>
		</>
	);
}

function PreselectedCase() {
	const deep = useNumberParam('deep', DEFAULT_DEEP_INDEX);

	return (
		<>
			<p className={styles.caseNote}>
				The value is the person at position {deep.toLocaleString()}. The picker pages forward until
				that row exists, then selects it — so by the time you open the popup, the selection is
				thousands of rows below the first window. Opening should land on it. <code>?deep=</code>{' '}
				moves it.
			</p>
			<StressUserPicker
				testId="stress-picker"
				label="Assignee"
				pageSize={500}
				preselectIndex={deep}
			/>
		</>
	);
}

/**
 * Browser zoom is not something a page can read directly. The CSS viewport shrinking while the
 * device pixel ratio grows is the observable half, and it is enough to tell 100% from 200%.
 */
function ZoomReadout() {
	const [viewport, setViewport] = useState(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
		ratio: window.devicePixelRatio,
	}));

	useEffect(() => {
		function update() {
			setViewport({
				width: window.innerWidth,
				height: window.innerHeight,
				ratio: window.devicePixelRatio,
			});
		}

		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	return (
		<p className={styles.links} data-testid="zoom-readout">
			CSS viewport {viewport.width}×{viewport.height} · devicePixelRatio {viewport.ratio.toFixed(2)}
		</p>
	);
}

function ZoomCase() {
	return (
		<>
			<p className={styles.caseNote}>
				Checked by hand: press ⌘/Ctrl and <kbd>+</kbd> until the readout halves, then open the
				popup. Everything on this route is sized in <code>rem</code> and the popup is capped by{' '}
				<code>--available-height</code>, so at 200% the list should get shorter rather than run off
				the screen — and the row heights the virtualizer measured at 100% are all wrong now, which
				is the actual test.
			</p>
			<ZoomReadout />
			<StressUserPicker testId="stress-picker" label="Assignee" />
		</>
	);
}

export const STRESS_CASES: readonly StressCase[] = [
	{
		id: 'scale',
		title: '100k rows',
		breaks:
			'The popup opens blank with a correctly sized scrollbar, or scrolling past the loaded pages leaves a gap where rows should be.',
		render: () => <ScaleCase />,
	},
	{
		id: 'variable',
		title: 'Variable heights',
		breaks:
			'Rows shift under the pointer as they measure, the scroll thumb resizes while you read, or arrowing past a tall row skips the one after it.',
		render: () => <VariableHeightCase />,
	},
	{
		id: 'rtl',
		title: 'RTL',
		breaks:
			'The popup aligns to the wrong edge of the input, or horizontal arrow keys move the caret the wrong way.',
		render: () => <RtlCase />,
	},
	{
		id: 'dialog',
		title: 'In a dialog',
		breaks:
			'Escape closes the dialog instead of the popup, the popup renders under the backdrop, or focus never comes back to the input.',
		render: () => <DialogCase />,
	},
	{
		id: 'popover',
		title: 'In a popover',
		breaks:
			'Selecting a row dismisses the popover too, or the popup is treated as an outside click by the layer beneath it.',
		render: () => <PopoverCase />,
	},
	{
		id: 'preselected',
		title: 'Deep selection',
		breaks:
			'Opening shows the top of the list with the selected row nowhere on screen, or it scrolls to a position measured from estimates and lands short.',
		render: () => <PreselectedCase />,
	},
	{
		id: 'zoom',
		title: '200% zoom',
		breaks:
			'The popup grows past the viewport with no way to reach the last row, or the anchor width stays at its pre-zoom pixel value.',
		render: () => <ZoomCase />,
	},
];

export const DEFAULT_STRESS_CASE = 'scale';

export function findStressCase(id: string | null): StressCase {
	return (
		STRESS_CASES.find((entry) => entry.id === id) ??
		STRESS_CASES.find((entry) => entry.id === DEFAULT_STRESS_CASE) ??
		STRESS_CASES[0]!
	);
}
