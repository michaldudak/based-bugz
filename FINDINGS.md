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

| impl     | Combobox | List         | of which: host/scaffolding |
| -------- | -------- | ------------ | -------------------------- |
| baseline |          |              | —                          |
| pr-5173  |          | _(excluded)_ | —                          |
| pr-5414  |          |              |                            |
| pr-5466  |          |              | —                          |

## Requirements an API could not express

Rule 1: these are headline findings, not implementation defects.

| Requirement (contract)                           | baseline | pr-5173 | pr-5414 | pr-5466 |
| ------------------------------------------------ | -------- | ------- | ------- | ------- |
| Grouped rows (`groupOf`)                         | ✓        |         |         |         |
| Create-row / loading-row (non-item rows)         | ✓        |         |         |         |
| Unknown `total` (`aria-setsize` without a count) | ✓        |         |         |         |
| Variable measured heights                        | ✓        |         |         |         |
| `onEndReached` (list)                            | ✓        |         |         |         |
| Scroll reset on result-set change (list)         | ✓        |         |         |         |

## Parity and accessibility matrix

_From `pnpm test:e2e` (all projects) plus the manual VoiceOver pass and the Safari/Firefox run
(rule 8). Baseline's two expected failures — Tab-dismissal and PageUp/PageDown — are the numbers to
beat._

## Packaging and integration findings

Found while making the comparison possible at all; they are about shipping these PRs, not their
APIs.

- **Type-identity collapse.** All canaries declare `@base-ui/react@1.7.0`; TypeScript dedupes
  declarations by `name@version`, so aliased types silently resolve to stable's. Any consumer
  installing a canary next to stable hits this. Worked around in `scripts/patch-canaries.mjs`.
- **pr-5414's host primitives are not exported.** `internals/virtualization/*` ships in the tarball
  but the exports map does not cover it; standalone use requires widening it (same script).

## Perf notes

_Production preview only (rule 7): keystroke→paint under `?people=eager`, long-animation-frames
while scrolling, per-impl chunk sizes from the build report._

## Verdict

_Last: written only when every row above is filled in._
