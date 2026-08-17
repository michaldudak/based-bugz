import { useComboboxImpl } from '@/ds/combobox';
import { Switch } from '@/ds/switch';
import { usePerfReading, usePerfSwitch } from './usePerf';
import type { PerfSnapshot } from './collector';
import styles from './PerfOverlay.module.css';

function ms(value: number): string {
	if (value === 0) {
		return '—';
	}

	return `${value < 10 ? value.toFixed(1) : Math.round(value)}ms`;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
	return (
		<div className={styles.metric}>
			<dt className={styles.metricLabel}>{label}</dt>
			<dd className={styles.metricValue}>
				{value}
				{hint !== undefined && <span className={styles.metricHint}>{hint}</span>}
			</dd>
		</div>
	);
}

function Readout({ snapshot }: { snapshot: PerfSnapshot }) {
	const { interactions, longFrames, scroll, support } = snapshot;

	return (
		<>
			<section className={styles.group}>
				<h3 className={styles.groupTitle}>
					Interaction latency
					{!support.eventTiming && <span className={styles.unsupported}> unsupported</span>}
				</h3>
				<dl className={styles.metrics}>
					<Metric label="p50" value={ms(interactions.p50)} />
					<Metric label="p95" value={ms(interactions.p95)} />
					<Metric
						label="worst"
						value={ms(interactions.worst)}
						hint={interactions.worstEvent ?? undefined}
					/>
					<Metric label="n" value={String(interactions.count)} />
				</dl>
			</section>

			<section className={styles.group}>
				<h3 className={styles.groupTitle}>
					Long animation frames
					{!support.longAnimationFrame && <span className={styles.unsupported}> unsupported</span>}
				</h3>
				<dl className={styles.metrics}>
					<Metric label="count" value={String(longFrames.count)} />
					<Metric label="worst" value={ms(longFrames.worst)} />
					<Metric label="blocking" value={ms(longFrames.worstBlocking)} />
				</dl>
			</section>

			<section className={styles.group}>
				<h3 className={styles.groupTitle}>
					Scrolling
					{scroll.active && <span className={styles.live}> live</span>}
				</h3>
				<dl className={styles.metrics}>
					<Metric label="dropped" value={String(scroll.dropped)} />
					<Metric label="frames" value={String(scroll.frames)} />
					<Metric label="worst gap" value={ms(scroll.worstGap)} />
					<Metric label="budget" value={ms(scroll.frameBudget)} />
				</dl>
			</section>
		</>
	);
}

function PerfOverlayBody({ onHide }: { onHide: () => void }) {
	const { activeName } = useComboboxImpl();
	const { snapshot, reset } = usePerfReading(true);

	return (
		<aside className={styles.overlay} data-testid="perf-overlay" aria-label="Performance overlay">
			<header className={styles.header}>
				{/* The implementation name is on the panel so a screenshot describes itself. */}
				<span className={styles.impl} data-testid="perf-impl">
					{activeName}
				</span>
				<div className={styles.actions}>
					<button type="button" className={styles.action} onClick={reset}>
						Reset
					</button>
					<button type="button" className={styles.action} onClick={onHide}>
						Hide
					</button>
				</div>
			</header>

			{snapshot === null ? (
				<p className={styles.pending}>Starting…</p>
			) : (
				<Readout snapshot={snapshot} />
			)}

			<p className={styles.footnote}>
				Performance API only. Interactions below 16ms are never reported, so p50 is the median of
				what the browser considered slow enough to tell us about.
			</p>
		</aside>
	);
}

/**
 * The overlay itself. Renders nothing at all when `?perf=` is absent, so the observers, the scroll
 * listener and the flush timer do not exist on an ordinary run.
 *
 * Kept as a sibling of whatever it measures: its 2Hz state updates re-render this subtree and
 * nothing else.
 */
export function PerfOverlay() {
	const { enabled, setEnabled } = usePerfSwitch();

	if (!enabled) {
		return null;
	}

	return <PerfOverlayBody onHide={() => setEnabled(false)} />;
}

/** The in-app switch, for when reaching for the URL is more friction than the measurement. */
export function PerfToggle() {
	const { enabled, setEnabled } = usePerfSwitch();

	return <Switch label="Perf overlay" checked={enabled} onCheckedChange={setEnabled} />;
}
