# Findings

The verdict on the three Combobox virtualization PRs, assembled as the evidence lands. Method and
rules: `AGENTS.md`; sequence: `PLAN.md` Phase 9. Primary evidence is the diff of `src/impls/*` —
how much code each API needs to satisfy identical real requirements, what leaks upward, and which
requirements an API simply cannot express. Frame timings are supporting evidence, never the
headline.

## The candidates

|            | Combobox surface                         | Standalone surface                                                              |
| ---------- | ---------------------------------------- | ------------------------------------------------------------------------------- |
| `baseline` | stable + TanStack Virtual, as documented | TanStack Virtual                                                                |
| `pr-5173`  | built-in `<Combobox.Virtualizer>`        | _(none — `@mui/x-virtualizer` scaffolding, excluded from API-cost comparisons)_ |
| `pr-5414`  | `<ListVirtualizer>` in `Combobox.List`   | app-authored virtualization host + `<ListVirtualizer>`                          |
| `pr-5466`  | `<Virtualizer>` context binding          | `<Virtualizer items>` props mode                                                |

## App-code cost

_To be filled from the landed implementations: non-comment lines per file, per surface, with the
baseline as 100. The pr-5414 host is broken out separately — it is the price of the context-only
API, not of virtualization._

| impl     | Combobox | List         | of which: host/scaffolding                                                                                |
| -------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| baseline | 236      | 81           | —                                                                                                         |
| pr-5173  | 194      | _(excluded)_ | List is a 148-line raw `@mui/x-virtualizer` adapter, ~1.8× baseline — engine ergonomics, not the PR's API |
| pr-5414  | 229      | 125          | 33 (the app-authored host)                                                                                |
| pr-5466  |          |              | —                                                                                                         |
| pr-5466  |          |              | —                                                                                                         |

## Requirements an API could not express

Rule 1: these are headline findings, not implementation defects.

| Requirement (contract)                           | baseline | pr-5173                                                                        | pr-5414                                            | pr-5466                                                                              |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Grouped rows (`groupOf`)                         | ✓        | ✗ unexpressible — flat only, warns                                             | ◐ header folded into its item's row; never sticky  | ◐ header folded into its item's row; never sticky                                    |
| Create-row / loading-row (non-item rows)         | ✓        | ✗ pushed outside the scrollport                                                | ◐ outside the scroll container                     | ◐ create pinned below the list; loading folded into the last row so it still scrolls |
| Unknown `total` (`aria-setsize` without a count) | ✓        | ◐ part injects loaded count; override relies on prop-merge order               | ✓                                                  | ◐ injects loaded count; one-line override                                            |
| Variable measured heights                        | ✓        | ◐ measured, but keyboard scroll-into-view uses stale estimates (see Behaviour) | ✓                                                  | ✓                                                                                    |
| `onEndReached` (list)                            | ✓        | ✗ no signal; hand-written onScroll math                                        | ◐ observable only from inside a mounted row        | ◐ sentinel component smuggled into the renderer                                      |
| Scroll reset on result-set change (list)         | ✓        | ✓                                                                              | ✓                                                  | ✓                                                                                    |
| `measureVersion` (drop caches on breakpoint)     | ✓        | ✓                                                                              | ✗ only `key=` remount, which loses scroll position | ✗ only `key=` remount, which loses scroll position                                   |

## Behaviour findings

- **pr-5173: keyboard scroll-into-view computed from stale estimates.** With `estimatedItemHeight`
  below the measured height, arrowing past the fold parks the active row entirely below the
  scrollport (top 262 / bottom 316 in a 251px viewport) and never self-corrects; with the estimate
  at or above measured height the same layout is exact at every depth. Pure-canary subtree;
  reduced-repro still owed (rule 12). Bites precisely the variable-height rows of rule 9, and the
  docs' suggested default estimate is a flat 32px.
