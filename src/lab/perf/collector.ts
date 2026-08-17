/**
 * Performance-API instrumentation for the lab overlay.
 *
 * Everything here comes from `PerformanceObserver` and `requestAnimationFrame`, never from React
 * DevTools: perf conclusions are only drawn from `vite build && vite preview`, where the DevTools
 * hook and the profiler build do not exist (AGENTS.md — evaluation rules 7 and 11). React render
 * counts are a dev-only diagnostic and deliberately absent.
 *
 * The collector is framework-free and mutable on purpose. It accumulates into plain fields and
 * only produces a `PerfSnapshot` when the overlay asks for one, so measuring costs one observer
 * callback per slow interaction rather than a React state update per event — the overlay must not
 * perturb what it measures (PLAN.md — Things that will be subtle).
 */

/** Event Timing entries. `interactionId` is not in every TS DOM lib, so the shape is local. */
interface EventTimingEntry extends PerformanceEntry {
	readonly interactionId?: number;
}

/** Long Animation Frame entries. No TS DOM lib ships these yet. */
interface LongAnimationFrameEntry extends PerformanceEntry {
	readonly blockingDuration?: number;
}

export interface InteractionStats {
	/** Interactions observed, after grouping every entry that shares an `interactionId`. */
	count: number;
	p50: number;
	p95: number;
	worst: number;
	worstEvent: string | null;
}

export interface LongFrameStats {
	count: number;
	worst: number;
	/** Worst `blockingDuration` — the part of the frame a user gesture would have queued behind. */
	worstBlocking: number;
}

export interface ScrollStats {
	/** A scroll gesture is in flight right now. */
	active: boolean;
	/** Animation frames sampled while scrolling. */
	frames: number;
	/** Frames the display should have shown and did not. */
	dropped: number;
	worstGap: number;
	/** Frame budget the sampler settled on, in ms. Adapts to 120Hz displays. */
	frameBudget: number;
}

export interface PerfSupport {
	eventTiming: boolean;
	longAnimationFrame: boolean;
}

export interface PerfSnapshot {
	interactions: InteractionStats;
	longFrames: LongFrameStats;
	scroll: ScrollStats;
	support: PerfSupport;
}

export interface PerfCollector {
	start: () => void;
	stop: () => void;
	reset: () => void;
	/** True when something changed since the last `read()`. Lets the overlay skip idle re-renders. */
	dirty: () => boolean;
	read: () => PerfSnapshot;
}

/*
 * 16ms is the floor the Event Timing spec allows. A lower threshold is not available, so p50 is
 * the median of *reported* interactions — anything that finished inside a frame is never delivered
 * and cannot be counted. That is a property of the API, not of the implementation under test, and
 * it applies identically to every implementation, which is what makes the comparison fair.
 */
const EVENT_DURATION_THRESHOLD = 16;

/** Bounded so a long session cannot grow the map without limit. Oldest interactions are evicted. */
const MAX_INTERACTIONS = 400;

/** How long after the last scroll event the frame sampler keeps running. */
const SCROLL_IDLE_MS = 250;

/** Starting frame budget. Revised down when a faster display proves itself. */
const DEFAULT_FRAME_MS = 1000 / 60;

/** Nothing below this is a real frame interval; it is a coalesced callback. */
const MIN_FRAME_MS = 6.5;

/**
 * Continuous gestures fire per-pixel and would swamp the percentiles with events nobody waits on.
 * Discrete input — keystrokes, taps, clicks — is what "did the picker keep up" means.
 */
const CONTINUOUS_EVENTS = new Set(['pointermove', 'mousemove', 'touchmove', 'dragover']);

function supports(entryType: string): boolean {
	if (typeof PerformanceObserver === 'undefined') {
		return false;
	}

	return (PerformanceObserver.supportedEntryTypes ?? []).includes(entryType);
}

function percentile(sorted: readonly number[], fraction: number): number {
	if (sorted.length === 0) {
		return 0;
	}

	const rank = Math.ceil(fraction * sorted.length) - 1;
	const index = Math.min(sorted.length - 1, Math.max(0, rank));

	return sorted[index] ?? 0;
}

