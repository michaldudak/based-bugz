# Findings

**Outcome (2026-09): mui/base-ui#5466 — the dual-mode `Virtualizer` — was chosen.** The pr-5173
and pr-5414 implementations are removed from the app; everything below is preserved as the
evidence base and as the worklist of what the winning PR still owes. Since 2026-09-09 the tracked
canary is mui/base-ui#5617 — #5466 rebased onto the 1.8.0 head, same Virtualizer API, plus Select
support — installed as `pr-5617`.

The verdict on the three Combobox virtualization PRs, assembled as the evidence landed. Method and
rules: `AGENTS.md`; sequence: `PLAN.md` Phase 9. Primary evidence is the diff of `src/impls/*` —
how much code each API needs to satisfy identical real requirements, what leaks upward, and which
requirements an API simply cannot express. Frame timings are supporting evidence, never the
headline.

## Still open on the winner (re-verified on the 2026-09-08 head of #5617, 2026-09-09)

1. **Scrollport not keyboard-reachable** — `scrollable-region-focusable [serious]`, still pinned
   in `tests/a11y.spec.ts`. The API has still not taken a position on the Tab-stop trade-off.
2. **No measurement-invalidation API** — `VirtualizerActions` still exposes only `scrollToIndex`;
   crossing a layout breakpoint still means `key=`-remounting and losing the scroll position.
3. **No end-reached signal** — paging is still observed from inside the renderer via a sentinel.
4. **`resetScroll` exists but stays internal** — on `VirtualizerHandle`, reachable only through a
   list root's registry, not through `actionsRef`.
5. **Tab-dismissal: nondeterministic on Linux, swallowed on macOS.** Identical CI runs of the
   2026-09-04 head both passed and failed the Tab test on Linux (dismissed vs popup left open);
   on macOS, Tab does nothing — focus stays on the input, and the scroller is not involved (it
   is not focusable). The macOS swallow reproduces unchanged on the #5617 head. Encoded in the
   suite as expected-failure on macOS and an annotated skip on Linux, because a coin flip can be
   pinned as neither pass nor failure. The race needs reducing upstream before the PR merges.
6. **Select: the first open mounts the whole collection while hidden** — see The Select surface.
7. **Select: the first open drops scroll-to-selected** — see The Select surface.

**Closed on the #5617 head — PageUp/PageDown.** The 2026-09-04 #5466 head paged on Linux but
still moved the highlight one row on macOS; the 2026-09-08 #5617 head pages on macOS too, so the
platform split is gone and this is the first candidate to satisfy the paging requirement
everywhere the suite runs. The expected-failure now scopes to the baseline alone; Linux
confirmation rides on the next CI run.

Confirmed still working on the same head: variable measured heights (deep keyboard navigation
exact to 1px through a 328px row), `aria-activedescendant` on the input, the `--total-size`
sizing contract, eager mode over 5,000 people, deep preselection, and a clean console in dev
StrictMode across both surfaces.

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

| impl     | Combobox | List                         | of which: host/scaffolding                                                                                |
| -------- | -------- | ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| baseline | 236      | 81                           | —                                                                                                         |
| pr-5173  | 194      | _(excluded)_                 | List is a 148-line raw `@mui/x-virtualizer` adapter, ~1.8× baseline — engine ergonomics, not the PR's API |
| pr-5414  | 229      | 125                          | 33 (the app-authored host)                                                                                |
| pr-5466  | 224      | 75 (+7-line paging sentinel) | —                                                                                                         |

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

## The Select surface (added 2026-09-09, mui/base-ui#5617)

\#5617 extends the chosen Virtualizer with Select support, so the app grew a third evaluated
surface: `ds/select`'s data-driven Select, dogfooded as the issue's "Affects version" field over
a release list that scales with the dataset (1,250 versions at the default 10k issues, 12,000 at
the cap) and stress-cased at `/lab/stress?case=version`. The baseline is stable 1.7.0 + TanStack
Virtual assembled by analogy with the documented combobox recipe — no Select recipe exists, and
the gap shows. App-code cost: baseline `Select.tsx` is 164 non-comment lines, pr-5617's is 106.
Findings are encoded in `tests/select.spec.ts` as per-implementation expected failures.

### What the canary earned

- **Collection-aware keyboard over unmounted rows.** End, Home, PageDown and typeahead (including
  digit prefixes like `5.9`) all land on rows that were never mounted and arrive scrolled into
  view, with honest `aria-posinset`/`aria-setsize` supplied by the virtualizer. First candidate
  to satisfy any of this on any surface.
