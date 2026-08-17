/**
 * React bindings for the perf collector.
 *
 * `?perf=1` is the switch, so an instrumented run is reproducible from its link like every other
 * setting in this app. Default off — an always-on overlay turns dogfooding into number-reading, and
 * the qualitative pain is the part nothing else gives you (AGENTS.md — evaluation rule 11).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { createPerfCollector } from './collector';
import type { PerfCollector, PerfSnapshot } from './collector';

/** 2Hz. Fast enough to watch, slow enough that the overlay is not in the interaction it measures. */
const FLUSH_MS = 500;

export interface PerfSwitch {
	enabled: boolean;
	setEnabled: (next: boolean) => void;
}

export function usePerfSwitch(): PerfSwitch {
	const [searchParams, setSearchParams] = useSearchParams();
	const raw = searchParams.get('perf');
	const enabled = raw === '' || raw === '1' || raw?.toLowerCase() === 'true';

	const setEnabled = useCallback(
		(next: boolean) => {
			setSearchParams(
				(current) => {
					const updated = new URLSearchParams(current);

					if (next) {
						updated.set('perf', '1');
					} else {
						updated.delete('perf');
					}

					return updated;
				},
				{ replace: true },
			);
		},
		[setSearchParams],
	);

	return useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
}

export interface PerfReading {
	snapshot: PerfSnapshot | null;
	reset: () => void;
}

/**
 * Observers exist only while `enabled`. Off means no observer, no scroll listener and no timer —
 * not a hidden overlay quietly measuring.
 */
export function usePerfReading(enabled: boolean): PerfReading {
	const [snapshot, setSnapshot] = useState<PerfSnapshot | null>(null);
	const collectorRef = useRef<PerfCollector | null>(null);

	useEffect(() => {
		if (!enabled) {
			setSnapshot(null);
			return;
		}

		const collector = createPerfCollector();
		collectorRef.current = collector;
		collector.start();
		setSnapshot(collector.read());

		const timer = window.setInterval(() => {
			// Nothing happened since the last flush: skip the render rather than paint the same
			// numbers again in the middle of somebody's scroll.
			if (collector.dirty()) {
				setSnapshot(collector.read());
			}
		}, FLUSH_MS);

		return () => {
			window.clearInterval(timer);
			collector.stop();
			collectorRef.current = null;
		};
	}, [enabled]);

	const reset = useCallback(() => {
		const collector = collectorRef.current;

		if (collector) {
			collector.reset();
			setSnapshot(collector.read());
		}
	}, []);

	return useMemo(() => ({ snapshot, reset }), [snapshot, reset]);
}