- **pr-5414: no measurement-invalidation API.** Crossing a layout breakpoint can only be handled by
  remounting the virtualizer via `key=`, which resets scroll to the top — verified against the
  baseline's `measure()`, which keeps the offset.
- **pr-5414/5466 engine: callbacks consumed eagerly.** `getItemKey` and per-item
  `estimatedItemHeight` are materialized over the whole collection, cache-keyed on callback
  identity — inline arrows from the feature layer trigger two O(n) passes per parent render.
  Both landed impls carry a `useStableCallback`-style guard; TanStack calls lazily per index.
- **pr-5414: what the host buys.** No keyboard-to-virtualizer bridge at all — `activeIndex` +
  `scrollActiveIntoView` in list state and the virtualizer scrolls itself, correctly, including
  scroll-to-selected on open. The baseline needs `onItemHighlighted` → `rowIndexOfItem` →
  `scrollToIndex` for the same behaviour.

- **All three canaries: the library-owned scrollport is not keyboard-reachable.**
  `scrollable-region-focusable [serious]` on the list scroller in every axe case (open popup,
  highlighted row, variable heights, RTL, in-dialog) for 5173, 5414 and 5466 — and not for the
  baseline, where the app owns that element. The mirror image of the baseline's Tab-trap: one side
  makes the scroller a tab stop and breaks Tab-dismissal, the other removes it from the tab order
  and leaves keyboard users unable to scroll except by moving the highlight. Neither default is
  right; the API needs to take a position.
- **pr-5466: the two modes need different sizing.** In the popup, `flex: 1` lets the scrollport
  size from the rows it rendered — a feedback loop resolved by `height: var(--total-size)` per the
  PR docs; the issues list needs nothing because its container height is definite. Same component,
  same props, two sizing stories the app has to know.
- **pr-5414/5466: the baseline's per-arrow-key `flushSync` warning is gone** — the virtualizer
  scrolls itself, so no `scrollToIndex` runs inside a React lifecycle.
- **None of the three PRs changes Tab-dismissal or PageDown/PageUp** — the canaries fail the same
  two expected-failure tests as the baseline.

## Parity and accessibility matrix

`pnpm test:e2e`, production preview, 2026-08-18: **65 passed / 15 failed** over 4 projects × 20
tests. Every failure is the one finding above — `scrollable-region-focusable` × 5 axe cases × 3
canaries. Keyboard parity (16 combobox tests) and the standalone-list suite (4 tests) pass on all
four implementations; the two expected failures (Tab-dismissal, PageUp/PageDown) reproduce
identically on all four. Still owed for rule 8: the manual VoiceOver pass and the Safari/Firefox
run.

## Packaging and integration findings

Found while making the comparison possible at all; they are about shipping these PRs, not their
APIs.

- **Type-identity collapse.** All canaries declare `@base-ui/react@1.7.0`; TypeScript dedupes
  declarations by `name@version`, so aliased types silently resolve to stable's. Any consumer
  installing a canary next to stable hits this. Worked around in `scripts/patch-canaries.mjs`.
- **pr-5414's host primitives are not exported.** `internals/virtualization/*` ships in the tarball
  but the exports map does not cover it; standalone use requires widening it (same script).
- **Canary builds pin the published `@base-ui/utils`, which cannot satisfy them.** All three PRs
  import utils subpaths (`clamp`, `areArraysEqual`, `formatNumber`, `shadowDom`,
  `stringifyLocale`) added after 0.3.2, but pkg.pr.new publishes only `@base-ui/react` with its
  utils pin unchanged — no canary module graph resolves out of the box. Fixed via a
  `.pnpmfile.cjs` hook keyed on the `@mui/x-virtualizer` dependency (the only resolution-time
  marker distinguishing canaries from stable). The canary utils then needs the same type-identity
  split as the canaries themselves.

## Perf notes

_Production preview only (rule 7): keystroke→paint under `?people=eager`, long-animation-frames
while scrolling, per-impl chunk sizes from the build report._

## Verdict

_Last: written only when every row above is filled in._