- **No bridge code.** `alignItemWithTrigger` turns itself off; the impl has no scroll-element
  state, no scroll-to-selected effect, no highlight tracking — `Select.Root items` plus a
  `<Virtualizer>` in `Select.List` is the whole story.

### pr-5617 regressions (reproduced pure — rule 12, `/lab/pure?pick=`)

- **The first open mounts the whole collection while the popup is still hidden.** 12,000 options
  mount and unmount before anything shows: ~1.1–1.4 s click-to-popup on the production preview,
  against the baseline's ~370 ms windowed open of the same list. It settles to ~19 mounted rows
  afterwards, so only the first open pays.
- **The first open drops scroll-to-selected.** The popup shows the top of the list with the
  selection thousands of rows below; closing and reopening lands it exactly. Dev StrictMode masks
  the defect — the doubled effects give the pending scroll a second chance — so it only exists
  where rule 7 says to measure: the production build.

### What stable Select cannot express (the control's findings)

- **A committed selection reverts to `null` unless its item stays mounted.** `SelectPositioner`
  treats "selected value not among the registered items" as "the item was removed" and resets the
  value on any registration-map change that loses it — in a windowed list, that includes every
  close, since the hidden popup's window is empty. Enter and pointer selection both visibly
  commit, then immediately revert. The app-side fix is an **anchor row**: the selected item kept
  mounted outside the window at all times.
- **Keyboard is grounded in registration order.** End, Home and PageDown land on mount-order
  edges — often off screen, and nothing scrolls the highlight into view, because Select has no
  `onItemHighlighted` to build the bridge the combobox baseline uses — and typeahead matches
  mounted labels only. There is no `virtualized` opt-out on `Select.Root`.
- **`Select.List` swallows the `style` prop in 1.7.0**, so the sized-spacer assembly that works on
  `Combobox.List` renders a zero-height list; the spacer must nest inside the listbox as an extra
  `role="presentation"` layer. The #5617 head forwards the style — fixed upstream, worth a
  release.
- **`itemToStringValue` is mandatory with object values**, or the hidden form input serializes
  every value as `[object Object]`.

### Select accessibility

The open select popup scans clean on both implementations — the pinned-findings list is empty.
The combobox's `scrollable-region-focusable` finding does not carry over, because the Select
pattern moves real DOM focus between options, so the scrollport has focusable content. The one
violation the first scan did find — the release rows' meta text failing contrast at `--text-xs` —
was the app's own CSS and was fixed rather than pinned.

## Parity and accessibility matrix

`pnpm test:e2e`, production preview, 2026-08-18: **80 passed** over 4 projects × 20 tests, with
the recorded findings encoded rather than left red: the canaries' scrollport finding is pinned as
an exact per-implementation expectation in `a11y.spec.ts` (a canary fixing it, or growing any new
violation, turns the suite red), and the two keyboard defects (Tab-dismissal, PageUp/PageDown) are
expected failures that reproduce identically on all four implementations. Still owed for rule 8:
the manual VoiceOver pass and the Safari/Firefox run.

Re-run on the #5617 head, 2026-09-09: **56 passed** over 2 projects (baseline, pr-5617) × 28
tests, now including the Select suite, with the aria-hidden patch covering the canary too (see
Packaging) and PageUp/PageDown expected-failing only on the baseline.

## Packaging and integration findings

Found while making the comparison possible at all; they are about shipping these PRs, not their
APIs.

- **Type-identity collapse.** All canaries declare `@base-ui/react@1.7.0`; TypeScript dedupes
  declarations by `name@version`, so aliased types silently resolve to stable's. Any consumer
  installing a canary next to stable hits this. Worked around in `scripts/patch-canaries.mjs`.
- **pr-5414's host primitives are not exported.** `internals/virtualization/*` ships in the tarball
  but the exports map does not cover it; standalone use requires widening it (same script).
- **pnpm patches follow `name@version`, so a canary can silently inherit stable's patch.** The
  local workaround for mui/base-ui#5528 (`markOthers` aria-hides outside content but leaves it
  tabbable; axe `aria-hidden-focus`) is keyed `@base-ui/react@1.7.0` — which the 1.7.0-based
  canary tarballs also matched, so every canary carried the stable-only patch throughout the
  evaluation without anyone deciding that. Discovered 2026-09-09 when #5617's head bumped to
  1.8.0, escaped the key, and `aria-hidden-focus` resurfaced on the canary alone. The patch now
  covers both versions deliberately: #5528 is an upstream bug orthogonal to virtualization
  (`FloatingFocusManager` unchanged since 2026-07-31), and patching one side while scanning both
  would have recorded a patch artifact as an impl difference — exactly the false diff the a11y
  suite exists to prevent.
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