export function createPerfCollector(): PerfCollector {
	/** Keyed by interaction, so a keydown/input/keyup triple counts once, at its worst part. */
	const interactions = new Map<string, { duration: number; event: string }>();

	let eventObserver: PerformanceObserver | null = null;
	let frameObserver: PerformanceObserver | null = null;
	let running = false;
	let changed = true;

	let longFrameCount = 0;
	let longFrameWorst = 0;
	let longFrameWorstBlocking = 0;

	let scrollActive = false;
	let scrollFrames = 0;
	let scrollDropped = 0;
	let scrollWorstGap = 0;
	let frameBudget = DEFAULT_FRAME_MS;
	let lastScrollAt = 0;
	let lastFrameAt: number | null = null;
	let rafHandle: number | null = null;

	function recordEvents(list: PerformanceObserverEntryList): void {
		for (const entry of list.getEntries() as EventTimingEntry[]) {
			if (CONTINUOUS_EVENTS.has(entry.name)) {
				continue;
			}

			/*
			 * `interactionId` groups the entries of one gesture the way INP does. Firefox ships
			 * event timing without it, so entries fall back to their start time — coarser, but it
			 * still keeps a keydown and its paint from counting as two interactions.
			 */
			const id = entry.interactionId ?? 0;
			const key = id > 0 ? `i${id}` : `t${Math.round(entry.startTime)}`;
			const previous = interactions.get(key);

			if (previous === undefined || entry.duration > previous.duration) {
				interactions.delete(key);
				interactions.set(key, { duration: entry.duration, event: entry.name });
			}
		}

		while (interactions.size > MAX_INTERACTIONS) {
			const oldest = interactions.keys().next();

			if (oldest.done === true) {
				break;
			}

			interactions.delete(oldest.value);
		}

		changed = true;
	}

	function recordLongFrames(list: PerformanceObserverEntryList): void {
		for (const entry of list.getEntries() as LongAnimationFrameEntry[]) {
			longFrameCount += 1;
			longFrameWorst = Math.max(longFrameWorst, entry.duration);
			longFrameWorstBlocking = Math.max(longFrameWorstBlocking, entry.blockingDuration ?? 0);
		}

		changed = true;
	}

	function tick(now: number): void {
		if (lastFrameAt !== null) {
			const delta = now - lastFrameAt;

			if (delta >= MIN_FRAME_MS && delta < frameBudget) {
				frameBudget = delta;
			}

			scrollFrames += 1;
			scrollDropped += Math.max(0, Math.round(delta / frameBudget) - 1);
			scrollWorstGap = Math.max(scrollWorstGap, delta);
			changed = true;
		}

		lastFrameAt = now;

		if (now - lastScrollAt > SCROLL_IDLE_MS) {
			rafHandle = null;
			lastFrameAt = null;
			scrollActive = false;
			changed = true;
			return;
		}

		rafHandle = requestAnimationFrame(tick);
	}

	/*
	 * The sampler exists only while a scroll gesture is in flight. Subscribing to every frame for
	 * the life of the page would add a callback to frames nobody is looking at, and those are
	 * exactly the frames a virtualizer needs.
	 */
	function handleScroll(): void {
		lastScrollAt = performance.now();

		if (rafHandle === null) {
			scrollActive = true;
			lastFrameAt = null;
			changed = true;
			rafHandle = requestAnimationFrame(tick);
		}
	}

	function start(): void {
		if (running) {
			return;
		}

		running = true;

		if (supports('event')) {
			eventObserver = new PerformanceObserver(recordEvents);
			eventObserver.observe({
				type: 'event',
				// Not in `PerformanceObserverInit` in every TS DOM lib.
				durationThreshold: EVENT_DURATION_THRESHOLD,
				// Entries buffered before you switched the overlay on describe page load, not the
				// picker. The numbers start when you start looking.
				buffered: false,
			} as PerformanceObserverInit);
		}

		if (supports('long-animation-frame')) {
			frameObserver = new PerformanceObserver(recordLongFrames);
			frameObserver.observe({ type: 'long-animation-frame', buffered: false });
		}

		// Capture: the scroll container is the popup's own element, and scroll does not bubble.
		window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
	}

	function stop(): void {
		if (!running) {
			return;
		}

		running = false;
		eventObserver?.disconnect();
		frameObserver?.disconnect();
		eventObserver = null;
		frameObserver = null;
		window.removeEventListener('scroll', handleScroll, { capture: true });

		if (rafHandle !== null) {
			cancelAnimationFrame(rafHandle);
			rafHandle = null;
		}

		scrollActive = false;
		lastFrameAt = null;
	}

	function reset(): void {
		interactions.clear();
		longFrameCount = 0;
		longFrameWorst = 0;
		longFrameWorstBlocking = 0;
		scrollFrames = 0;
		scrollDropped = 0;
		scrollWorstGap = 0;
		frameBudget = DEFAULT_FRAME_MS;
		changed = true;
	}

	function read(): PerfSnapshot {
		changed = false;

		const durations: number[] = [];
		let worst = 0;
		let worstEvent: string | null = null;

		for (const sample of interactions.values()) {
			durations.push(sample.duration);

			if (sample.duration > worst) {
				worst = sample.duration;
				worstEvent = sample.event;
			}
		}

		durations.sort((a, b) => a - b);

		return {
			interactions: {
				count: durations.length,
				p50: percentile(durations, 0.5),
				p95: percentile(durations, 0.95),
				worst,
				worstEvent,
			},
			longFrames: {
				count: longFrameCount,
				worst: longFrameWorst,
				worstBlocking: longFrameWorstBlocking,
			},
			scroll: {
				active: scrollActive,
				frames: scrollFrames,
				dropped: scrollDropped,
				worstGap: scrollWorstGap,
				frameBudget,
			},
			support: {
				eventTiming: supports('event'),
				longAnimationFrame: supports('long-animation-frame'),
			},
		};
	}

	return { start, stop, reset, dirty: () => changed, read };
}
